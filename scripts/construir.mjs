/* Construye lo que el sitio necesita a partir de data/:
     assets/datos.js              datos + lugares cercanos ya calculados (lo usa assets/app.js)
     data/lugares.json            lugares cercanos por desarrollo
     desarrollos/<id>/index.html  una página real por desarrollo (Google, WhatsApp, sin JavaScript)
     desarrollos/<id>/og.png      imagen de vista previa (requiere Chrome o Edge; se omite con --sin-imagenes)
     sitemap.xml y robots.txt
   y pone versión (?v=hash) a CSS y JS en todas las páginas para que la caché larga no sirva archivos viejos.
   Uso: node scripts/construir.mjs [--sin-imagenes]      Variable SITIO: dirección pública (por omisión https://arventa.mx) */
import {readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, mkdtempSync} from "node:fs";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {fileURLToPath, pathToFileURL} from "node:url";
import os from "node:os";
import path from "node:path";
import {validar} from "./validar.mjs";
import {preciosDe, financiamientoDe} from "../assets/corrida.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITIO = (process.env.SITIO || "https://arventa.mx").replace(/\/$/, "");
const SIN_IMAGENES = process.argv.includes("--sin-imagenes");
const leer = f => readFileSync(path.join(RAIZ, f), "utf8").replace(/\r\n/g, "\n");
const escribir = (f, t) => { mkdirSync(path.dirname(path.join(RAIZ, f)), {recursive:true}); writeFileSync(path.join(RAIZ, f), t); };

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dinero = n => "$" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const TIPO = {casa:"casas", departamento:"departamentos", terreno:"terrenos"};
const UNO = {casa:"Casa", departamento:"Departamento", terreno:"Terreno"};
const opDe = d => d.operacion || "nueva";
// "Casas", "Casa usada", "Departamento en renta"
const tipoTexto = d => opDe(d) === "renta" ? `${UNO[d.tipo]} en renta` : opDe(d) === "reventa" ? {casa:"Casa usada", departamento:"Departamento usado", terreno:"Terreno en venta"}[d.tipo] : {casa:"Casas", departamento:"Departamentos", terreno:"Terrenos"}[d.tipo];
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const fechaLarga = f => { const [a, m, d] = f.split("-").map(Number); return `${d} de ${MESES[m - 1]} de ${a}`; };
const CATS = {escuela:"Escuela", oxxo:"OXXO", super:"Supermercado", farmacia:"Farmacia", salud:"Hospital o clínica", parque:"Parque", uni:"Universidad"};

/* ---------- 1. Datos ---------- */
const lista = JSON.parse(leer("data/desarrollos.json"));
const {errores} = validar(lista);
if(errores.length){ console.error("data/desarrollos.json tiene errores; corre node scripts/validar.mjs. No se construyó nada."); process.exit(1); }
const osm = JSON.parse(leer("data/lugares-osm.json"));

