/* Pruebas: todo por WhatsApp (verificación → envío a la desarrolladora), llegada, cotizador y tu panel. node --test tests/citas.test.mjs */
import {test, before, after, beforeEach} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {crearMock} from "./mock-supabase.mjs";
import {escribirFixture, datosDePrueba, ESQUEMA_PRUEBA} from "./fixture.mjs";
import {validar} from "../scripts/validar.mjs";
import {calcularCorrida} from "../assets/corrida.mjs";

const LLAVE = "llave-citas", mock = crearMock(LLAVE);
let api = {}, whats = [], metaCaida = false;
const fetchReal = globalThis.fetch;
before(async () => {
  await new Promise(ok => mock.servidor.listen(0, ok));
  Object.assign(process.env, {SUPABASE_URL:`http://127.0.0.1:${mock.servidor.address().port}`, SUPABASE_SERVICE_ROLE_KEY:LLAVE,
    IP_SALT:"s", REPORTE_CLAVE:"clave-reporte", DESARROLLOS_JSON:escribirFixture(), WHATSAPP_TOKEN:"tok", WHATSAPP_PHONE_ID:"123", ARVENTA_WHATSAPP:"6184463867", CALLMEBOT_APIKEY:""});
  // WhatsApp de mentiras: registra cada plantilla; si "metaCaida", responde error como si Meta fallara
  globalThis.fetch = (u, o) => String(u).startsWith("https://graph.facebook.com") ? (whats.push(JSON.parse(o.body)), Promise.resolve(new Response("{}", {status:metaCaida ? 500 : 200}))) : String(u).startsWith("https://") ? Promise.resolve(new Response("{}")) : fetchReal(u, o);
  for(const n of ["visita", "cita", "cotizacion", "panel", "reporte"]) api[n] = await import(`../api/${n}.js`);
});
after(() => { globalThis.fetch = fetchReal; mock.servidor.close(); });
beforeEach(() => { for(const k in mock.tablas) mock.tablas[k].length = 0; whats.length = 0; metaCaida = false; });

const post = (fn, cuerpo, headers = {}) => fn.POST(new Request("http://x/api", {method:"POST", headers:{"x-forwarded-for":"9.9.9." + Math.random(), ...headers}, body:JSON.stringify(cuerpo)}));
const solicitud = async (id = "valladolid", tel = "6181112233", folio) => {
  const r = await (await post(api.visita, {id, nombre:"Rosa Pérez", whatsapp:tel, cuando:"Este fin de semana", pago:"Infonavit", consentimiento:true, folio})).json();
  return mock.tablas.solicitudes.find(s => s.folio === r.folio);
};
const cita = (c, t, cuerpo) => cuerpo ? post(api.cita, {c, t, ...cuerpo}) : api.cita.GET(new Request(`http://x/api/cita?c=${c}&t=${t}`));

test("los datos de prueba (con esquema de pago) pasan la validación; un esquema sin confirmar no", () => {
  assert.deepEqual(validar(datosDePrueba()).errores, []);
  const malo = datosDePrueba(); malo[0].esquemas = [{...ESQUEMA_PRUEBA, liquidacionPct:80, confirmado:undefined}];
  const e = validar(malo).errores.join(" ");
  assert.match(e, /sumar 100%/); assert.match(e, /confirmado/);
});

test("corrida: apartado, enganche, mensualidades y liquidación suman el precio", () => {
  const c = calcularCorrida(ESQUEMA_PRUEBA, {precioLista:777777, enganchePct:7, meses:7, credito:"Banco"});
  assert.equal(c.total, c.precio);
  assert.equal(c.pagos[0].monto, 50000);
  assert.equal(c.pagos.filter(p => /Mensualidad/.test(p.concepto)).length, 7);
  // 5% de 780,000 = 39,000 < apartado de 50,000: el enganche real es el apartado y no se recorta
  const b = calcularCorrida(ESQUEMA_PRUEBA, {precioLista:780000, enganchePct:5, meses:12, credito:"Infonavit"});
  assert.equal(b.apartado, 50000); assert.equal(b.enganche, 50000); assert.equal(b.total, 780000);
  assert.equal(b.pagos[1].monto, 0); assert.equal(b.liquidacion, 780000 - 50000 - 78000);
});

