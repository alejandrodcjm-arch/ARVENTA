/* Pruebas del sitio como lo usa una persona en su celular (docs/REQUISITOS.md §11) */
import {test, expect} from "@playwright/test";
import {readFileSync} from "node:fs";

const DESARROLLOS = JSON.parse(readFileSync(new URL("../data/desarrollos.json", import.meta.url)));
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
  await expect(page.locator(".tarjeta")).toHaveCount(DESARROLLOS.length);
  await expect(page.locator("#titulo-res")).toContainText(`${DESARROLLOS.length} desarrollos`);
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
  await expect(page.locator(".tarjeta")).toHaveCount(DESARROLLOS.filter(d => d.tipo === "casa").length);
  await page.locator('.cat[data-cat="todo"]').click();
  await page.locator("#orden").selectOption("barato");
  const masBarato = [...DESARROLLOS].sort((a, b) => a.desde - b.desde)[0];
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
  for(const t of ["Condiciones", "Créditos que acepta", "Puede variar al cerrar", "¿Te alcanza?"]) await expect(page.locator("#ficha")).toContainText(t);
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
  await expect(page.locator(".tarjeta")).toHaveCount(DESARROLLOS.length);
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
  await expect(page.locator("#mapa .pin")).toHaveCount(DESARROLLOS.filter(d => d.lat != null).length, {timeout:15000});
});
