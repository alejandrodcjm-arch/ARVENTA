/* Pruebas del sitio como lo usa una persona en su celular (docs/REQUISITOS.md §11) */
import {test, expect} from "@playwright/test";
import {readFileSync} from "node:fs";

import {ANUNCIOS_PRUEBA} from "./fixture.mjs";
const DESARROLLOS = JSON.parse(readFileSync(new URL("../data/desarrollos.json", import.meta.url)));
// Lo que se ve en "Todo": desarrollos reales + la casa usada de prueba (las rentas van aparte)
const COMPRA = [...DESARROLLOS, ...ANUNCIOS_PRUEBA.filter(d => d.operacion !== "renta")];
const MOCK = "http://127.0.0.1:54399";
// Errores reales de la página (no cuentan los recursos externos que no cargaron)
function vigilarErrores(page){
  const errores = [];
  page.on("pageerror", e => errores.push(e.message));
  page.on("console", m => { if(m.type() === "error" && !/Failed to load resource|ERR_|net::/.test(m.text())) errores.push(m.text()); });
  return errores;
}

test("la portada carga y muestra los desarrollos, sin errores", async ({page}) => {
  const errores = vigilarErrores(page);
  await page.goto("/");
  await expect(page.locator(".tarjeta")).toHaveCount(COMPRA.length);
  await expect(page.locator("#titulo-res")).toContainText(`${COMPRA.length} opciones`);
  expect(errores).toEqual([]);
});

test("buscar, filtrar y ordenar cambian los resultados", async ({page}) => {
  await page.goto("/");
  await page.locator("#buscador-movil").click();             // en celular el buscador abre un panel
  await page.locator("#q2").fill("torre");
  const conTorre = DESARROLLOS.filter(d => /torre/i.test(d.nombre + d.zona)).length;
  await expect(page.locator(".tarjeta")).toHaveCount(conTorre);
  await page.locator("#q2").fill("");
  await page.keyboard.press("Escape");
  await page.locator('.cat[data-cat="casa"]').click();
  await expect(page.locator(".tarjeta")).toHaveCount(COMPRA.filter(d => d.tipo === "casa").length);
  await page.locator('.cat[data-cat="todo"]').click();
  await page.locator("#orden").selectOption("barato");
  const masBarato = [...COMPRA].sort((a, b) => a.desde - b.desde)[0];
  await expect(page.locator(".tarjeta h3").first()).toHaveText(masBarato.nombre);
});

test("cada ficha existe como página real y cumple la NOM-247 aun sin JavaScript", async ({request}) => {
  for(const d of DESARROLLOS){
    const r = await request.get(`/desarrollos/${d.id}/`);
    expect(r.status(), d.id).toBe(200);
    const html = await r.text();
    expect(html).toContain(`<h1 id="ficha-titulo">${d.nombre.replace(/&/g, "&amp;")}</h1>`);
    for(const t of ["Créditos que acepta", "Entrega", "Qué incluye", "Ubicación", "Precio verificado el", "application/ld+json", "og:title"]) expect(html, `${d.id}: ${t}`).toContain(t);
    expect(html, d.id).toMatch(/Puede variar al cerrar la operación|Precio por confirmar/);
  }
});

test("la ficha interactiva abre desde la lista y el botón atrás regresa", async ({page}) => {
  await page.goto("/");
  await page.locator(".tarjeta").first().locator(".titulo-enlace").click();
  await expect(page).toHaveURL(/\/desarrollos\/[a-z0-9-]+\/$/);
  for(const t of ["Condiciones", "Créditos que acepta", "Puede variar al cerrar", "Cómo podrías pagarlo"]) await expect(page.locator("#ficha")).toContainText(t);
  await page.goBack();
  await expect(page.locator(".tarjeta").first()).toBeVisible();
});

test("enviar una solicitud la guarda antes de abrir WhatsApp", async ({page, request}) => {
  await request.get(`${MOCK}/__reset`);
  let whatsapp = null;
  await page.route("https://wa.me/**", r => { whatsapp = r.request().url(); r.fulfill({body:"ok"}); });
  await page.goto("/desarrollos/cienega-2/");
  await page.locator("#agendar-2").click();
  await page.locator("#v-nombre").fill("Prueba Automática");
  await page.locator("#v-tel").fill("6181234567");
  await page.locator("#v-enviar").click();
  await expect(page.locator("#dlg-visita")).toBeVisible(); // sin la casilla no se envía
  await page.locator("#v-consent").check();
  await page.locator("#v-enviar").click();
  await expect.poll(() => whatsapp).toContain("wa.me/526184463867");
  const {solicitudes} = await (await request.get(`${MOCK}/__datos`)).json();
  expect(solicitudes).toHaveLength(1);
  expect(solicitudes[0]).toMatchObject({desarrollo:"cienega-2", nombre:"Prueba Automática", telefono:"6181234567", consentimiento:true});
  expect(decodeURIComponent(whatsapp)).toContain(solicitudes[0].folio);
});