test("la solicitud guarda un token y marca repetidas del mismo teléfono", async () => {
  const a = await solicitud(), b = await solicitud("valladolid", "6181112233", "V-BBBBBB"), c = await solicitud("cienega-2", "6181112233");
  assert.match(a.token, /^[a-z2-9]{18}$/);
  assert.equal(a.duplicada_de, null); assert.equal(b.duplicada_de, a.folio); assert.equal(c.duplicada_de, null, "otro desarrollo no es repetida");
});

test("cita: el enlace equivocado no sirve; el cliente confirma y queda la hora", async () => {
  const s = await solicitud();
  assert.equal((await cita(s.folio, "token-falso")).status, 404);
  const g = await (await cita(s.folio, s.token)).json();
  assert.equal(g.confirmada, false); assert.equal(g.nombre, "Rosa");
  assert.ok(!JSON.stringify(g).includes("6181112233"), "no expone el teléfono");
  const r = await (await cita(s.folio, s.token, {accion:"confirmar"})).json();
  assert.equal(r.confirmada, true);
  assert.ok(s.verificada_en); assert.equal(s.estado, "verificada", "sin desarrolladora registrada se queda verificada");
});

test("Ya llegué: solo a menos de 300 m, con ubicación exacta, y sin guardar coordenadas", async () => {
  const s = await solicitud(); // Valladolid: 24.002476, -104.611748 (ubicación confirmada)
  let r = await cita(s.folio, s.token, {accion:"llegue", lat:24.0125, lng:-104.6117, precision:20});      // ~1.1 km
  assert.equal(r.status, 422); assert.match((await r.json()).mensaje, /km del desarrollo/);
  r = await cita(s.folio, s.token, {accion:"llegue", lat:24.0035, lng:-104.6117, precision:400});          // poca precisión
  assert.equal(r.status, 422);
  r = await cita(s.folio, s.token, {accion:"llegue", lat:24.0035, lng:-104.6117, precision:15});           // ~115 m
  assert.equal(r.status, 200);
  assert.ok(s.llegada_en && s.verificada_en); assert.ok(s.llegada_distancia_m < 300);
  assert.equal(s.estado, "visita_hecha");
  assert.ok(!JSON.stringify(s).includes("24.0035"), "no guarda la ubicación del cliente");
  const otra = await solicitud("cienega-2", "6189998877");      // ubicación aproximada: no se puede verificar
  assert.equal((await cita(otra.folio, otra.token, {accion:"llegue", lat:24.0062, lng:-104.6336, precision:10})).status, 409);
});

test("cotización: solo con esquema confirmado, dentro de sus reglas, y ligada a la cita", async () => {
  const s = await solicitud();
  const base = {desarrollo:"valladolid", esquema:ESQUEMA_PRUEBA.nombre, precioLista:750000, enganchePct:5, meses:12, credito:"Banco"};
  assert.equal((await post(api.cotizacion, {...base, desarrollo:"cienega-2"})).status, 400, "sin esquemas");
  assert.equal((await post(api.cotizacion, {...base, enganchePct:2})).status, 400, "enganche menor al mínimo");
  assert.equal((await post(api.cotizacion, {...base, precioLista:900000})).status, 400, "precio fuera de rango");
  assert.equal((await post(api.cotizacion, {...base, precioLista:760000})).status, 400, "precio inventado (no es de sus opciones)");
  assert.equal((await post(api.cotizacion, {...base, credito:"Fovissste"})).status, 400, "crédito no aceptado");
  const otra = await solicitud("cienega-2", "6180001122");
  assert.equal((await post(api.cotizacion, {...base, folio:otra.folio})).status, 400, "cita de otro desarrollo");
  const r = await (await post(api.cotizacion, {...base, folio:s.folio, origen:"oficina"})).json();
  assert.match(r.codigo, /^C-[A-Z2-9]{6}$/);
  assert.deepEqual(mock.tablas.cotizaciones.map(c => [c.folio, c.origen, c.precio]), [[s.folio, "oficina", 750000]]);
});

