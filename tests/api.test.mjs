/* Pruebas de las funciones de /api contra una imitación de Supabase. Corren con: node --test tests/api.test.mjs */
import {test, before, after, beforeEach} from "node:test";
import assert from "node:assert/strict";
import {crearMock} from "./mock-supabase.mjs";
import {validar} from "../scripts/validar.mjs";
import {readFileSync} from "node:fs";

const LLAVE = "llave-de-prueba";
const mock = crearMock(LLAVE);
let api = {};
const avisos = [];
const fetchReal = globalThis.fetch;

before(async () => {
  await new Promise(ok => mock.servidor.listen(0, ok));
  Object.assign(process.env, {SUPABASE_URL:`http://127.0.0.1:${mock.servidor.address().port}`, SUPABASE_SERVICE_ROLE_KEY:LLAVE,
    IP_SALT:"sal", REPORTE_CLAVE:"clave-secreta", WHATSAPP_TOKEN:"tok", WHATSAPP_PHONE_ID:"123", ARVENTA_WHATSAPP:"6184463867"});
  // Los WhatsApp no salen a internet: se registran aquí (como si Meta los aceptara)
  globalThis.fetch = async (url, op) => String(url).startsWith("https://graph.facebook.com") ? (avisos.push(JSON.parse(op.body)), new Response("{}", {status:200})) : fetchReal(url, op);
  for(const n of ["visita", "evento", "reporte", "salud", "contacto"]) api[n] = await import(`../api/${n}.js`);
});
after(() => { globalThis.fetch = fetchReal; mock.servidor.close(); });
beforeEach(() => { for(const k in mock.tablas) mock.tablas[k].length = 0; avisos.length = 0; });

const pedir = (cuerpo, ip = "10.0.0.1") => new Request("http://x/api/visita", {method:"POST", headers:{"x-forwarded-for":ip}, body:JSON.stringify(cuerpo)});
const valida = (extra = {}) => ({id:"cienega-2", nombre:"Ana López", whatsapp:"618 123 4567", cuando:"Este fin de semana", pago:"Infonavit",
  consentimiento:true, versionAviso:"18 de noviembre de 2026", folio:"V-ABCDEF", trabajo:{texto:"UJED", lat:24.02811, lng:-104.66523}, minutos:12, ...extra});

test("los datos de data/desarrollos.json son válidos", () => {
  const {errores} = validar(JSON.parse(readFileSync(new URL("../data/desarrollos.json", import.meta.url))));
  assert.deepEqual(errores, []);
});

test("visita válida: se guarda, se avisa a ARVENTA y no guarda la IP", async () => {
  const r = await api.visita.POST(pedir(valida()));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), {ok:true, folio:"V-ABCDEF", verificacion:"enviada"});
  const [f] = mock.tablas.solicitudes;
  assert.equal(f.telefono, "6181234567");
  assert.equal(f.trabajo_lat, 24.03); assert.equal(f.trabajo_lng, -104.67);
  assert.equal(f.aviso_enviado, true);
  assert.ok(f.ip_hash && !JSON.stringify(f).includes("10.0.0.1"));
  assert.ok(f.verificacion_enviada_en, "salió la verificación al cliente");
  const [alCliente, aTi] = avisos;
  assert.equal(alCliente.to, "526181234567"); assert.equal(alCliente.template.name, "arventa_verificar");
  assert.match(alCliente.template.components[0].parameters[2].text, new RegExp(`/cita/\\?c=V-ABCDEF&t=${f.token}`));
  assert.equal(aTi.to, "526184463867"); assert.equal(aTi.template.name, "arventa_aviso");
  assert.match(aTi.template.components[0].parameters[0].text, /V-ABCDEF.*La Ciénega II/);
  assert.ok(!/\n/.test(aTi.template.components[0].parameters[0].text), "Meta no acepta saltos de línea en parámetros");
});

test("visita: validación en el servidor", async () => {
  for(const [extra, texto] of [[{whatsapp:"123"}, /10 dígitos/], [{consentimiento:false}, /aceptes/], [{id:"no-existe"}, /no existe/], [{nombre:" "}, /nombre/]]){
    const r = await api.visita.POST(pedir(valida(extra)));
    assert.equal(r.status, 400); assert.match((await r.json()).mensaje, texto);
  }
  assert.equal(mock.tablas.solicitudes.length, 0);
});

test("visita: el campo trampa no guarda nada", async () => {
  const r = await api.visita.POST(pedir(valida({sitio:"spam"})));
  assert.equal(r.status, 200); assert.equal(mock.tablas.solicitudes.length, 0);
});