test("sin servicios externos (mapa, rutas, letras) el sitio sigue funcionando", async ({page}) => {
  const errores = vigilarErrores(page);
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, r => r.abort());
  await page.goto("/");
  await expect(page.locator(".tarjeta")).toHaveCount(COMPRA.length);
  await page.locator("#alternar").click();               // el mapa no carga: aviso y regresa a la lista
  await expect(page.locator("#toast")).toContainText(/mapa/);
  await page.goto("/desarrollos/torre-oriente/");
  await expect(page.locator("#ficha")).toContainText("Lo que tienes cerca");
  await expect(page.locator(".cerca li").first()).toBeVisible(); // lugares precalculados
  expect(errores).toEqual([]);
});

test("ficha y portada sin errores en la consola", async ({page}) => {
  const errores = vigilarErrores(page);
  await page.goto("/desarrollos/torre-oriente/");
  await expect(page.locator("#ficha h1")).toHaveText("Torre Oriente");
  await page.goto("/anuncia.html");
  await page.goto("/aviso-privacidad.html");
  await page.goto("/terminos.html");
  await page.goto("/reporte.html#demo");
  await expect(page.locator("#contenido h1")).toBeVisible();
  expect(errores).toEqual([]);
});

test("con internet, el mapa se carga solo al abrirlo y muestra los pines", async ({page}) => {
  await page.goto("/");
  expect(await page.evaluate(() => typeof window.L)).toBe("undefined");   // Leaflet no se carga al inicio
  await page.locator("#alternar").click();
  await expect(page.locator("#mapa .pin")).toHaveCount(COMPRA.filter(d => d.lat != null).length, {timeout:15000});
});

// Crea una solicitud real por /api/visita y regresa su folio y token (los toma de la base de pruebas)
async function nuevaCita(request, id = "valladolid"){
  await request.get(`${MOCK}/__reset`);
  const r = await (await request.post("/api/visita", {data:{id, nombre:"Lucía Prueba", whatsapp:"6183334455", cuando:"Este fin de semana", pago:"Infonavit", consentimiento:true}})).json();
  const {solicitudes} = await (await request.get(`${MOCK}/__datos`)).json();
  return solicitudes.find(s => s.folio === r.folio);
}

test("el cliente confirma su cita desde su enlace y registra su llegada", async ({page, context, request}) => {
  const s = await nuevaCita(request);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({latitude:24.0035, longitude:-104.6117, accuracy:15});   // ~115 m de Valladolid
  await page.goto(`/cita/?c=${s.folio}&t=${s.token}`);
  await expect(page.locator(".codigo-cita b")).toHaveText(s.folio);
  await page.locator("#confirmar").click();
  await expect(page.locator("#cita")).toContainText("confirmada");
  await page.locator("#llegue").click();
  await expect(page.locator("#cita")).toContainText("Registramos tu llegada");
  const {solicitudes} = await (await request.get(`${MOCK}/__datos`)).json();
  expect(solicitudes[0].verificada_en).toBeTruthy();
  expect(solicitudes[0].llegada_distancia_m).toBeLessThan(300);
  await page.goto(`/cita/?c=${s.folio}&t=equivocado`);
  await expect(page.locator("h1")).toHaveText("No encontramos tu cita");
});