test("verificada → sale por WhatsApp a la desarrolladora con la ficha de la cita, y queda enviada", async () => {
  mock.tablas.desarrolladoras.push({id:1, nombre:"Desarrolladora Prueba", whatsapp:"6187654321", desarrollos:["valladolid"], activa:true});
  const s = await solicitud();
  whats.length = 0;
  await cita(s.folio, s.token, {accion:"confirmar"});
  assert.equal(s.estado, "enviada"); assert.ok(s.enviada_en); assert.equal(s.enviada_a, "6187654321");
  const aDesarrolladora = whats.find(m => m.template.name === "arventa_cita");
  assert.equal(aDesarrolladora.to, "526187654321");
  const ficha = aDesarrolladora.template.components[0].parameters[2].text;
  for(const t of ["Rosa Pérez", "6181112233", "Infonavit", "Código: " + s.folio]) assert.ok(ficha.includes(t), t);
  assert.ok(whats.some(m => m.template.name === "arventa_aviso"), "te avisa a ti");
});

test("si Meta falla, nada se pierde: queda verificada y tu panel da el mensaje listo", async () => {
  mock.tablas.desarrolladoras.push({id:1, nombre:"Desarrolladora Prueba", whatsapp:"6187654321", desarrollos:["valladolid"], activa:true});
  metaCaida = true;
  const s = await solicitud();
  assert.equal(s.verificacion_enviada_en, undefined, "no se marca enviada si Meta no la aceptó");
  await cita(s.folio, s.token, {accion:"confirmar"});
  assert.equal(s.estado, "verificada"); assert.equal(s.enviada_en, undefined);
  const panel = (cuerpo, clave = "clave-reporte") => post(api.panel, cuerpo, {"x-clave":clave});
  const r = await (await panel({folio:s.folio, accion:"enviar"})).json();
  assert.equal(r.enviado, false); assert.match(r.manual, /^https:\/\/wa\.me\/526187654321\?text=/);
  await panel({folio:s.folio, accion:"marcar_enviada"});
  assert.equal(s.estado, "enviada"); assert.ok(s.enviada_en);
});

test("tu panel: pide clave, lista con el camino y marca inválidas con motivo", async () => {
  const panel = (cuerpo, clave = "clave-reporte") => post(api.panel, cuerpo, {"x-clave":clave});
  const s = await solicitud();
  assert.equal((await api.panel.GET(new Request("http://x/api/panel", {headers:{"x-clave":"mala"}}))).status, 401);
  const lista = await (await api.panel.GET(new Request("http://x/api/panel?dias=30", {headers:{"x-clave":"clave-reporte"}}))).json();
  assert.equal(lista.solicitudes[0].folio, s.folio); assert.equal(lista.solicitudes[0].token, undefined, "el token no sale del servidor");
  assert.equal((await panel({folio:s.folio, accion:"enviar"})).status, 409, "solo se envían verificadas");
  const dias = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  assert.equal((await panel({folio:s.folio, accion:"invalida", motivo:"cliente_previo", detalle:"Ya era cliente", pruebaFecha:dias(90)})).status, 400, "prueba vieja");
  assert.equal((await panel({folio:s.folio, accion:"invalida", motivo:"cliente_previo", detalle:"Ya era cliente", pruebaFecha:dias(10)})).status, 200);
  assert.equal(s.estado, "invalida"); assert.equal(s.motivo_invalida, "cliente_previo");
  assert.equal((await cita(s.folio, s.token, {accion:"confirmar"})).status, 409, "una cita inválida ya no se confirma");
  await panel({folio:s.folio, accion:"reactivar"});
  assert.equal(s.estado, "nueva");
});

test("reporte: citas confirmadas, llegadas y cotizaciones por desarrollo", async () => {
  const s = await solicitud();
  await cita(s.folio, s.token, {accion:"confirmar"});
  await cita(s.folio, s.token, {accion:"llegue", lat:24.0026, lng:-104.6118, precision:10});
  await post(api.cotizacion, {desarrollo:"valladolid", esquema:ESQUEMA_PRUEBA.nombre, precioLista:750000, enganchePct:5, meses:12, credito:"Banco", folio:s.folio});
  const r = await (await api.reporte.GET(new Request("http://x/api/reporte?dias=30&d=valladolid", {headers:{"x-clave":"clave-reporte"}}))).json();
  assert.deepEqual([r.totales.confirmadas, r.totales.llegadas, r.totales.cotizaciones], [1, 1, 1]);
});