/* ---------- 2. Lugares cercanos por desarrollo ---------- */
function metros(a, b){
  const R = 6371000, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const lugares = osm.lugares.map(([cat, nombre, lat, lng]) => ({cat, nombre, lat, lng}));
const porDesarrollo = {};
for(const d of lista){
  if(d.lat == null) continue;
  const mas = {}, conteo = {};
  for(const l of lugares){
    const m = metros(d, l);
    if(m <= 1000) conteo[l.cat] = (conteo[l.cat] || 0) + 1;
    if(!mas[l.cat] || m < mas[l.cat].m) mas[l.cat] = {nombre:l.nombre, lat:l.lat, lng:l.lng, m:Math.round(m)};
  }
  porDesarrollo[d.id] = {mas, conteo};
}
// Escuelas, hospitales y universidades con nombre, para "cerca de mi escuela / hospital"
const referencias = lugares.filter(l => l.nombre && ["escuela", "salud", "uni"].includes(l.cat)).map(l => [l.cat, l.nombre, l.lat, l.lng]);
const LUGARES = {fecha:osm.fecha, porDesarrollo, referencias};
escribir("data/lugares.json", JSON.stringify({fecha:osm.fecha, porDesarrollo}, null, 1) + "\n");
escribir("assets/datos.js", `/* GENERADO por scripts/construir.mjs a partir de data/. No se edita a mano. */\n` +
  `window.DESARROLLOS = ${JSON.stringify(lista.map(d => ({...d, opcionesPrecio:preciosDe(d), opcionesFin:financiamientoDe(d)})))};\nwindow.LUGARES = ${JSON.stringify(LUGARES)};\n`);

/* ---------- 3. Versiones de CSS y JS ---------- */
const ASSETS = ["estilos.css", "paginas.css", "config.js", "datos.js", "app.js", "anuncia.js", "reporte.js", "cita.js", "panel.js", "cotizador.mjs"].filter(f => existsSync(path.join(RAIZ, "assets", f)));
const version = Object.fromEntries(ASSETS.map(f => [f, createHash("sha1").update(readFileSync(path.join(RAIZ, "assets", f), "utf8").replace(/\r\n/g, "\n")).digest("hex").slice(0, 10)]));
const versionar = html => html.replace(/\/assets\/([a-z-]+\.(?:css|m?js))(\?v=[0-9a-f]+)?/g, (t, f) => version[f] ? `/assets/${f}?v=${version[f]}` : t);
for(const pagina of ["index.html", "anuncia.html", "aviso-privacidad.html", "terminos.html", "reporte.html", "cotizador.html", "panel.html", "cita/index.html", "404.html"])
  if(existsSync(path.join(RAIZ, pagina))) escribir(pagina, versionar(leer(pagina)));

/* ---------- 4. SEO de la portada ---------- */
const ORG = {"@context":"https://schema.org", "@type":"RealEstateAgent", name:"ARVENTA", url:SITIO + "/",
  areaServed:{"@type":"City", name:"Durango, Dgo."}, address:{"@type":"PostalAddress", addressLocality:"Durango", addressRegion:"Dgo.", addressCountry:"MX"}};
const seoPortada = `<!-- seo:inicio -->
<link rel="canonical" href="${SITIO}/">
<meta property="og:type" content="website"><meta property="og:site_name" content="ARVENTA"><meta property="og:locale" content="es_MX">
<meta property="og:title" content="ARVENTA · Vivienda nueva en Durango">
<meta property="og:description" content="Todos los fraccionamientos y edificios nuevos de Durango: precios, lo que tienes cerca y cuánto tardas a tu trabajo.">
<meta property="og:url" content="${SITIO}/">
<script type="application/ld+json">${JSON.stringify(ORG)}</script>
<!-- seo:fin -->`;
const ponerSeo = (html, seo) => html.replace(/<!-- seo:inicio -->[\s\S]*?<!-- seo:fin -->/, seo);
let portada = ponerSeo(leer("index.html"), seoPortada);
escribir("index.html", portada);

/* ---------- 5. Página de cada desarrollo ---------- */
const cerca = (d) => {
  const c = porDesarrollo[d.id];
  if(!c) return `<p>Todavía no tenemos la ubicación exacta de este desarrollo.</p>`;
  return `<ul>${["escuela", "oxxo", "super", "farmacia", "salud", "parque", "uni"].filter(k => c.mas[k] && c.mas[k].m <= 5000)
    .map(k => `<li>${CATS[k]} más cercana(o): ${esc(c.mas[k].nombre || CATS[k])}, a ${c.mas[k].m < 1000 ? Math.round(c.mas[k].m / 10) * 10 + " m" : (c.mas[k].m / 1000).toFixed(1) + " km"} en línea recta</li>`).join("")}</ul>
    <p>Lugares según OpenStreetMap (${esc(osm.fecha)})${d.aprox ? ", medidos desde una ubicación aproximada" : ""}.</p>`;
};
function fichaEstatica(d){
  // Sin depender de la fecha de hoy (la construcción debe dar siempre lo mismo); el navegador
  // cambia a "Precio por confirmar" cuando pasan más de 60 días desde "verificado".
  const op = opDe(d), pend = "Por confirmar", siNo = (v, si, no) => v == null ? pend : v ? si : no;
  const precio = op === "renta" ? `<p class="precio"><b>${dinero(d.desde)}</b> al mes. Verificada el ${fechaLarga(d.verificado)}.</p>`
    : op === "reventa" ? `<p class="precio">Precio: <b>${dinero(d.desde)}</b>. Puede variar al cerrar la operación. Verificado el ${fechaLarga(d.verificado)}.</p>`
    : `<p class="precio">Desde <b>${dinero(d.desde)}</b>${d.hasta ? ` hasta ${dinero(d.hasta)} según modelo` : ""}. Puede variar al cerrar la operación. Verificado el ${fechaLarga(d.verificado)}.</p>`;
  const r = d.renta || {}, v = d.reventa || {}, a = d.anunciante;
  const condiciones = op === "renta" ? `
    <dt>Depósito</dt><dd>${r.deposito != null ? `${r.deposito} ${r.deposito === 1 ? "mes" : "meses"} de renta` : pend}</dd>
    <dt>Garantía que pide</dt><dd>${r.garantia?.length ? esc(r.garantia.join(", ")) : pend}</dd>
    <dt>Contrato mínimo</dt><dd>${r.plazoMeses ? r.plazoMeses + " meses" : pend}</dd>
    <dt>Mantenimiento</dt><dd>${r.mantenimiento == null ? pend : typeof r.mantenimiento === "number" ? dinero(r.mantenimiento) + " al mes, aparte" : esc(r.mantenimiento)}</dd>
    <dt>Servicios incluidos</dt><dd>${r.servicios ? esc(r.servicios) : pend}</dd>
    <dt>Amueblado</dt><dd>${siNo(r.amueblado, "Sí", "No")}</dd><dt>Mascotas</dt><dd>${siNo(r.mascotas, "Se aceptan", "No se aceptan")}</dd>
    <dt>Requisitos</dt><dd>${r.requisitos ? esc(r.requisitos) : pend}</dd><dt>Disponible</dt><dd>${r.disponible ? esc(r.disponible) : pend}</dd>`
    : op === "reventa" ? `
    <dt>Créditos que acepta</dt><dd>${d.creditos.length ? esc(d.creditos.join(", ")) : pend}</dd>
    <dt>Construida en</dt><dd>${v.construida || pend}</dd>
    <dt>Escrituras</dt><dd>${v.escrituras ? "A nombre de quien vende; ARVENTA las vio el " + fechaLarga(a.verificado) : pend}</dd>
    <dt>Libertad de gravamen</dt><dd>${v.gravamen ? `Certificado del ${fechaLarga(v.gravamen)}; pide uno nuevo antes de pagar` : "Pídelo antes de dar cualquier dinero"}</dd>
    <dt>Predial y agua</dt><dd>${siNo(v.alCorriente, "Al corriente", "Con adeudo")}</dd>
    <dt>Qué incluye</dt><dd>${d.incluye ? esc(d.incluye) : pend}</dd>`
    : `
    <dt>Créditos que acepta</dt><dd>${d.creditos.length ? esc(d.creditos.join(", ")) : pend}</dd>
    <dt>Entrega</dt><dd>${d.entrega ? esc(d.entrega) + (d.fechaEntrega ? ". " + esc(d.fechaEntrega) : "") : pend}</dd>
    <dt>Qué incluye</dt><dd>${d.incluye ? esc(d.incluye) : pend}</dd>`;
  const quien = op === "nueva" ? `${d.convenio ? "Anunciante en ARVENTA: los datos los confirmó la desarrolladora." : "Información pública de anuncios."} ARVENTA no vende: al agendar, le pasamos tu solicitud a quien comercializa este desarrollo para que te atienda. Para ti no tiene costo.`
    : `Lo anuncia: ${a.tipo === "particular" ? `dueño directo (ARVENTA confirmó en persona el ${fechaLarga(a.verificado)} que es el dueño)` : esc(a.nombre)}. ARVENTA no ${op === "renta" ? "renta" : "vende"} ni recibe dinero: al agendar, le pasamos tu solicitud a quien lo anuncia. Para ti no tiene costo.`;
  return `<div class="ficha-estatica">
  <p><a href="/">← Todos los desarrollos</a></p>
  <h1 id="ficha-titulo">${esc(d.nombre)}</h1>
  <p>${esc(tipoTexto(d))} · ${esc(d.zona)}${d.aprox ? " (ubicación aproximada)" : ""}</p>
  ${precio}
  ${d.descripcion ? `<p>${esc(d.descripcion)}</p>` : ""}
  <h2>Condiciones</h2>
  <dl>
    ${d.tipo !== "terreno" ? `<dt>Recámaras</dt><dd>${esc(d.recamaras)}</dd>` : ""}<dt>Tamaño</dt><dd>${esc(d.m2)}</dd>${d.banos ? `<dt>Baños</dt><dd>${esc(d.banos)}</dd>` : ""}${d.estacionamientos ? `<dt>Estacionamiento</dt><dd>${esc(d.estacionamientos)}</dd>` : ""}
${condiciones}
    <dt>Ubicación</dt><dd>${d.lat == null ? pend : d.aprox ? "Aproximada, por zona" : "Confirmada"}</dd>
  </dl>
  ${d.ventajas?.length ? `<h2>Lo mejor de aquí</h2><ul>${d.ventajas.map(v => `<li>${esc(v)}</li>`).join("")}</ul>` : ""}
  <h2>Lo que tienes cerca</h2>${cerca(d)}
  ${op === "nueva" ? "" : `<p>${op === "renta" ? "Antes de dar un depósito: visita el inmueble, confirma que quien lo renta es el dueño o su inmobiliaria y firma un contrato." : "Antes de dar cualquier anticipo: pide el certificado de libertad de gravamen reciente y que un notario revise las escrituras."}</p>`}
  <p>${quien}</p>
  <p>${d.fuentes?.length ? `Fuentes: ${d.fuentes.map(f => `<a href="${esc(f[1])}" rel="nofollow noopener" target="_blank">${esc(f[0])}</a>`).join(", ")}.` : "Datos que nos dio quien lo anuncia."} Precio verificado el ${fechaLarga(d.verificado)}.</p>
  <p><a class="btn" href="https://wa.me/526184463867?text=${encodeURIComponent(`Hola ARVENTA, quiero visitar ${d.nombre}.`)}">Agendar visita por WhatsApp</a></p>
</div>`;
}
function seoFicha(d, conImagen){
  const url = `${SITIO}/desarrollos/${d.id}/`;
  const op = opDe(d);
  const titulo = op === "renta" ? `${d.nombre} · ${tipoTexto(d).toLowerCase()} por ${dinero(d.desde)} al mes en Durango`
    : op === "reventa" ? `${d.nombre} · ${tipoTexto(d).toLowerCase()} en ${dinero(d.desde)} en Durango` : `${d.nombre} · ${TIPO[d.tipo]} desde ${dinero(d.desde)} en Durango`;
  const partes = [op === "renta" ? `${dinero(d.desde)} al mes` : op === "reventa" ? dinero(d.desde) : d.hasta ? `De ${dinero(d.desde)} a ${dinero(d.hasta)}` : `Desde ${dinero(d.desde)}`];
  if(/^\d/.test(d.recamaras)) partes.push(`${d.recamaras} recámaras`);
  if(d.m2 && !/confirmar/i.test(d.m2)) partes.push(d.m2);
  if(d.zona !== "Por confirmar") partes.push(d.zona);
  const desc = partes.join(" · ") + ". Mira qué tiene cerca y cuánto tardas a tu trabajo.";
  const tipoLugar = {casa:"SingleFamilyResidence", departamento:"Apartment", terreno:"Landform"}[d.tipo];
  const ld = {"@context":"https://schema.org", "@type":"RealEstateListing", name:d.nombre, url, description:desc, datePosted:d.verificado,
    offers:{"@type":"Offer", price:d.desde, priceCurrency:"MXN", availability:"https://schema.org/InStock",
      ...(op === "renta" ? {businessFunction:"http://purl.org/goodrelations/v1#LeaseOut", priceSpecification:{"@type":"UnitPriceSpecification", price:d.desde, priceCurrency:"MXN", unitCode:"MON", unitText:"mes"}}
        : d.hasta ? {priceSpecification:{"@type":"PriceSpecification", minPrice:d.desde, maxPrice:d.hasta, priceCurrency:"MXN"}} : {}),
      ...(d.anunciante?.tipo === "inmobiliaria" ? {seller:{"@type":"RealEstateAgent", name:d.anunciante.nombre}} : d.desarrolladora && op === "nueva" ? {seller:{"@type":"Organization", name:d.desarrolladora}} : {})},
    about:{"@type":tipoLugar === "Landform" ? "Place" : tipoLugar, name:d.nombre,
      address:{"@type":"PostalAddress", streetAddress:d.zona, addressLocality:"Durango", addressRegion:"Dgo.", addressCountry:"MX"},
      ...(d.lat != null && !d.aprox ? {geo:{"@type":"GeoCoordinates", latitude:d.lat, longitude:d.lng}} : {})},
    ...(conImagen ? {image:`${url}og.png`} : {})};
  return {titulo, html:`<!-- seo:inicio -->
<link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="ARVENTA"><meta property="og:locale" content="es_MX">
<meta property="og:title" content="${esc(titulo)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}">
${conImagen ? `<meta property="og:image" content="${url}og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(titulo)}"><meta name="twitter:card" content="summary_large_image">` : ""}
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
<!-- seo:fin -->`, desc};
}

// Imagen de vista previa (1200×630) dibujada con Chrome/Edge sin ventana
function buscarNavegador(){
  if(process.env.CHROME) return process.env.CHROME;
  return ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(p => existsSync(p));
}
function tarjeta(d){
  const datos = [tipoTexto(d)];
  if(/^\d/.test(d.recamaras)) datos.push(`${d.recamaras} recámaras`);
  if(d.m2 && !/confirmar/i.test(d.m2)) datos.push(d.m2.replace(/\s*\(.*\)$/, ""));
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Atkinson+Hyperlegible:wght@400;700&display=block" rel="stylesheet">
<style>*{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden}
body{background:#FBFBF8;color:#1D2B3A;font-family:"Atkinson Hyperlegible",sans-serif;border-top:20px solid #2F6B5E;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 80px;position:relative}
.g{font-family:"Bricolage Grotesque",sans-serif;font-weight:800}.marca{position:absolute;top:40px;font-size:30px;letter-spacing:.16em;color:#2F6B5E}
.datos{font-size:32px;color:#55636F;margin:0 0 14px}h1{font-size:${d.nombre.length > 24 ? 62 : 80}px;line-height:1.02;margin:0 0 30px}
.precio{font-size:92px;line-height:1;color:#B5654F}.precio small{font-size:40px;color:#55636F;font-family:"Atkinson Hyperlegible",sans-serif;font-weight:400}
.hasta{font-size:30px;color:#55636F;margin-top:12px}.pie{position:absolute;bottom:38px;font-size:28px;background:#FFF3D6;border-radius:999px;padding:10px 26px}</style></head><body>
<div class="g marca">ARVENTA</div><p class="datos">${esc(datos.join(" · "))}</p><h1 class="g">${esc(d.nombre)}</h1>
<div class="g precio">${opDe(d) === "renta" ? `${dinero(d.desde)}<small> al mes</small>` : opDe(d) === "reventa" ? dinero(d.desde) : `<small>desde </small>${dinero(d.desde)}`}</div>${d.hasta ? `<div class="hasta">hasta ${dinero(d.hasta)} según modelo</div>` : ""}
<div class="pie">Durango · Qué tiene cerca y cuánto tardas a tu trabajo</div></body></html>`;
}
const navegador = SIN_IMAGENES ? null : buscarNavegador();
const temporal = navegador ? mkdtempSync(path.join(os.tmpdir(), "arventa-")) : null;
let imagenes = 0;
// Plantilla: la portada, con la lista oculta y la ficha visible ya escrita
const plantilla = portada
  .replace('<nav class="categorias"', '<nav class="categorias" hidden')
  .replace('<main id="principal">', '<main id="principal" hidden>');
for(const d of lista){
  const carpeta = `desarrollos/${d.id}`;
  mkdirSync(path.join(RAIZ, carpeta), {recursive:true});
  if(navegador){
    try{
      const html = path.join(temporal, d.id + ".html");
      writeFileSync(html, tarjeta(d));
      execFileSync(navegador, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--force-device-scale-factor=1",
        "--window-size=1200,630", "--virtual-time-budget=5000", `--user-data-dir=${path.join(temporal, "perfil")}`,
        `--screenshot=${path.join(RAIZ, carpeta, "og.png")}`, pathToFileURL(html).href], {stdio:"ignore", timeout:60000});
      if(!existsSync(path.join(RAIZ, carpeta, "og.png"))) throw new Error("el navegador no generó la imagen");
      imagenes++;
    }catch(e){ console.warn(`! No se pudo dibujar la imagen de ${d.id}: ${e.message}`); }
  }
  const seo = seoFicha(d, existsSync(path.join(RAIZ, carpeta, "og.png")));
  const pagina = ponerSeo(plantilla, seo.html)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(seo.titulo)} · ARVENTA</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(seo.desc)}">`)
    .replace('<body>', `<body data-ficha="${d.id}">`)
    .replace(/<article class="ficha" id="ficha" hidden([^>]*)><\/article>/, `<article class="ficha" id="ficha"$1>${fichaEstatica(d)}</article>`);
  escribir(`${carpeta}/index.html`, pagina);
}
if(temporal) rmSync(temporal, {recursive:true, force:true});
// borrar páginas de desarrollos que ya no existen
const ids = new Set(lista.map(d => d.id));
if(existsSync(path.join(RAIZ, "desarrollos")))
  for(const c of readdirSync(path.join(RAIZ, "desarrollos"))) if(!ids.has(c)){ rmSync(path.join(RAIZ, "desarrollos", c), {recursive:true}); console.log(`Borré desarrollos/${c}/`); }

/* ---------- 6. sitemap.xml y robots.txt ---------- */
const urls = [[`${SITIO}/`, null], ...lista.map(d => [`${SITIO}/desarrollos/${d.id}/`, d.verificado]),
  [`${SITIO}/cotizador.html`, null], [`${SITIO}/anuncia.html`, null], [`${SITIO}/aviso-privacidad.html`, null], [`${SITIO}/terminos.html`, null]];
escribir("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(([u, f]) => `  <url><loc>${u}</loc>${f ? `<lastmod>${f}</lastmod>` : ""}</url>`).join("\n") + `\n</urlset>\n`);
escribir("robots.txt", `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /reporte.html\nDisallow: /cita/\nDisallow: /panel.html\n\nSitemap: ${SITIO}/sitemap.xml\n`);

console.log(`Listo: ${lista.length} páginas en desarrollos/, ${imagenes} imágenes nuevas, sitemap.xml y robots.txt. Sitio: ${SITIO}`);
if(!navegador && !SIN_IMAGENES) console.log("! No encontré Chrome ni Edge: las imágenes de vista previa no se actualizaron (define CHROME).");