test("el cotizador arma la corrida y descarga un PDF ligado a la cita", async ({page, request}) => {
  const s = await nuevaCita(request);
  await page.goto(`/cotizador.html?d=valladolid&folio=${s.folio}`);
  await expect(page.locator("#resumen-cot")).toContainText("Al apartar");
  await page.locator("#q-meses").selectOption("6");
  await expect(page.locator("#resumen-cot")).toContainText("6 mensualidades");
  await page.locator("#q-nombre").fill("Lucía Prueba");
  const [descarga] = await Promise.all([page.waitForEvent("download"), page.locator("#descargar").click()]);
  expect(descarga.suggestedFilename()).toBe("Cotizacion-Fracc-Valladolid-etapa-II-Lucia-Prueba.pdf");
  const bytes = await (await import("node:fs")).promises.readFile(await descarga.path());
  expect(bytes.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
  expect(bytes.toString("latin1")).toContain("Cotizaci\xF3n informativa");
  const {cotizaciones} = await (await request.get(`${MOCK}/__datos`)).json();
  expect(cotizaciones).toHaveLength(1);
  expect(cotizaciones[0]).toMatchObject({folio:s.folio, desarrollo:"valladolid", meses:6});
});

test("sin esquemas confirmados, la ficha lo dice y no ofrece corrida", async ({page}) => {
  await page.goto("/desarrollos/cienega-2/");
  await expect(page.locator(".condiciones")).toContainText("Esquemas de pago");
  await expect(page.locator(".btn-corrida")).toHaveCount(0);
  await page.goto("/desarrollos/valladolid/");
  await expect(page.locator(".btn-corrida")).toBeVisible();
});

test("tu panel muestra la solicitud y la puedes marcar inválida", async ({page, request}) => {
  const s = await nuevaCita(request);
  await page.goto("/panel.html");
  await page.locator("#clave").fill("clave-e2e");
  await page.locator("#form-clave button").click();
  const tarjeta = page.locator(`.sol[data-folio="${s.folio}"]`);
  await expect(tarjeta).toContainText("Lucía Prueba");
  await expect(tarjeta.locator(".estado")).toHaveText("Nueva");
  await tarjeta.getByRole("button", {name:"Inválida…"}).click();
  await tarjeta.locator("select[name=motivo]").selectOption("telefono_falso");
  await tarjeta.locator("textarea[name=detalle]").fill("El número no existe");
  await tarjeta.getByRole("button", {name:"Marcar inválida"}).click();
  await expect(page.locator(`.sol[data-folio="${s.folio}"] .estado`)).toHaveText("Inválida");
});

test("en la calculadora no se puede escribir el precio ni la tasa", async ({page}) => {
  await page.goto("/desarrollos/cienega-2/");
  expect(await page.locator("#c-precio").evaluate(el => el.tagName)).toBe("SELECT");        // modelos confirmados
  await expect(page.locator("#c-precio option")).toHaveCount(3);
  await expect(page.locator("#c-tasa")).toHaveText(/11\.3%/);                               // tasa fija de referencia
  expect(await page.locator(".calc input").count()).toBe(0);
  const antes = await page.locator("#c-res").textContent();
  await page.locator("#c-precio").selectOption("1700000");
  await expect(page.locator("#c-res")).not.toHaveText(antes);
  await page.goto("/cotizador.html?d=valladolid");
  expect(await page.locator("#q-precio").evaluate(el => el.tagName)).toBe("SELECT");
});

test("casa usada: su propia ficha, sin preventa ni corrida, con aviso de gravamen", async ({page}) => {
  await page.goto("/");
  await page.locator('.cat[data-cat="usadas"]').click();
  await expect(page.locator(".tarjeta")).toHaveCount(1);
  await expect(page.locator(".tarjeta .insignia")).toHaveText("Casa usada · dueño directo");
  await page.locator(".tarjeta .titulo-enlace").click();
  const f = page.locator("#ficha");
  for(const t of ["Libertad de gravamen", "Escrituras", "Dueño directo", "Antes de dar cualquier anticipo", "Cómo podrías pagarlo", "precio de venta"]) await expect(f).toContainText(t);
  await expect(f.locator("dt", {hasText:"Entrega"})).toHaveCount(0);
  await expect(f.locator(".btn-corrida")).toHaveCount(0);
  await expect(page.locator("#c-precio")).toContainText("$1,350,000");
});

test("renta: va aparte de la compra, con depósito, y el formulario pide garantía en lugar de crédito", async ({page, request}) => {
  await request.get(`${MOCK}/__reset`);
  await page.route("https://wa.me/**", r => r.fulfill({body:"ok"}));
  await page.goto("/");
  await expect(page.locator('.tarjeta[data-id="prueba-depa-renta"]')).toHaveCount(0);
  await page.locator('.cat[data-cat="renta"]').click();
  await expect(page.locator(".tarjeta")).toHaveCount(1);
  await expect(page.locator("#titulo-res")).toContainText("1 inmueble en renta");
  await expect(page.locator(".tarjeta .precio")).toContainText("$8,500 al mes");
  await page.locator(".tarjeta .titulo-enlace").click();
  const f = page.locator("#ficha");
  for(const t of ["Depósito", "Garantía que pide", "Mascotas", "$17,000", "Antes de dar un depósito", "Inmobiliaria de Prueba"]) await expect(f).toContainText(t);
  await expect(f).not.toContainText("Cómo podrías pagarlo");
  await expect(f).not.toContainText("Créditos que acepta");
  await expect(page.locator("#c-res")).toHaveCount(0);
  await page.locator("#agendar-2").click();
  await expect(page.locator("#l-credito")).toHaveText("¿Qué garantía puedes dar?");
  await expect(page.locator("#v-quien")).toHaveText("quien anuncia este inmueble");
  await page.locator("#v-nombre").fill("Renta Prueba");
  await page.locator("#v-tel").fill("6182223344");
  await page.locator("#v-credito").selectOption("Aval (obligado solidario)");
  await page.locator("#v-consent").check();
  await page.locator("#v-enviar").click();
  await expect.poll(async () => (await (await request.get(`${MOCK}/__datos`)).json()).solicitudes.length).toBe(1);
  const {solicitudes} = await (await request.get(`${MOCK}/__datos`)).json();
  expect(solicitudes[0]).toMatchObject({desarrollo:"prueba-depa-renta", pago:"Aval (obligado solidario)", mensualidad:null});
});