test("visita: máximo 5 por hora por IP", async () => {
  for(let i = 0; i < 5; i++) assert.equal((await api.visita.POST(pedir(valida({folio:`V-AAAAA${"BCDEF"[i]}`})))).status, 200);
  assert.equal((await api.visita.POST(pedir(valida({folio:"V-ZZZZZZ"})))).status, 429);
  assert.equal((await api.visita.POST(pedir(valida({folio:"V-YYYYYY"}), "10.0.0.2"))).status, 200, "otra IP sí puede");
});

test("visita: reintento con el mismo folio no duplica", async () => {
  await api.visita.POST(pedir(valida()));
  const r = await api.visita.POST(pedir(valida()));
  assert.equal(r.status, 200); assert.equal((await r.json()).repetida, true);
  assert.equal(mock.tablas.solicitudes.length, 1);
});

test("visita: sin base de datos responde 503 (el navegador la guarda en cola)", async () => {
  const url = process.env.SUPABASE_URL; process.env.SUPABASE_URL = "";
  try{ assert.equal((await api.visita.POST(pedir(valida()))).status, 503); }
  finally{ process.env.SUPABASE_URL = url; }
});

test("evento: solo guarda campos permitidos y la zona redondeada", async () => {
  const ev = cuerpo => api.evento.POST(new Request("http://x/api/evento", {method:"POST", body:JSON.stringify(cuerpo)}));
  assert.equal((await ev({tipo:"ver-ficha", datos:{id:"cienega-2", nombre:"Ana", telefono:"618"}})).status, 204);
  await ev({tipo:"zona-trabajo", datos:{lat:24.028111, lng:-104.66523}});
  await ev({tipo:"inventado", datos:{x:1}});
  assert.equal(mock.tablas.eventos.length, 2);
  assert.deepEqual(mock.tablas.eventos[0].datos, {id:"cienega-2"});
  assert.deepEqual(mock.tablas.eventos[1].datos, {lat:24.03, lng:-104.67});
});

test("reporte: pide clave, agrega y no expone nombres ni teléfonos", async () => {
  await api.visita.POST(pedir(valida()));
  await api.visita.POST(pedir(valida({folio:"V-BBBBBB", id:"torre-oriente", pago:"Contado"})));
  await api.visita.POST(pedir(valida({folio:"V-CCCCCC"})));
  for(const id of ["cienega-2", "cienega-2", "torre-oriente"]) await api.evento.POST(new Request("http://x", {method:"POST", body:JSON.stringify({tipo:"ver-ficha", datos:{id}})}));
  const pedirR = (q, clave) => api.reporte.GET(new Request(`http://x/api/reporte?${q}`, {headers:{"x-clave":clave}}));
  assert.equal((await pedirR("dias=30", "mala")).status, 401);
  const todo = await (await pedirR("dias=30", "clave-secreta")).json();
  assert.equal(todo.totales.solicitudes, 3); assert.equal(todo.totales.vistas, 3);
  assert.deepEqual(todo.zonas, [{lat:24.03, lng:-104.67, n:3}]);
  const uno = await (await pedirR("dias=90&d=torre-oriente", "clave-secreta")).json();
  assert.deepEqual(uno.desarrollos.map(d => d.id), ["torre-oriente"]);
  assert.equal(uno.totales.solicitudes, 1);
  assert.equal(uno.zonas.length, 0, "una sola persona no forma zona");
  const txt = JSON.stringify(todo) + JSON.stringify(uno);
  assert.ok(!txt.includes("Ana") && !txt.includes("6181234567"));
});

test("salud: falla si una solicitud lleva 10 minutos sin aviso", async () => {
  assert.equal((await api.salud.GET()).status, 200);
  mock.tablas.solicitudes.push({folio:"V-VIEJAS", aviso_enviado:false, creado:new Date(Date.now() - 20 * 60e3).toISOString()});
  assert.equal((await api.salud.GET()).status, 503);
});

test("contacto de desarrolladora", async () => {
  const c = cuerpo => api.contacto.POST(new Request("http://x/api/contacto", {method:"POST", headers:{"x-forwarded-for":"1.1.1.1"}, body:JSON.stringify(cuerpo)}));
  assert.equal((await c({nombre:"Luis", desarrollo:"Fracc. Nuevo"})).status, 400);
  const r = await c({nombre:"Luis", desarrollo:"Fracc. Nuevo", whatsapp:"618 555 1234", folio:"D-ABCDEF"});
  assert.equal(r.status, 200); assert.equal(mock.tablas.contactos[0].telefono, "6185551234");
});
