/* ARVENTA: buscador de vivienda nueva en Durango
   Vista principal: tarjetas con imágenes. El mapa es una vista alterna.
   Todo corre en el navegador; los datos viven en datos.js. */

/* ===== Configuración ===== */
// WhatsApp, hoja de Google, medición y datos legales se configuran en config.js
const WHATSAPP = window.ARVENTA?.WHATSAPP || "";
const CENTRO = {lat:24.0248, lng:-104.6705, nombre:"el Centro Histórico"};
const CAJA = {s:23.95, w:-104.77, n:24.10, e:-104.56};
const TASA_BANCO = 11.3;   // % anual de referencia; promedio reportado por Banxico en junio de 2026 (11.33%)
const PLAZO_BANCO = 20;    // años

/* ===== Datos ===== */
const DESARROLLOS = (window.DESARROLLOS || []).map(d => ({
  fotos: [], incluye: null, convenio: false, creditos: [], entrega: null, ...d
}));
const TIPO = {casa:"Casas", departamento:"Departamentos", terreno:"Terrenos"};
const TIPO_UNO = {casa:"Casa", departamento:"Departamento", terreno:"Terreno"};

const AMEN = {
  alberca:   {nombre:"Alberca", re:/alberca/i},
  vigilancia:{nombre:"Vigilancia o acceso controlado", re:/vigilan|caseta|control de acceso|acceso con tarjeta/i},
  gimnasio:  {nombre:"Gimnasio", re:/gimnas/i},
  verdes:    {nombre:"Áreas verdes", re:/verde|pista para correr/i},
  juegos:    {nombre:"Juegos infantiles", re:/juegos|ludoteca/i},
  canchas:   {nombre:"Canchas", re:/cancha|pádel|tenis/i},
};
function amenidades(d){
  const t = [d.nombre, ...(d.ventajas || [])].join(" ");
  return Object.keys(AMEN).filter(k => AMEN[k].re.test(t));
}

/* ===== Íconos de línea (mismo trazo en todo el sitio) ===== */
const ICONOS = {
  escuela:'<path d="M3 5.5c2.5-1 5.5-1 9 1 3.5-2 6.5-2 9-1V19c-2.5-1-5.5-1-9 1-3.5-2-6.5-2-9-1z"/><path d="M12 6.5V20"/>',
  oxxo:'<path d="M4 10v10h16V10M3 10l2-5h14l2 5zM10 20v-5h4v5"/>',
  super:'<circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/><path d="M3 4h2l2.4 11h11l2-8H6.2"/>',
  farmacia:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
  salud:'<path d="M4 21V5h16v16M9 21v-4h6v4M12 8v5M9.5 10.5h5"/>',
  parque:'<path d="M12 21v-6"/><path d="M12 3a5 5 0 0 0-5 5 4 4 0 0 0 1 7h8a4 4 0 0 0 1-7 5 5 0 0 0-5-5z"/>',
  uni:'<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/>',
  ubicacion:'<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  precio:'<path d="M3 7l6 6 4-4 8 8"/><path d="M21 11v6h-6"/>',
  alberca:'<path d="M2 17c2 0 2 1.5 4 1.5S8 17 10 17s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5M8 14V6a2 2 0 0 1 4 0M14 14V6a2 2 0 0 1 4 0M8 9h6M8 12h6"/>',
  vigilancia:'<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  gimnasio:'<path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12"/>',
  verdes:'<path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15M5 19l7-7"/>',
  juegos:'<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1.8 2 5.2 2 7 0M9 9.5h.01M15 9.5h.01"/>',
  canchas:'<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6c3.5 3.5 3.5 9.3 0 12.8M18.4 5.6c-3.5 3.5-3.5 9.3 0 12.8"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  trabajo:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  centro:'<path d="M4 21V10l8-6 8 6v11M9 21v-6h6v6"/>',
  hospital:'<path d="M4 21V5h16v16M9 21v-4h6v4M12 8v5M9.5 10.5h5"/>',
  compartir:'<path d="M12 4v11M7 9l5-5 5 5M5 14v5h14v-5"/>',
  enlace:'<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  mensaje:'<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/>',
  mas:'<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>'
};
function icono(nombre, clase = ""){
  return `<svg class="icono ${clase}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONOS[nombre] || ICONOS.check}</svg>`;
}

/* ===== Lugares cercanos (OpenStreetMap) ===== */
const CATS = {
  escuela: {nombre:"Escuela", f:1},
  oxxo:    {nombre:"OXXO"},
  super:   {nombre:"Supermercado"},
  farmacia:{nombre:"Farmacia", f:1},
  salud:   {nombre:"Hospital o clínica"},
  parque:  {nombre:"Parque"},
  uni:     {nombre:"Universidad", f:1}
};
/* Vienen de lugares.js (generado con `node actualizar-lugares.js`). Antes se consultaba Overpass
   en cada visita: tardaba minutos o fallaba, y mientras tanto los filtros de cercanía no servían. */
// Calculados en scripts/construir.mjs a partir de OpenStreetMap: no dependen de ningún servicio al cargar
const OSM = window.LUGARES || {fecha:"", porDesarrollo:{}, referencias:[]};
// Escuelas, hospitales y universidades con nombre, para "cerca de mi escuela / hospital"
const LUGARES = OSM.referencias.map(([cat, nombre, lat, lng]) => ({cat, nombre, lat, lng, nombrado:true}));
const CERCA_CACHE = new Map();

function cercanos(d){
  const p = OSM.porDesarrollo[d.id];
  if (!p || d.lat == null) return null;
  if (CERCA_CACHE.has(d.id)) return CERCA_CACHE.get(d.id);
  const mas = {};
  for (const [k, l] of Object.entries(p.mas)) mas[k] = {cat:k, ...l, nombre:l.nombre || CATS[k].nombre};
  const r = {mas, conteo:p.conteo};
  CERCA_CACHE.set(d.id, r);
  return r;
}
// Precio vencido: verificado hace más de 60 días (docs/REQUISITOS.md §2)
const DIAS_VIGENCIA = 60;
function vencido(d){ return !d.verificado || (Date.now() - new Date(d.verificado + "T12:00:00")) / 864e5 > DIAS_VIGENCIA; }
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
function fechaLarga(f){ const [a, m, d] = String(f).split("-").map(Number); return m ? `${d} de ${MESES[m - 1]} de ${a}` : "fecha por confirmar"; }

/* ===== Utilidades ===== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
function dinero(n){ return "$" + Math.round(n).toLocaleString("es-MX"); }
function corto(n){ return n >= 1e6 ? "$" + (n / 1e6).toLocaleString("es-MX", {maximumFractionDigits:2}) + " M" : "$" + Math.round(n / 1e3) + " mil"; }
function metros(a, b){
  const R = 6371000, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function textoDist(m){ return m < 1000 ? Math.round(m / 10) * 10 + " m" : (m / 1000).toLocaleString("es-MX", {maximumFractionDigits:1}) + " km"; }
function minCaminando(m){ return Math.max(1, Math.round(m * 1.3 / 80)); }
function minAuto(m){ return Math.max(2, Math.round(m * 1.35 / 1000 / 28 * 60)); }
function esc(s){ return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function normal(s){ return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
function m2Num(d){ const m = String(d.m2).match(/(\d+)/); return m ? +m[1] : null; }
function porM2(d){ const m = m2Num(d); return m && d.tipo !== "terreno" ? d.desde / m : null; }
function zonaCorta(d){ return d.zona.split(/[;,(]/)[0].trim(); }
// fetch con tiempo límite: un servicio que no contesta no debe dejar la página esperando
async function traer(url, opciones = {}, ms = 12000){
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, {...opciones, signal:ctl.signal}); } finally { clearTimeout(t); }
}
function toast(t, ms = 3500){ const e = $("#toast"); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => e.hidden = true, ms); }
function pago(monto, tasaAnual, anios){ const t = tasaAnual / 100 / 12, n = anios * 12; return t > 0 ? monto * t / (1 - Math.pow(1 + t, -n)) : monto / n; }
function creditoMax(mensual, tasaAnual, anios){ const t = tasaAnual / 100 / 12, n = anios * 12; return mensual * (1 - Math.pow(1 + t, -n)) / t; }
const PROM_M2 = {};
for (const t of ["casa", "departamento"]) {
  const v = DESARROLLOS.filter(d => d.tipo === t).map(porM2).filter(Boolean);
  PROM_M2[t] = v.reduce((a, b) => a + b, 0) / v.length;
}

/* ===== Ilustraciones (mientras no hay fotos de la desarrolladora) ===== */
function semilla(s){ let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; }
const CIELOS = [
  ["#A9D3E6", "#EAF4F7", "#F7FBFC"],  // mediodía
  ["#7FB3CF", "#CFE5EE", "#F3F0E6"],  // mañana
  ["#36557A", "#D98E58", "#F6C77B"],  // atardecer
  ["#5C8FB0", "#BFDCE8", "#EEF3EE"],  // nublado claro
];
const MUROS = ["#FFFFFF", "#F3EEE6", "#E7E2D8", "#DCE6E2", "#EFE6DA"];
function ilustracion(d, variante = 0){
  const rnd = semilla(d.id + ":" + variante);
  const cielo = CIELOS[(Math.floor(rnd() * 4) + variante) % 4];
  const gid = "g" + d.id.replace(/\W/g, "") + variante;
  const W = 400, H = 380, suelo = 290;
  let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Ilustración de ${esc(d.nombre)}">
  <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${cielo[0]}"/><stop offset=".7" stop-color="${cielo[1]}"/><stop offset="1" stop-color="${cielo[2]}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#${gid})"/>
  <circle cx="${60 + rnd() * 280}" cy="${50 + rnd() * 50}" r="${16 + rnd() * 10}" fill="#FFF6DA" opacity=".9"/>`;
  // sierra de Durango, dos capas
  const sierra = (y, amp, color, op) => {
    let p = `M0 ${y}`;
    for (let x = 0; x <= W; x += 40) p += ` L${x} ${y - rnd() * amp}`;
    return `<path d="${p} L${W} ${H} L0 ${H}Z" fill="${color}" opacity="${op}"/>`;
  };
  s += sierra(215, 70, "#7E9FA8", .55) + sierra(245, 45, "#5E8C80", .7);
  s += `<rect y="${suelo}" width="${W}" height="${H - suelo}" fill="#E6DECD"/><rect y="${suelo}" width="${W}" height="6" fill="#CFC5B0"/>`;
  const arbol = (x, y, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})"><rect x="-3" y="-18" width="6" height="22" fill="#6B5A45"/><circle cx="0" cy="-30" r="18" fill="#4F7D63"/><circle cx="-12" cy="-22" r="12" fill="#5E8C6E"/><circle cx="13" cy="-23" r="12" fill="#5E8C6E"/></g>`;
  if (d.tipo === "casa") {
    const n = 2 + Math.floor(rnd() * 2), ancho = n === 2 ? 130 : 104, x0 = (W - n * ancho - (n - 1) * 8) / 2;
    const techo = rnd() > .5 ? "#B5654F" : "#1D2B3A", dosPisos = d.desde > 2000000 || rnd() > .55;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (ancho + 8), alto = dosPisos ? 128 : 88, y = suelo - alto, muro = MUROS[Math.floor(rnd() * MUROS.length)];
      s += `<rect x="${x}" y="${y}" width="${ancho}" height="${alto}" fill="${muro}" stroke="#1D2B3A" stroke-opacity=".12"/>`;
      s += rnd() > .4
        ? `<path d="M${x - 8} ${y} L${x + ancho / 2} ${y - 42} L${x + ancho + 8} ${y}Z" fill="${techo}"/>`
        : `<rect x="${x - 6}" y="${y - 10}" width="${ancho + 12}" height="10" fill="${techo}"/>`;
      s += `<rect x="${x + ancho * .12}" y="${suelo - 52}" width="${ancho * .26}" height="52" fill="#2F6B5E"/>`;
      s += `<rect x="${x + ancho * .5}" y="${suelo - 58}" width="${ancho * .36}" height="30" fill="#BFDCE8" stroke="#1D2B3A" stroke-opacity=".25"/>`;
      if (dosPisos) s += `<rect x="${x + ancho * .2}" y="${y + 18}" width="${ancho * .6}" height="26" fill="#BFDCE8" stroke="#1D2B3A" stroke-opacity=".25"/><rect x="${x + ancho * .15}" y="${y + 44}" width="${ancho * .7}" height="4" fill="#1D2B3A" opacity=".5"/>`;
    }
    s += arbol(x0 - 26, suelo + 4, .9) + arbol(W - x0 + 26, suelo + 4, .8);
  } else if (d.tipo === "departamento") {
    const pisos = Math.min(12, 4 + Math.floor(d.desde / 600000) + Math.floor(rnd() * 3));
    const alto = Math.min(250, pisos * 20 + 20), ancho = 130 + rnd() * 30, x = (W - ancho) / 2, y = suelo - alto;
    const muro = MUROS[Math.floor(rnd() * MUROS.length)], acento = rnd() > .5 ? "#2F6B5E" : "#B5654F";
    s += `<rect x="${x}" y="${y}" width="${ancho}" height="${alto}" fill="${muro}" stroke="#1D2B3A" stroke-opacity=".14"/>`;
    s += `<rect x="${x + ancho - 22}" y="${y}" width="22" height="${alto}" fill="${acento}" opacity=".85"/>`;
    for (let p = 0; p < pisos; p++) {
      const fy = y + 12 + p * ((alto - 30) / pisos);
      for (let c = 0; c < 3; c++) s += `<rect x="${x + 12 + c * ((ancho - 46) / 3)}" y="${fy}" width="${(ancho - 46) / 3 - 8}" height="${(alto - 30) / pisos - 7}" fill="#BFDCE8" stroke="#1D2B3A" stroke-opacity=".2"/>`;
      s += `<rect x="${x + 6}" y="${fy + (alto - 30) / pisos - 6}" width="${ancho - 34}" height="2.5" fill="#1D2B3A" opacity=".45"/>`;
    }
    if (rnd() > .45) { const a2 = alto * .62, x2 = x - 78; s += `<rect x="${x2}" y="${suelo - a2}" width="70" height="${a2}" fill="${MUROS[1]}" stroke="#1D2B3A" stroke-opacity=".12"/>`; for (let p = 0; p < a2 / 24 - 1; p++) s += `<rect x="${x2 + 10}" y="${suelo - a2 + 10 + p * 24}" width="50" height="14" fill="#BFDCE8" opacity=".9"/>`; }
    s += arbol(x + ancho + 34, suelo + 4, .85) + arbol(x - 20, suelo + 4, .6);
  } else {
    s += `<path d="M60 ${suelo + 6} L340 ${suelo + 6} L370 ${H} L30 ${H}Z" fill="#CFE0C3"/>`;
    for (let i = 0; i < 6; i++) { const px = 70 + i * 52; s += `<rect x="${px}" y="${suelo - 14}" width="4" height="22" fill="#6B5A45"/><rect x="${px - 3}" y="${suelo - 16}" width="10" height="5" fill="#F0A202"/>`; }
    s += `<path d="M72 ${suelo - 6} H332" stroke="#6B5A45" stroke-width="2" stroke-dasharray="6 5"/>`;
    s += arbol(110, suelo + 2, 1) + arbol(300, suelo + 2, .8);
  }
  return s + `</svg>`;
}

/* Láminas informativas que acompañan a las imágenes en el carrusel */
// Fila de lugares cercanos para la tarjeta: ícono + distancia (el nombre queda para lectores de pantalla)
function cercaTarjeta(d){
  const c = cercanos(d);
  if (!c) return "";
  const items = ["escuela", "super", "oxxo", "farmacia", "salud", "parque"].filter(k => c.mas[k] && c.mas[k].m <= 2000).slice(0, 4);
  return items.length ? `<ul class="cerca-t">${items.map(k => `<li title="${CATS[k].nombre} más ${CATS[k].f ? "cercana" : "cercano"}">${icono(k)}<span class="sr">${CATS[k].nombre}: </span>${textoDist(c.mas[k].m)}</li>`).join("")}</ul>` : "";
}
function laminaCerca(d){
  const c = cercanos(d);
  if (!c) return null;
  const filas = ["escuela", "oxxo", "super", "farmacia", "salud", "parque"].filter(k => c.mas[k] && c.mas[k].m <= 3000).slice(0, 5)
    .map(k => `<li><span>${CATS[k].ico} ${CATS[k].nombre}</span><b>${textoDist(c.mas[k].m)}</b></li>`).join("");
  if (!filas) return null;
  return `<div class="lamina-datos"><h4>Lo que tienes cerca</h4><ul>${filas}</ul></div>`;
}
function laminaBasico(d){
  const pm = porM2(d);
  const filas = [
    d.tipo !== "terreno" ? `<li><span>Recámaras</span><b>${esc(d.recamaras)}</b></li>` : "",
    `<li><span>Tamaño</span><b>${esc(d.m2)}</b></li>`,
    pm ? `<li><span>Precio por m²</span><b>${dinero(pm)}</b></li>` : "",
    `<li><span>Mensualidad aprox.</span><b>${dinero(pago(d.desde * .8, TASA_BANCO, PLAZO_BANCO))}</b></li>`,
    d.creditos.length ? `<li><span>Créditos</span><b>${esc(d.creditos.slice(0, 2).join(", "))}${d.creditos.length > 2 ? "…" : ""}</b></li>` : ""
  ].join("");
  return `<div class="lamina-datos sol"><h4>${esc(TIPO[d.tipo])} desde ${corto(d.desde)}</h4><ul>${filas}</ul></div>`;
}
/* Fotos: "fotos/<id>/1.webp" o {archivo:"…", render:true}. Tamaño fijo (la página no brinca),
   carga diferida salvo la primera, y los renders llevan "Imagen ilustrativa" (NOM-247). */
function fotoHTML(d, f, i){
  const archivo = typeof f === "string" ? f : f.archivo, render = typeof f === "object" && f.render;
  return `<img src="/${esc(archivo.replace(/^\//, ""))}" alt="${render ? "Render" : "Foto"} de ${esc(d.nombre)}" width="1200" height="900" ${i ? 'loading="lazy" decoding="async"' : 'fetchpriority="high"'}>${render ? '<span class="ilustrativa">Imagen ilustrativa</span>' : ""}`;
}
function laminas(d){
  const l = [];
  d.fotos.forEach((f, i) => l.push(fotoHTML(d, f, i)));
  if (!d.fotos.length) l.push(ilustracion(d, 0) + `<span class="ilustrativa">Imagen ilustrativa</span>`);
  return l;
}

/* ===== Estado ===== */
const estado = {
  cat: "todo", q: "", max: null, presEtiqueta: null,
  recMin: 0, trabajo15: false, creditos: new Set(), amen: new Set(), cercaReq: new Set(), entrega: new Set(),
  ref: null,          // {tipo, lat, lng, nombre}
  orden: "cerca", vista: "lista"
};
let MINUTOS = {};
let FAV = new Set();
try { FAV = new Set(JSON.parse(localStorage.getItem("favoritos") || "[]")); } catch (e) {}
function guardarFav(){ try { localStorage.setItem("favoritos", JSON.stringify([...FAV])); } catch (e) {} }

const CATEGORIAS = [
  {id:"todo", nombre:"Todo", f:() => true, ico:'<path d="M4 11 12 4l8 7v9H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 20v-6h6v6" fill="none" stroke="currentColor" stroke-width="1.6"/>'},
  {id:"casa", nombre:"Casas", f:d => d.tipo === "casa", ico:'<path d="M3 12 9 7l6 5v8H3zM15 12l3-2.5 3 2.5v8h-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'},
  {id:"departamento", nombre:"Departamentos", f:d => d.tipo === "departamento", ico:'<rect x="6" y="3" width="12" height="18" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" stroke="currentColor" stroke-width="1.6"/>'},
  {id:"terreno", nombre:"Terrenos", f:d => d.tipo === "terreno", ico:'<path d="M3 18 8 8l4 6 3-4 6 8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'},
  {id:"economico", nombre:"Menos de $1.5 M", f:d => d.desde <= 1500000, ico:'<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.1 0-2-.4-2.5-1.2M12 6.5V8M12 16v1.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'},
  {id:"alberca", nombre:"Con alberca", f:d => amenidades(d).includes("alberca"), ico:'<path d="M3 17c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1M7 14V5a2 2 0 0 1 4 0M13 14V5a2 2 0 0 1 4 0M7 9h6M7 12h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'},
  {id:"privada", nombre:"Con vigilancia", f:d => amenidades(d).includes("vigilancia"), ico:'<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/>'},
  {id:"infonavit", nombre:"Acepta Infonavit", f:d => d.creditos.includes("Infonavit"), ico:'<rect x="4" y="6" width="16" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 10h16M7 14h4" stroke="currentColor" stroke-width="1.6"/>'},
  {id:"preventa", nombre:"Preventa", f:d => d.entrega === "Preventa", ico:'<path d="M5 20V9l7-5 7 5v11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.5 2.5"/><path d="M9 20v-5h6v5" fill="none" stroke="currentColor" stroke-width="1.6"/>'},
  {id:"guardados", nombre:"Guardados", f:d => FAV.has(d.id), ico:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'},
];

/* ===== Filtrado y orden ===== */
const CERCA_REQ = {
  escuela500:{nombre:"Escuela a menos de 500 m", cat:"escuela", m:500},
  oxxo500:{nombre:"OXXO a menos de 500 m", cat:"oxxo", m:500},
  super1000:{nombre:"Supermercado a menos de 1 km", cat:"super", m:1000},
  parque500:{nombre:"Parque a menos de 500 m", cat:"parque", m:500},
  salud2000:{nombre:"Hospital o clínica a menos de 2 km", cat:"salud", m:2000},
};
function recMin(d){ const m = String(d.recamaras).match(/\d+/); return m ? +m[0] : 0; }
function recMaxNum(d){ const m = String(d.recamaras).match(/\d+/g); return m ? Math.max(...m.map(Number)) : 0; }
function pasa(d){
  const cat = CATEGORIAS.find(c => c.id === estado.cat);
  if (cat && !cat.f(d)) return false;
  if (estado.q) {
    const t = normal([d.nombre, d.zona, TIPO[d.tipo], d.desarrolladora].join(" "));
    if (!normal(estado.q).split(/\s+/).every(p => t.includes(p))) return false;
  }
  if (estado.max && d.desde > estado.max) return false;
  if (estado.recMin && d.tipo !== "terreno" && recMaxNum(d) < estado.recMin) return false;
  for (const c of estado.creditos) if (!d.creditos.includes(c)) return false;
  const am = amenidades(d);
  for (const a of estado.amen) if (!am.includes(a)) return false;
  if (estado.entrega.size && !estado.entrega.has(d.entrega || "Por confirmar")) return false;
  if (estado.trabajo15 && estado.ref?.tipo === "trabajo" && !(MINUTOS[d.id] < 15)) return false;
  if (estado.cercaReq.size) {
    const c = cercanos(d);
    if (!c) return false;
    for (const k of estado.cercaReq) { const r = CERCA_REQ[k], l = c.mas[r.cat]; if (!l || l.m > r.m) return false; }
  }
  return true;
}
function distanciaRef(d){
  if (d.lat == null) return null;
  if (estado.ref?.tipo === "trabajo" && MINUTOS[d.id] != null) return MINUTOS[d.id] * 500; // minutos convertidos para ordenar
  return metros(d, estado.ref || CENTRO);
}
function ordenar(l){
  const o = estado.orden;
  return [...l].sort((a, b) => {
    if (o === "barato") return a.desde - b.desde;
    if (o === "m2") return (porM2(a) ?? 1e9) - (porM2(b) ?? 1e9);
    const x = distanciaRef(a), y = distanciaRef(b);
    if (x == null && y == null) return a.desde - b.desde;
    if (x == null) return 1; if (y == null) return -1;
    return x - y;
  });
}
function etiquetaCercania(d){
  if (d.lat == null) return "Ubicación por confirmar";
  if (estado.ref?.tipo === "trabajo" && MINUTOS[d.id] != null) return `${MINUTOS[d.id]} min`;
  if (estado.ref) return textoDist(metros(d, estado.ref));
  return "";
}
function loBueno(d){
  const c = cercanos(d), partes = [];
  const am = amenidades(d);
  if (am.includes("alberca")) partes.push("Alberca");
  else if (am.includes("vigilancia")) partes.push("Vigilancia");
  const pm = porM2(d);
  if (partes.length < 2 && pm && pm < PROM_M2[d.tipo] * .9) partes.push(`m² ${Math.round((1 - pm / PROM_M2[d.tipo]) * 100)}% abajo del promedio`);
  return partes.slice(0, 2).join(" · ");
}

/* ===== Tarjetas ===== */
function tarjeta(d){
  const l = laminas(d);
  const cerc = etiquetaCercania(d);
  const pm = porM2(d), am = amenidades(d);
  const ins = pm && pm < PROM_M2[d.tipo] * .85 ? "Buen precio por m²" : d.desde <= 1000000 ? "Menos de $1 M" : am.includes("alberca") ? "Con alberca" : "";
  const bueno = loBueno(d);
  return `<div class="tarjeta" data-id="${d.id}">
    <div class="galeria">
      <div class="carril">${l.map(x => `<div class="lamina">${x}</div>`).join("")}</div>
      ${ins ? `<span class="insignia">${ins}</span>` : ""}
      <button class="guardar" type="button" aria-label="Guardar ${esc(d.nombre)}" aria-pressed="${FAV.has(d.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg></button>
      ${l.length > 1 ? `<button class="flecha izq" type="button" aria-label="Imagen anterior"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="2.6"/></svg></button>
      <button class="flecha der" type="button" aria-label="Imagen siguiente"><svg viewBox="0 0 24 24" width="14" height="14"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6"/></svg></button>
      <div class="puntos">${l.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` : ""}
    </div>
    <div class="info">
      <div class="l1"><h3><a class="titulo-enlace" href="/desarrollos/${d.id}/">${esc(d.nombre)}</a></h3>${cerc ? `<span class="cercania">${cerc}</span>` : ""}</div>
      <p class="gris">${esc(TIPO[d.tipo])} · ${esc(zonaCorta(d))}</p>
      <p class="datos-t">${[d.tipo !== "terreno" && /^\d/.test(d.recamaras) ? `${esc(d.recamaras)} rec.` : "", esc(d.m2.replace(/\s*\(.*\)$/, "")), pm ? `${dinero(pm)}/m²` : ""].filter(Boolean).join(" · ")}</p>
      ${cercaTarjeta(d)}
      ${bueno ? `<p class="bueno">${esc(bueno)}</p>` : ""}
      <p class="precio">${vencido(d) ? "<b>Precio por confirmar</b>" : `desde <b>${corto(d.desde)}</b><span class="mensual-t"> · aprox. ${dinero(pago(d.desde * .8, TASA_BANCO, PLAZO_BANCO))} al mes</span>`}</p>
      <div class="pie-tarjeta">${PERFIL ? (([cls, txt]) => `<span class="alc ${cls}">${txt}</span>`)(etiquetaAlcance(d)) : ""}${botonComparar(d)}</div>
    </div>
  </div>`;
}
function botonComparar(d, claseExtra = ""){
  const en = COMPARAR.includes(d.id);
  return `<button class="cmp ${claseExtra}" type="button" data-comparar="${esc(d.id)}" aria-pressed="${en}">${en ? "✓ Comparando" : "+ Comparar"}</button>`;
}

/* ===== Comparador: 2 o 3 desarrollos lado a lado ===== */
const MAX_COMPARAR = 3;
let COMPARAR = [];
try { COMPARAR = (JSON.parse(localStorage.getItem("arventa-comparar")) || []).filter(id => DESARROLLOS.some(d => d.id === id)).slice(0, MAX_COMPARAR); } catch (e) {}
function alternarComparar(id){
  const i = COMPARAR.indexOf(id);
  if (i >= 0) COMPARAR.splice(i, 1);
  else if (COMPARAR.length >= MAX_COMPARAR) { toast(`Puedes comparar hasta ${MAX_COMPARAR}. Quita uno para agregar otro.`); return; }
  else COMPARAR.push(id);
  sincronizarComparar();
}
function sincronizarComparar(){
  try { localStorage.setItem("arventa-comparar", JSON.stringify(COMPARAR)); } catch (e) {}
  $$("[data-comparar]").forEach(b => { const en = COMPARAR.includes(b.dataset.comparar); b.setAttribute("aria-pressed", en); b.textContent = en ? "✓ Comparando" : "+ Comparar"; });
  pintarBarraComparar();
  if ($("#dlg-comparar").open) { if (COMPARAR.length < 2) $("#dlg-comparar").close(); else verComparar(); }
}
function pintarBarraComparar(){
  const b = $("#barra-comparar"), n = COMPARAR.length;
  b.hidden = !n || document.body.classList.contains("en-ficha");
  document.body.classList.toggle("comparando", !b.hidden);
  if (b.hidden) return;
  b.innerHTML = `<div class="txt">${n === 1 ? "Elige otro para comparar" : `${n} desarrollos elegidos`}<small>${COMPARAR.map(id => esc(DESARROLLOS.find(d => d.id === id).nombre)).join(" · ")}</small></div>
    <button type="button" class="btn claro" id="limpiar-comparar">Limpiar</button>
    <button type="button" class="btn" id="ver-comparar"${n < 2 ? " disabled" : ""}>Comparar</button>`;
  $("#limpiar-comparar").onclick = () => { COMPARAR = []; sincronizarComparar(); };
  $("#ver-comparar").onclick = () => { medir("comparar", {cuantos:COMPARAR.length}); verComparar(); };
}
function verComparar(){
  const ds = COMPARAR.map(id => DESARROLLOS.find(d => d.id === id));
  if (ds.length < 2) return;
  const cs = ds.map(cercanos), trabajo = estado.ref?.tipo === "trabajo";
  // Cada renglón: los de valor más bajo (precio, distancia, minutos) se marcan en verde
  const renglon = (titulo, vals, marcar = true) => {
    const nums = vals.map(v => v.num).filter(n => n != null), min = Math.min(...nums);
    const marca = marcar && nums.length >= 2 && Math.max(...nums) > min;
    return `<div class="cmp-et">${titulo}</div>` + vals.map(v => { const m = marca && v.num === min; return `<div class="cmp-v${m ? " mejor" : ""}">${v.txt}${m ? '<span class="sr"> (el mejor)</span>' : ""}</div>`; }).join("");
  };
  let h = `<div class="cmp-tabla" style="--n:${ds.length}">` + ds.map(d => `<div class="cmp-cab"><h3>${esc(d.nombre)}</h3><small>${esc(TIPO[d.tipo])}</small>
    <div class="acc"><a class="btn" href="/desarrollos/${esc(d.id)}/">Ver</a><button type="button" class="btn claro" data-comparar="${esc(d.id)}" aria-label="Quitar ${esc(d.nombre)}">Quitar</button></div></div>`).join("");
  h += renglon("Precio desde", ds.map(d => ({txt:`${dinero(d.desde)}${d.hasta ? `<small>hasta ${dinero(d.hasta)}</small>` : ""}`, num:d.desde})));
  h += renglon("Precio por m²", ds.map(d => { const p = porM2(d); return p ? {txt:`${dinero(p)}<small>${m2Num(d)} m²</small>`, num:p} : {txt:d.tipo === "terreno" ? "Terreno" : "Sin dato", num:null}; }));
  h += renglon("Recámaras", ds.map(d => ({txt:d.tipo === "terreno" ? "—" : esc(d.recamaras), num:null})), false);
  h += renglon("Créditos confirmados", ds.map(d => ({txt:d.creditos.length ? esc(d.creditos.join(", ")) : "Por confirmar", num:null})), false);
  h += renglon("Entrega", ds.map(d => ({txt:d.entrega ? esc(d.entrega) : "Por confirmar", num:null})), false);
  if (PERFIL) h += renglon("Con tu presupuesto", ds.map(d => ({txt:etiquetaAlcance(d)[1], num:null})), false);
  if (trabajo) h += renglon(`Minutos a ${esc(estado.ref.nombre)}`, ds.map(d => MINUTOS[d.id] != null ? {txt:`${MINUTOS[d.id]} min en auto`, num:MINUTOS[d.id]} : {txt:d.lat == null ? "Sin ubicación" : "Calculando…", num:null}));
  else h += `<div class="cmp-et">Minutos a tu trabajo</div><div class="cmp-v" style="grid-column:1/-1"><button type="button" class="enlace" id="cmp-trabajo">Dinos dónde trabajas</button> para compararlos.</div>`;
  for (const k of ["escuela", "super", "oxxo", "farmacia", "salud", "parque"]) {
    h += renglon(`<span class="et-ico">${icono(k)}</span>${CATS[k].nombre} más ${CATS[k].f ? "cercana" : "cercano"}`, ds.map((d, i) => {
      const l = cs[i]?.mas[k];
      return l ? {txt:`${textoDist(l.m)}<small>${esc(l.nombre)}</small>`, num:l.m} : {txt:d.lat == null ? "Sin ubicación" : "Sin dato", num:null};
    }));
  }
  h += `</div><p class="nota">En verde, lo mejor de cada renglón. Precio por m² = precio “desde” ÷ m² del modelo más chico. Distancias en línea recta según OpenStreetMap.</p>`;
  $("#comparar-cuerpo").innerHTML = h;
  $("#cmp-trabajo")?.addEventListener("click", () => { $("#dlg-comparar").close(); abrirCerca("trabajo"); });
  if (!$("#dlg-comparar").open) $("#dlg-comparar").showModal();
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-comparar]");
  if (b) { e.stopPropagation(); alternarComparar(b.dataset.comparar); return; }
  if (e.target.closest("[data-cerrar-comparar]")) $("#dlg-comparar").close();
});
function activarTarjetas(raiz){
  raiz.querySelectorAll(".tarjeta").forEach(t => {
    const id = t.dataset.id, carril = t.querySelector(".carril"), puntos = t.querySelectorAll(".puntos i");
    t.addEventListener("click", e => {
      if (e.target.closest("button")) return;
      if (e.target.closest("a")) return; // el enlace ya navega
      irA(id);
    });
    const mover = dir => carril.scrollBy({left: dir * carril.clientWidth, behavior: "smooth"});
    t.querySelector(".flecha.izq")?.addEventListener("click", () => mover(-1));
    t.querySelector(".flecha.der")?.addEventListener("click", () => mover(1));
    carril.addEventListener("scroll", () => {
      const i = Math.round(carril.scrollLeft / carril.clientWidth);
      puntos.forEach((p, k) => p.classList.toggle("on", k === i));
    }, {passive:true});
    const g = t.querySelector(".guardar");
    g.addEventListener("click", () => {
      FAV.has(id) ? FAV.delete(id) : FAV.add(id);
      g.setAttribute("aria-pressed", FAV.has(id)); guardarFav();
      toast(FAV.has(id) ? "Guardado. Lo encuentras en “Guardados”." : "Quitado de tus guardados.");
      pintarCategorias();
    });
  });
}

/* ===== Pintar resultados ===== */
function pintarCategorias(){
  $("#cats").innerHTML = CATEGORIAS.filter(c => c.id !== "guardados" || FAV.size).map(c =>
    `<button class="cat" type="button" data-cat="${c.id}" aria-pressed="${estado.cat === c.id}"><svg viewBox="0 0 24 24" aria-hidden="true">${c.ico}</svg>${c.nombre}</button>`).join("");
  $$(".cat").forEach(b => b.onclick = () => { estado.cat = b.dataset.cat; pintarCategorias(); pintar(); });
}
function pintar(){
  const l = ordenar(DESARROLLOS.filter(pasa));
  const cat = CATEGORIAS.find(c => c.id === estado.cat);
  const quien = estado.cat === "todo" ? "Vivienda nueva" : cat.nombre;
  $("#titulo-res").textContent = `${l.length} ${l.length === 1 ? "desarrollo" : "desarrollos"}${estado.cat === "todo" ? "" : " · " + cat.nombre} en Durango`;
  // contexto: desde dónde se ordena
  let ctx = "";
  if (estado.orden === "cerca") {
    if (!estado.ref) ctx = `Ordenado desde el Centro. <button type="button" class="enlace" id="ctx-ubicacion">Ver lo más cerca de mí</button> o <button type="button" class="enlace" id="ctx-trabajo">de mi trabajo</button>.`;
    else if (estado.ref.tipo === "trabajo") ctx = `Ordenado por minutos en auto a <b>${esc(estado.ref.nombre)}</b>.`;
    else ctx = `Ordenado por distancia a <b>${esc(estado.ref.nombre)}</b>.`;
  } else if (estado.orden === "m2") ctx = "Ordenado por precio por metro cuadrado, del más bajo al más alto.";
  if (estado.max) ctx += ` Hasta <b>${dinero(estado.max)}</b>.`;
  if (estado.cercaReq.size && !LUGARES.length) ctx += " Los filtros de cercanía no están disponibles por ahora.";
  $("#contexto").innerHTML = ctx;
  $("#ctx-ubicacion")?.addEventListener("click", usarUbicacion);
  $("#ctx-trabajo")?.addEventListener("click", () => abrirCerca("trabajo"));
  $("#rejilla").innerHTML = l.length ? l.map(tarjeta).join("") :
    `<div class="vacio"><h2>No hay desarrollos con esa búsqueda</h2><p>Quita algún filtro o sube tu presupuesto.</p><button class="btn" type="button" id="limpiar-todo">Quitar filtros</button></div>`;
  $("#limpiar-todo")?.addEventListener("click", limpiarTodo);
  activarTarjetas($("#rejilla"));
  if (estado.vista === "mapa") pintarPines(l);
  const n = estado.creditos.size + estado.amen.size + estado.cercaReq.size + estado.entrega.size + (estado.recMin ? 1 : 0) + (estado.trabajo15 && estado.ref?.tipo === "trabajo" ? 1 : 0);
  pintarBarraComparar();
  $("#n-filtros").hidden = !n; $("#n-filtros").textContent = n;
  // resumen del buscador
  $("#val-cerca").textContent = estado.ref ? estado.ref.nombre : "Mi ubicación, trabajo o escuela";
  $("#abrir-cerca").classList.toggle("activo", !!estado.ref);
  const pres = estado.max ? "Hasta " + corto(estado.max) : "Cualquier precio";
  $("#val-presupuesto").textContent = pres; $("#val-presupuesto-2").textContent = pres;
  $("#abrir-presupuesto").classList.toggle("activo", !!estado.max);
  $("#resumen-movil").textContent = `${estado.q || (estado.ref ? "Cerca de " + estado.ref.nombre : "Cualquier zona")} · ${pres}`;
}
function limpiarTodo(){
  Object.assign(estado, {cat:"todo", q:"", max:null, recMin:0, trabajo15:false});
  ["creditos", "amen", "cercaReq", "entrega"].forEach(k => estado[k].clear());
  $("#q").value = ""; $("#q2").value = "";
  pintarCategorias(); pintarFiltros(); pintar();
}

/* ===== Cerca de… ===== */
function ponerRef(ref){
  estado.ref = ref; estado.orden = "cerca"; $("#orden").value = "cerca";
  // Zona redondeada a ~1 km: nunca la ubicación exacta
  if (ref?.tipo === "trabajo") medir("zona-trabajo", {lat:Math.round(ref.lat * 100) / 100, lng:Math.round(ref.lng * 100) / 100});
  MINUTOS = {};
  if (marcaRef) { marcaRef.remove(); marcaRef = null; }
  pintar();
  if (ref?.tipo === "trabajo") calcularTiempos().then(pintar);
  if (mapa && ref) ponerMarcaRef();
}
function usarUbicacion(){
  if (!navigator.geolocation) { toast("Tu navegador no permite usar la ubicación. Escribe tu zona o elige un lugar."); return; }
  toast("Buscando tu ubicación…");
  navigator.geolocation.getCurrentPosition(p => {
    const r = {tipo:"ubicacion", lat:p.coords.latitude, lng:p.coords.longitude, nombre:"tu ubicación"};
    if (metros(r, CENTRO) > 40000) toast("Estás lejos de Durango; ordenamos desde tu ubicación de todos modos.");
    else $("#toast").hidden = true;
    ponerRef(r); $("#dlg-cerca").open && $("#dlg-cerca").close();
  }, () => toast("No pudimos usar tu ubicación. Revisa el permiso del navegador o elige un lugar."), {timeout:10000});
}
function abrirCerca(sub){
  $("#sub-trabajo").hidden = sub !== "trabajo";
  $("#sub-lugar").hidden = !(sub === "escuela" || sub === "hospital");
  $("#msg-cerca").textContent = "";
  $$(".op[data-cerca]").forEach(b => b.setAttribute("aria-pressed", b.dataset.cerca === (sub || estado.ref?.tipo)));
  if (sub === "escuela" || sub === "hospital") prepararLugar(sub);
  if (!$("#dlg-cerca").open) $("#dlg-cerca").showModal();
  if (sub === "trabajo") $("#in-trabajo").focus();
}
let tipoLugar = "escuela";
function prepararLugar(tipo){
  tipoLugar = tipo;
  const cat = tipo === "escuela" ? "escuela" : "salud";
  $("#lbl-lugar").textContent = tipo === "escuela" ? "Nombre de la escuela" : "Nombre del hospital o clínica";
  $("#in-lugar").value = "";
  if (!LUGARES.length) { $("#msg-cerca").textContent = "Por ahora no tenemos la lista de escuelas y hospitales. Usa tu ubicación o márcalo en el mapa."; return; }
  const nombres = [...new Set(LUGARES.filter(l => l.cat === cat && l.nombrado).map(l => l.nombre))].sort((a, b) => a.localeCompare(b, "es"));
  $("#lista-lugares").innerHTML = nombres.map(n => `<option value="${esc(n)}">`).join("");
}
async function geocodificar(q){
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.search = new URLSearchParams({q:q + ", Durango, Durango, México", format:"json", limit:"1", countrycodes:"mx",
    viewbox:`${CAJA.w},${CAJA.n},${CAJA.e},${CAJA.s}`, bounded:"1"});
  const r = await traer(u, {headers:{"Accept-Language":"es"}}, 10000);
  const j = await r.json();
  return j[0] ? {lat:+j[0].lat, lng:+j[0].lon} : null;
}
async function calcularTiempos(){
  const con = DESARROLLOS.filter(d => d.lat != null), ref = estado.ref;
  try {
    const coords = [[ref.lng, ref.lat], ...con.map(d => [d.lng, d.lat])].map(c => c.join(",")).join(";");
    const fuentes = con.map((_, i) => i + 1).join(";");
    const r = await traer(`https://router.project-osrm.org/table/v1/driving/${coords}?sources=${fuentes}&destinations=0&annotations=duration`);
    const j = await r.json();
    if (j.code !== "Ok") throw new Error(j.code);
    con.forEach((d, i) => { const s = j.durations[i][0]; if (s != null) MINUTOS[d.id] = Math.max(1, Math.round(s / 60)); });
  } catch (e) {
    con.forEach(d => { MINUTOS[d.id] = minAuto(metros(d, ref)); });
    toast("Tiempos aproximados por distancia: el servicio de rutas no respondió.");
  }
}

/* ===== Presupuesto ===== */
const TOPES = [1000000, 1500000, 2000000, 3000000, 5000000];
function pintarPresupuesto(){
  $("#chips-pres").innerHTML = TOPES.map(t => `<button type="button" class="chip" data-max="${t}" aria-pressed="${estado.max === t && !estado.presEtiqueta}">Hasta ${corto(t)}</button>`).join("");
  $$("#chips-pres .chip").forEach(b => b.onclick = () => { estado.max = +b.dataset.max; estado.presEtiqueta = null; $("#res-alcance").textContent = ""; pintarPresupuesto(); pintar(); });
}
/* ===== ¿Qué me alcanza? Banco e Infonavit =====
   Supuestos de noviembre de 2026. Si cambian las tasas o el tope, cámbialos aquí: la explicación
   que ve la persona se arma con estos mismos números.
   Fórmula del crédito: crédito = pago × (1 − (1 + i)^−n) ÷ i, con i = tasa anual ÷ 12 y n = meses. */
const SUPUESTOS = {
  bancoPorcentaje:.30,  // la mensualidad no debe pasar de 30% del ingreso (criterio común de los bancos)
  engancheMin:.10,      // enganche mínimo que pide el banco
  gastos:.06,           // escrituración, avalúo y comisión de apertura, aprox. % del precio
  infPorcentaje:.30,    // Infonavit descuenta de la nómina hasta 30% del sueldo
  infPlazo:30,
  infTasaMin:3.69, infSueldoMin:9272,    // tasa para sueldos de hasta $9,272 al mes
  infTasaMax:10.45, infSueldoMax:23537,  // tasa para sueldos de $23,537 al mes o más
  infTope:2935002       // monto máximo de crédito Infonavit 2026 (DOF, 13 de mayo de 2026)
};
let PERFIL = null; // {sueldo, ahorro, subcuenta}; se guarda solo en este navegador
try { PERFIL = JSON.parse(localStorage.getItem("arventa-perfil")); } catch (e) {}
function tasaInfonavit(s){
  const S = SUPUESTOS;
  if (s <= S.infSueldoMin) return S.infTasaMin;
  if (s >= S.infSueldoMax) return S.infTasaMax;
  return S.infTasaMin + (S.infTasaMax - S.infTasaMin) * (s - S.infSueldoMin) / (S.infSueldoMax - S.infSueldoMin);
}
function capacidad(p){
  const S = SUPUESTOS;
  const bPago = p.sueldo * S.bancoPorcentaje, bCredito = creditoMax(bPago, TASA_BANCO, PLAZO_BANCO);
  const porSueldo = (bCredito + p.ahorro) / (1 + S.gastos), porAhorro = p.ahorro / (S.engancheMin + S.gastos);
  const tasa = tasaInfonavit(p.sueldo), iPago = p.sueldo * S.infPorcentaje, iCalc = creditoMax(iPago, tasa, S.infPlazo);
  const iCredito = Math.min(iCalc, S.infTope);
  return {
    banco:{pago:bPago, credito:bCredito, porSueldo, porAhorro, max:Math.min(porSueldo, porAhorro)},
    inf:{tasa, pago:iPago, calculado:iCalc, credito:iCredito, topado:iCalc > S.infTope, max:(iCredito + p.subcuenta + p.ahorro) / (1 + S.gastos)}
  };
}
function alcance(d){
  const c = capacidad(PERFIL);
  return {banco:d.desde <= c.banco.max, inf:d.desde <= c.inf.max, falta:d.desde - Math.max(c.banco.max, c.inf.max)};
}
function etiquetaAlcance(d){
  const a = alcance(d);
  if (a.banco && a.inf) return ["si", "En tu presupuesto"];
  if (a.banco) return ["si", "En tu presupuesto con banco"];
  if (a.inf) return ["si", "En tu presupuesto con Infonavit"];
  return ["no", "Arriba de tu presupuesto"];
}
const pct = x => (x * 100).toLocaleString("es-MX", {maximumFractionDigits:2}) + "%";
function htmlExplicacion(){
  const S = SUPUESTOS, p = PERFIL, c = capacidad(p), b = c.banco, i = c.inf, k = (1 + S.gastos).toFixed(2);
  return `<details class="como"><summary>¿Cómo lo calculamos?</summary>
    <h4>Con banco</h4><ol>
      <li>Los bancos piden que la mensualidad no pase de ${pct(S.bancoPorcentaje)} de tu ingreso: ${pct(S.bancoPorcentaje)} × ${dinero(p.sueldo)} = <b>${dinero(b.pago)} al mes</b>.</li>
      <li>Con esa mensualidad, a ${PLAZO_BANCO} años y ${TASA_BANCO}% anual, el banco te presta hasta <b>${dinero(b.credito)}</b>. <span class="formula">crédito = pago × (1 − (1 + i)<sup>−n</sup>) ÷ i</span>, con i = ${TASA_BANCO}% ÷ 12 y n = ${PLAZO_BANCO * 12} meses.</li>
      <li>Tu ahorro tiene que cubrir el enganche mínimo (${pct(S.engancheMin)}) y los gastos de escrituración (≈${pct(S.gastos)}): ${dinero(p.ahorro)} ÷ ${pct(S.engancheMin + S.gastos)} = vivienda de hasta <b>${dinero(b.porAhorro)}</b>.</li>
      <li>Por tu ingreso: (crédito + ahorro) ÷ ${k} = <b>${dinero(b.porSueldo)}</b>.</li>
      <li>Tu presupuesto con banco es el menor de los dos: <b>${dinero(b.max)}</b> (te limita ${b.porAhorro < b.porSueldo ? "el ahorro" : "el ingreso"}).</li>
    </ol>
    <h4>Con Infonavit</h4><ol>
      <li>Infonavit descuenta de tu nómina hasta ${pct(S.infPorcentaje)} del sueldo: <b>${dinero(i.pago)} al mes</b>.</li>
      <li>Su tasa va de ${S.infTasaMin}% (sueldos hasta ${dinero(S.infSueldoMin)}) a ${S.infTasaMax}% (desde ${dinero(S.infSueldoMax)}). ${p.sueldo > S.infSueldoMin && p.sueldo < S.infSueldoMax ? "Entre esos sueldos la estimamos en proporción; para ti" : "Para ti"}: <b>${i.tasa.toFixed(2)}%</b>.</li>
      <li>${i.topado ? `Con la misma fórmula, a ${S.infPlazo} años, saldría ${dinero(i.calculado)}, pero Infonavit presta como máximo ${dinero(S.infTope)}.` : `Con la misma fórmula, a ${S.infPlazo} años, Infonavit te presta hasta <b>${dinero(i.credito)}</b> (su tope es ${dinero(S.infTope)}).`}</li>
      <li>Vivienda de hasta: (crédito + subcuenta + ahorro) ÷ ${k} = <b>${dinero(i.max)}</b>.</li>
    </ol>
    <p class="nota">Es una estimación. El banco también revisa tu historial y tus deudas; Infonavit, tu edad y tu antigüedad. Juntando Infonavit y banco (Cofinavit) te puede alcanzar más. Confirma tu monto en la precalificación de <a href="https://micuenta.infonavit.org.mx/" target="_blank" rel="noopener">Mi Cuenta Infonavit</a> o con tu banco.</p>
  </details>`;
}
// Veredicto para un desarrollo: si el anuncio no confirma ese crédito, no se promete
function htmlAlcanceFicha(d){
  if (!PERFIL) return `<p class="nota" style="margin:0"><button type="button" class="enlace" id="f-alcanza">Calcula tu presupuesto</button> con tu ingreso y tu ahorro, y te mostramos cómo podrías pagarlo con banco o con Infonavit.</p>`;
  const S = SUPUESTOS, P = d.desde, c = capacidad(PERFIL), g = P * S.gastos, ah = PERFIL.ahorro, sub = PERFIL.subcuenta;
  const acepta = k => !d.creditos.length || d.creditos.includes(k);
  const bOk = P <= c.banco.max, iOk = P <= c.inf.max;
  const bCred = Math.min(P * (1 - S.engancheMin), Math.max(0, P + g - ah)), iCred = Math.max(0, P + g - ah - sub);
  const bTxt = bOk ? (bCred <= 0 ? "Tu ahorro cubre el precio y los gastos." : `Pones ${dinero(P + g - bCred)} de tu ahorro y el banco te presta ${dinero(bCred)}: unos <b>${dinero(pago(bCred, TASA_BANCO, PLAZO_BANCO))} al mes</b> a ${PLAZO_BANCO} años.`)
    : P > c.banco.porAhorro ? `Para enganche y gastos se necesitan unos ${dinero(P * (S.engancheMin + S.gastos))}; con lo que llevas ahorrado (${dinero(ah)}) sería cuestión de reunir la diferencia.`
    : `El crédito necesario (${dinero(bCred)}) es mayor al que calculamos con tu ingreso (${dinero(c.banco.credito)}). Un enganche mayor o juntar Infonavit y banco (Cofinavit) puede ayudarte.`;
  const iTxt = iOk ? (iCred <= 0 ? "Tu ahorro y tu subcuenta cubren el precio y los gastos." : `Infonavit te presta ${dinero(iCred)}: unos <b>${dinero(pago(iCred, c.inf.tasa, S.infPlazo))} al mes</b> a ${S.infPlazo} años, descontados de tu nómina.`)
    : `El crédito necesario (${dinero(iCred)}) es mayor al que calculamos con tu sueldo (${dinero(c.inf.credito)}). Con Cofinavit o un enganche mayor podrías acercarte.`;
  const nota = k => acepta(k) ? "" : ` <i>Su anuncio no confirma ${k === "Banco" ? "crédito bancario" : k}: pregunta si lo acepta.</i>`;
  const item = (ok, t, x) => `<li><span class="${ok ? "ok" : "nok"}">${icono(ok ? "check" : "info")}</span><span><b>${t}.</b> ${x}</span></li>`;
  return `<ul class="veredicto">${item(bOk, "Con banco", bTxt + nota("Banco"))}${item(iOk, "Con Infonavit", iTxt + nota("Infonavit"))}</ul>
    <p class="nota">Con el precio “desde”, tu ingreso de ${dinero(PERFIL.sueldo)} y tu ahorro de ${dinero(ah)}.${d.creditos.length ? "" : " Su anuncio no confirma qué créditos acepta."} <button type="button" class="enlace" id="f-alcanza">Cambiar mis datos</button></p>`;
}
function calcularAlcance(){
  const p = {sueldo:+$("#in-ingreso").value || 0, ahorro:+$("#in-ahorro").value || 0, subcuenta:+$("#in-subcuenta").value || 0};
  if (!p.sueldo) { $("#res-alcance").innerHTML = ""; return; }
  PERFIL = p; try { localStorage.setItem("arventa-perfil", JSON.stringify(p)); } catch (e) {}
  const c = capacidad(p), tope = Math.round(Math.max(c.banco.max, c.inf.max) / 10000) * 10000;
  estado.max = tope; estado.presEtiqueta = "ingreso";
  const n = DESARROLLOS.filter(d => { const a = alcance(d); return a.banco || a.inf; }).length;
  $("#res-alcance").innerHTML = `<span class="topes"><span><small>Con banco</small><b>hasta ${dinero(c.banco.max)}</b></span><span><small>Con Infonavit</small><b>hasta ${dinero(c.inf.max)}</b></span></span>
    <b>${n}</b> de ${DESARROLLOS.length} desarrollos entran en tu presupuesto; te mostramos los de hasta <b>${dinero(tope)}</b>.${htmlExplicacion()}`;
  pintarPresupuesto(); pintar();
}

/* ===== Filtros ===== */
function pintarFiltros(){
  $("#f-rec").innerHTML = [0, 1, 2, 3, 4].map(n => `<button type="button" class="chip" data-rec="${n}" aria-pressed="${estado.recMin === n}">${n ? n + "+" : "Cualquiera"}</button>`).join("");
  $$("#f-rec .chip").forEach(b => b.onclick = () => { estado.recMin = +b.dataset.rec; pintarFiltros(); contarFiltros(); });
  const checks = (sel, items, set) => {
    $(sel).innerHTML = items.map(([k, n]) => `<label><input type="checkbox" value="${esc(k)}" ${set.has(k) ? "checked" : ""}> ${esc(n)}</label>`).join("");
    $(sel).querySelectorAll("input").forEach(i => i.onchange = () => { i.checked ? set.add(i.value) : set.delete(i.value); contarFiltros(); });
  };
  checks("#f-credito", [["Infonavit", "Infonavit"], ["Fovissste", "Fovissste"], ["Banco", "Crédito bancario"], ["Cofinavit", "Cofinavit"]], estado.creditos);
  checks("#f-amen", Object.entries(AMEN).map(([k, a]) => [k, a.nombre]), estado.amen);
  checks("#f-cerca", Object.entries(CERCA_REQ).map(([k, r]) => [k, r.nombre]), estado.cercaReq);
  checks("#f-entrega", [["Preventa", "Preventa"], ["Entrega inmediata", "Entrega inmediata"], ["Por confirmar", "Por confirmar"]], estado.entrega);
  $("#f-trabajo15").innerHTML = estado.ref?.tipo === "trabajo"
    ? `<label><input type="checkbox" id="chk-15" ${estado.trabajo15 ? "checked" : ""}> Menos de 15 min en auto a ${esc(estado.ref.nombre)}</label>`
    : `<p class="nota" style="margin:0"><button type="button" class="enlace" id="f15-trabajo">Dinos dónde trabajas</button> para filtrar por minutos.</p>`;
  $("#chk-15")?.addEventListener("change", e => { estado.trabajo15 = e.target.checked; contarFiltros(); });
  $("#f15-trabajo")?.addEventListener("click", () => { $("#dlg-filtros").close(); abrirCerca("trabajo"); });
  contarFiltros();
}
function contarFiltros(){
  const n = DESARROLLOS.filter(pasa).length;
  $("#ver-filtros").textContent = n ? `Mostrar ${n} ${n === 1 ? "desarrollo" : "desarrollos"}` : "Ningún desarrollo cumple";
}

/* ===== Mapa (vista alterna) ===== */
let mapa = null, capaPines = null, marcaRef = null, marcando = false;
// CARTO ya pide clave de API (sin ella cada mosaico sale en blanco con "API KEY REQUIRED").
// OpenStreetMap no pide clave; es para tráfico moderado y necesita abrir el sitio desde un servidor.
const MAPA = window.ARVENTA?.MAPA || {url:"https://tile.openstreetmap.org/{z}/{x}/{y}.png", atribucion:"&copy; OpenStreetMap"};
let leafletListo = null;
function cargarLeaflet(){
  if (window.L) return Promise.resolve();
  if (!leafletListo) leafletListo = new Promise((ok, mal) => {
    const css = document.createElement("link");
    Object.assign(css, {rel:"stylesheet", href:"https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", integrity:"sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=", crossOrigin:""});
    const js = document.createElement("script");
    Object.assign(js, {src:"https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", integrity:"sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=", crossOrigin:""});
    js.onload = ok; js.onerror = () => { leafletListo = null; mal(new Error("No cargó Leaflet")); };
    document.head.append(css, js);
  });
  return leafletListo;
}
function capaMapa(m){
  let fallas = 0;
  return L.tileLayer(MAPA.url, {maxZoom:19, attribution:MAPA.atribucion})
    .on("tileerror", () => { if (++fallas === 6) toast("El mapa no está cargando bien. Puedes seguir usando la lista."); }).addTo(m);
}
async function iniciarMapa(){
  if (mapa) return;
  await cargarLeaflet();
  if (mapa) return;
  mapa = L.map("mapa", {zoomControl:false}).setView([24.018, -104.655], 13);
  L.control.zoom({position:"topright"}).addTo(mapa);
  capaMapa(mapa);
  capaPines = L.layerGroup().addTo(mapa);
  mapa.on("click", e => {
    if (marcando) {
      marcando = false; document.body.classList.remove("marcando"); $("#aviso-marcar").hidden = true;
      ponerRef({tipo:"trabajo", lat:e.latlng.lat, lng:e.latlng.lng, nombre:"el punto que marcaste"});
      return;
    }
    $("#tarjeta-flotante").hidden = true; $$(".pin.activo").forEach(p => p.classList.remove("activo"));
  });
  if (estado.ref) ponerMarcaRef();
}
function ponerMarcaRef(){
  if (marcaRef) marcaRef.remove();
  const ico = icono({trabajo:"trabajo", ubicacion:"ubicacion", escuela:"escuela", hospital:"hospital", centro:"centro"}[estado.ref.tipo] || "ubicacion");
  marcaRef = L.marker([estado.ref.lat, estado.ref.lng], {icon:L.divIcon({className:"", html:`<div class="yo"><span>${ico}</span></div>`, iconSize:[0, 0]}), title:estado.ref.nombre, keyboard:false}).addTo(mapa);
}
function pintarPines(l){
  if (!mapa) return;
  capaPines.clearLayers();
  const pts = [];
  for (const d of l) {
    if (d.lat == null) continue;
    const min = estado.ref?.tipo === "trabajo" && MINUTOS[d.id] != null ? `<small>${MINUTOS[d.id]} min</small>` : "";
    const m = L.marker([d.lat, d.lng], {icon:L.divIcon({className:"", html:`<span class="pin" data-id="${d.id}">${corto(d.desde)}${min}</span>`, iconSize:[0, 0]}), title:d.nombre, riseOnHover:true});
    m.on("click", e => { L.DomEvent.stopPropagation(e); mostrarFlotante(d); });
    capaPines.addLayer(m); pts.push([d.lat, d.lng]);
  }
  if (estado.ref) pts.push([estado.ref.lat, estado.ref.lng]);
  if (pts.length) mapa.fitBounds(L.latLngBounds(pts).pad(.15), {maxZoom:15});
}
function mostrarFlotante(d){
  $$(".pin").forEach(p => p.classList.toggle("activo", p.dataset.id === d.id));
  const f = $("#tarjeta-flotante");
  f.innerHTML = `<button class="cerrar-flotante" type="button" aria-label="Cerrar">✕</button>` + tarjeta(d);
  f.hidden = false;
  activarTarjetas(f);
  f.querySelector(".cerrar-flotante").onclick = () => { f.hidden = true; $$(".pin.activo").forEach(p => p.classList.remove("activo")); };
}
function cambiarVista(v){
  estado.vista = v;
  const enMapa = v === "mapa";
  $("#vista-mapa").hidden = !enMapa;
  document.body.classList.toggle("en-mapa", enMapa);
  $("#alternar-txt").textContent = enMapa ? "Mostrar lista" : "Mostrar mapa";
  if (enMapa) iniciarMapa().then(() => setTimeout(() => { mapa.invalidateSize(); pintarPines(ordenar(DESARROLLOS.filter(pasa))); }, 30))
    .catch(() => { toast("No se pudo cargar el mapa. Puedes seguir usando la lista."); cambiarVista("lista"); });
  else $("#tarjeta-flotante").hidden = true;
}

/* ===== Ficha del desarrollo ===== */
let mapaFicha = null;
let fichaActual = null;
function abrirFicha(d){
  fichaActual = d;
  medir("ver-ficha", {id:d.id});
  document.body.classList.add("en-ficha");
  $("#principal").hidden = true; $(".categorias").hidden = true; $("#ficha").hidden = false;
  const c = cercanos(d), am = amenidades(d), pm = porM2(d);
  const imgs = [
    ...(d.fotos.length ? d.fotos.map((f, i) => fotoHTML(d, f, i)) : [ilustracion(d, 0)]),
  ];
  const extra = [ilustracion(d, 1), ilustracion(d, 2), ilustracion(d, 3), ilustracion(d, 4)];
  const mosaico = [...imgs, ...(d.fotos.length > 4 ? [] : extra)].slice(0, 5);
  const carrusel = imgs;
  const aviso = d.fotos.length ? "" : `<span class="ilustrativa">Imagen ilustrativa</span>`;

  // Lo mejor de aquí: solo cosas buenas y ciertas
  const mejores = [];
  if (c) {
    const n = c.conteo, f = [];
    if (n.escuela) f.push(`${n.escuela} ${n.escuela === 1 ? "escuela" : "escuelas"}`);
    if (n.oxxo) f.push(`${n.oxxo} ${n.oxxo === 1 ? "OXXO" : "OXXOs"}`);
    if (n.farmacia) f.push(`${n.farmacia} ${n.farmacia === 1 ? "farmacia" : "farmacias"}`);
    if (f.length) mejores.push([icono("ubicacion"), `<b>A menos de 1 km tienes ${f.join(", ")}.</b>`]);
  }
  if (pm && pm < PROM_M2[d.tipo] * .97) mejores.push([icono("precio"), `<b>Su precio por m² (${dinero(pm)}) está ${Math.round((1 - pm / PROM_M2[d.tipo]) * 100)}% abajo</b> del promedio de los ${d.tipo === "casa" ? "fraccionamientos" : "edificios"} nuevos de Durango en ARVENTA.`]);
  const usadas = new Set();
  for (const a of am) { const v = (d.ventajas || []).find(v => AMEN[a].re.test(v)) || AMEN[a].nombre; if (usadas.has(v)) continue; usadas.add(v); mejores.push([icono(a), esc(v)]); }
  for (const v of d.ventajas || []) if (!am.some(a => AMEN[a].re.test(v)) && !/crédito|infonavit|fovissste/i.test(v)) mejores.push([icono("check"), esc(v)]);

  const filasCerca = c ? Object.keys(CATS).filter(k => c.mas[k] && c.mas[k].m <= 5000).map(k => {
    const l = c.mas[k], cam = minCaminando(l.m), modo = cam <= 20 ? `${cam} min caminando` : `${minAuto(l.m)} min en auto`;
    return `<li><span class="ico">${icono(k)}</span><span class="nombre">${esc(l.nombre)}<small>${CATS[k].nombre} más ${CATS[k].f ? "cercana" : "cercano"}</small></span><span class="dist">${textoDist(l.m)}<small>${modo}</small></span></li>`;
  }).join("") : "";
  const seccionCerca = d.lat == null
    ? `<p class="nota">Todavía no tenemos la ubicación exacta. En cuanto la confirmemos verás aquí qué tiene cerca.</p>`
    : (c ? `<ul class="cerca">${filasCerca}</ul><div class="mapa-ficha" id="mapa-ficha" role="img" aria-label="Mapa de lo que hay cerca"></div><p class="nota">Distancias en línea recta según OpenStreetMap${OSM.fecha ? ` (${esc(OSM.fecha)})` : ""}${d.aprox ? ", desde una ubicación aproximada" : ""}. El tiempo caminando considera las vueltas de las calles.</p>`
         : `<p class="nota">Por ahora no tenemos la lista de lugares cercanos; pregúntala en tu visita.</p><div class="mapa-ficha" id="mapa-ficha"></div>`);
  const camino = d.lat == null ? `<p class="nota">Disponible cuando confirmemos la ubicación.</p>`
    : estado.ref?.tipo === "trabajo" && MINUTOS[d.id] != null ? `<p class="resumen"><span><b>${MINUTOS[d.id]} min</b> en auto a ${esc(estado.ref.nombre)}</span></p>`
    : estado.ref ? `<p class="resumen"><span><b>${textoDist(metros(d, estado.ref))}</b> de ${esc(estado.ref.nombre)}</span></p><p class="nota"><button type="button" class="enlace" id="f-trabajo">Calcula los minutos a tu trabajo</button>.</p>`
    : `<p class="nota" style="margin:0"><button type="button" class="enlace" id="f-trabajo">Dinos dónde trabajas</button> y te decimos cuántos minutos haces desde aquí.</p>`;
  const pend = `<dd class="pend">Por confirmar</dd>`;

  $("#ficha").innerHTML = `
    <div class="ficha-texto-top">
      <button class="volver" type="button" id="volver"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>Todos los desarrollos</button>
      <button class="compartir" type="button" id="compartir" aria-haspopup="dialog"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 4v11M7 9l5-5 5 5M5 14v5h14v-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>Compartir</button>
    </div>
    <div class="galeria-movil"><div class="carril">${carrusel.map(x => `<div class="lamina">${x}</div>`).join("")}</div>${aviso}</div>
    <div class="ficha-texto">
      <h1 id="ficha-titulo">${esc(d.nombre)}</h1>
      <p class="sub-titulo">${esc(TIPO[d.tipo])} · ${esc(d.zona)}${d.aprox ? " (ubicación aproximada)" : ""}</p>
    </div>
    <div class="mosaico">${mosaico.map((x, i) => `<div>${x}${x.startsWith("<svg") || i === 0 ? aviso || (x.startsWith("<svg") ? '<span class="ilustrativa">Imagen ilustrativa</span>' : "") : ""}</div>`).join("")}</div>
    <div class="cuerpo-ficha">
      <div>
        <section class="seccion">
          <ul class="resumen">${d.tipo !== "terreno" ? `<li><b>${esc(d.recamaras)}</b> recámaras</li>` : ""}<li><b>${esc(d.m2)}</b></li>${pm ? `<li><b>${dinero(pm)}</b> por m²</li>` : ""}${d.desarrolladora ? `<li>Por ${esc(d.desarrolladora)}</li>` : ""}</ul>
        </section>
        ${mejores.length ? `<section class="seccion"><h2>Lo mejor de aquí</h2><ul class="lo-mejor">${mejores.map(([i, t]) => `<li><span class="i" aria-hidden="true">${i}</span><span>${t}</span></li>`).join("")}</ul></section>` : ""}
        <section class="seccion"><h2>Lo que tienes cerca</h2>${seccionCerca}</section>
        <section class="seccion"><h2>Tu camino al trabajo</h2>${camino}</section>
        <section class="seccion"><h2>Cómo podrías pagarlo</h2><div id="f-alc">${htmlAlcanceFicha(d)}</div></section>
        <section class="seccion"><h2>Condiciones</h2>
          <dl class="condiciones">
            <div><dt>Precio</dt><dd>${vencido(d) ? "Por confirmar. Último publicado: d" : "D"}esde ${dinero(d.desde)}${d.hasta ? ` hasta ${dinero(d.hasta)}` : ""}. Verificado el ${fechaLarga(d.verificado)}.</dd><dd class="pend">Puede variar al cerrar la operación</dd></div>
            <div><dt>Créditos que acepta</dt>${d.creditos.length ? `<dd>${esc(d.creditos.join(", "))}</dd>` : pend}</div>
            <div><dt>Entrega</dt>${d.entrega ? `<dd>${esc(d.entrega)}${d.fechaEntrega ? ". " + esc(d.fechaEntrega) : ""}</dd>` : pend}</div>
            <div><dt>Qué incluye</dt>${d.incluye ? `<dd>${esc(d.incluye)}</dd>` : pend}</div>
            <div><dt>Esquemas de pago</dt>${d.esquemas?.length ? `<dd>${esc(d.esquemas.map(e => e.nombre).join(" · "))}</dd><dd class="pend">Confirmados por la desarrolladora</dd>` : pend}</div>
            ${d.modelos ? `<div><dt>Modelos</dt><dd>${esc(d.modelos)}</dd></div>` : ""}
            <div><dt>Ubicación</dt><dd>${d.lat == null ? "Por confirmar" : d.aprox ? "Aproximada, por zona" : "Confirmada"}</dd></div>
          </dl>
          <p class="nota">${d.convenio ? "Anunciante en ARVENTA: los datos los confirmó la desarrolladora." : "Información pública de anuncios."} ARVENTA no vende: al agendar, le pasamos tu solicitud a quien comercializa este desarrollo para que te atienda. Para ti no tiene costo.</p>
        </section>
        <section class="seccion fuentes"><h2>De dónde salen estos datos</h2>
          <p class="nota" style="margin:0">Visto en ${d.fuentes.map((f, i) => { const rep = d.fuentes.filter(x => x[0] === f[0]).length > 1; return `<a href="${esc(f[1])}" target="_blank" rel="noopener">${esc(f[0])}${rep ? " (" + d.fuentes.slice(0, i + 1).filter(x => x[0] === f[0]).length + ")" : ""}</a>`; }).join(", ")}. Precio verificado el ${fechaLarga(d.verificado)}.</p>
        </section>
      </div>
      <aside class="caja" aria-label="Precio y visita">
        <p class="precio">${vencido(d) ? `Precio por confirmar <small>último publicado: ${dinero(d.desde)}</small>` : `${dinero(d.desde)} <small>precio desde</small>`}</p>
        <p class="rango">${d.hasta ? `Hasta ${dinero(d.hasta)} según modelo. ` : ""}Puede variar al cerrar.</p>
        <div class="calc">
          <label>Precio<input id="c-precio" type="number" min="0" step="1000" value="${d.desde}"></label>
          <label>Enganche<select id="c-eng"><option value="0.1">10%</option><option value="0.15">15%</option><option value="0.2" selected>20%</option><option value="0.3">30%</option></select></label>
          <label>Tasa anual %<input id="c-tasa" type="number" min="1" max="30" step="0.05" value="${TASA_BANCO}"></label>
          <label>Plazo<select id="c-plazo"><option value="10">10 años</option><option value="15">15 años</option><option value="20" selected>20 años</option></select></label>
          <div class="mensual" aria-live="polite">Mensualidad estimada con banco<b id="c-res"></b><span id="c-eng-txt"></span></div>
        </div>
        <button class="btn" type="button" id="agendar">Agendar visita</button>
        ${d.esquemas?.length ? `<a class="btn claro btn-corrida" href="/cotizador.html?d=${esc(d.id)}">Arma tu corrida financiera</a>` : ""}
        ${botonComparar(d, "cmp-ficha")}
        <p class="leyenda">Agendar no te cuesta nada. Estimación sin seguros ni comisiones; las tasas en México van de 9% a 13%.</p>
      </aside>
    </div>
    <div class="barra-reserva"><span><b>desde ${corto(d.desde)}</b><small>${esc(TIPO[d.tipo])} · ${esc(zonaCorta(d))}</small></span><button class="btn" type="button" id="agendar-2">Agendar visita</button></div>`;
  $("#volver").onclick = irAInicio;
  $("#agendar").onclick = $("#agendar-2").onclick = () => agendar(d);
  $("#compartir").onclick = () => abrirCompartir(d);
  enlazarAlcanceFicha();
  pintarBarraComparar();
  $("#f-trabajo")?.addEventListener("click", () => abrirCerca("trabajo"));
  ["c-precio", "c-eng", "c-tasa", "c-plazo"].forEach(id => $("#" + id).oninput = calcular);
  calcular();
  window.scrollTo({top:0});
  document.title = `${d.nombre}: ${TIPO[d.tipo].toLowerCase()} desde ${corto(d.desde)} · ARVENTA`;
  if (d.lat != null) setTimeout(() => mapaDeFicha(d, c), 0);
}
async function mapaDeFicha(d, c){
  if (mapaFicha) { mapaFicha.remove(); mapaFicha = null; }
  try { await cargarLeaflet(); }
  catch (e) { const x = $("#mapa-ficha"); if (x) x.outerHTML = '<p class="nota">El mapa no está disponible ahora; las distancias de arriba siguen siendo válidas.</p>'; return; }
  const el = $("#mapa-ficha"); if (!el || fichaActual !== d) return;
  mapaFicha = L.map(el, {scrollWheelZoom:false, zoomControl:true}).setView([d.lat, d.lng], 15);
  capaMapa(mapaFicha);
  L.circle([d.lat, d.lng], {radius:310, color:"#2F6B5E", weight:1.5, dashArray:"4 6", fillColor:"#2F6B5E", fillOpacity:.07, interactive:false}).addTo(mapaFicha);
  L.circle([d.lat, d.lng], {radius:615, color:"#2F6B5E", weight:1, dashArray:"2 8", fill:false, interactive:false}).addTo(mapaFicha);
  L.marker([d.lat, d.lng], {icon:L.divIcon({className:"", html:`<span class="pin activo">${corto(d.desde)}</span>`, iconSize:[0, 0]}), keyboard:false}).addTo(mapaFicha);
  const pts = [[d.lat, d.lng]];
  if (c) for (const k of ["escuela", "oxxo", "super", "farmacia", "salud", "parque"]) {
    const l = c.mas[k]; if (!l || l.m > 2500) continue;
    L.polyline([[d.lat, d.lng], [l.lat, l.lng]], {color:"#F0A202", weight:3, opacity:.9, interactive:false}).addTo(mapaFicha);
    L.marker([l.lat, l.lng], {icon:L.divIcon({className:"", html:`<div class="poi" title="${esc(l.nombre)}">${icono(k)}</div><span class="poi-etq">${textoDist(l.m)}</span>`, iconSize:[0, 0]}), title:l.nombre, keyboard:false}).addTo(mapaFicha);
    pts.push([l.lat, l.lng]);
  }
  if (pts.length > 1) mapaFicha.fitBounds(L.latLngBounds(pts).pad(.2), {maxZoom:16});
}
// El veredicto se actualiza al cerrar "¿Qué me alcanza?", sin mover la página
function enlazarAlcanceFicha(){ $("#f-alcanza")?.addEventListener("click", () => { pintarPresupuesto(); $("#dlg-presupuesto").showModal(); }); }
$("#dlg-presupuesto").addEventListener("close", () => {
  if (estado.max) medir("presupuesto", {hasta:estado.max});
  if (!fichaActual || !document.body.classList.contains("en-ficha")) return;
  $("#f-alc").innerHTML = htmlAlcanceFicha(fichaActual); enlazarAlcanceFicha();
});
function cerrarFicha(){
  fichaActual = null;
  document.body.classList.remove("en-ficha");
  if (mapaFicha) { mapaFicha.remove(); mapaFicha = null; }
  $("#ficha").hidden = true; $("#principal").hidden = false; $(".categorias").hidden = false;
  document.title = "ARVENTA · Vivienda nueva en Durango";
}
function calcular(){
  const P = +$("#c-precio").value || 0, e = +$("#c-eng").value, n = +$("#c-plazo").value;
  $("#c-res").textContent = dinero(pago(P * (1 - e), +$("#c-tasa").value || 0, n)) + " al mes";
  $("#c-eng-txt").textContent = `Enganche de ${dinero(P * e)} y crédito de ${dinero(P * (1 - e))} a ${n} años`;
}

/* ===== Rutas: #id abre la ficha ===== */
/* Cada desarrollo tiene su página real: /desarrollos/<id>/ (la genera scripts/construir.mjs) */
function idDeRuta(){
  const m = location.pathname.match(/^\/desarrollos\/([a-z0-9-]+)\/?$/);
  return m ? m[1] : null;
}
function ruta(){
  // Enlaces viejos con #id se pasan a la dirección nueva
  const viejo = decodeURIComponent(location.hash.slice(1));
  if (viejo && DESARROLLOS.some(x => x.id === viejo)) history.replaceState(null, "", `/desarrollos/${viejo}/`);
  const d = DESARROLLOS.find(x => x.id === idDeRuta());
  if (d) abrirFicha(d); else { cerrarFicha(); pintar(); }
}
function irA(id){ history.pushState({arv:1}, "", `/desarrollos/${id}/`); ruta(); }
function irAInicio(){ if (history.state?.arv) history.back(); else { history.pushState(null, "", "/"); ruta(); } }
window.addEventListener("popstate", ruta);
// Enlaces internos a fichas: sin recargar la página
document.addEventListener("click", e => {
  const a = e.target.closest('a[href^="/desarrollos/"]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
  const m = a.getAttribute("href").match(/^\/desarrollos\/([a-z0-9-]+)\/$/);
  if (m) { e.preventDefault(); if ($("#dlg-comparar").open) $("#dlg-comparar").close(); irA(m[1]); }
});

/* ===== Agendar visita =====
   Una solicitud perdida es una comisión perdida: se guarda en /api/visita antes de abrir WhatsApp.
   Si no hay conexión, queda en una cola en este teléfono y se reintenta en la siguiente visita. */
const COLA = "arventa-solicitudes-pendientes";
function leerCola(){ try { return JSON.parse(localStorage.getItem(COLA)) || []; } catch (e) { return []; } }
function ponerCola(l){ try { l.length ? localStorage.setItem(COLA, JSON.stringify(l.slice(-10))) : localStorage.removeItem(COLA); } catch (e) {} }
async function enviarSolicitud(r){
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
  try {
    const resp = await fetch("/api/visita", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(r), signal:ctl.signal});
    const j = await resp.json().catch(() => ({}));
    if (resp.ok && j.ok) return {ok:true, folio:j.folio};
    if (resp.status === 400 || resp.status === 429) return {error:j.mensaje || "Revisa tus datos."};
    return {ok:false};
  } catch (e) { return {ok:false}; } finally { clearTimeout(t); }
}
async function guardarSolicitud(r){
  const res = await enviarSolicitud(r);
  if (res.ok) { medir("solicitud", {id:r.id}); return res; }
  if (res.error) return res;
  ponerCola([...leerCola(), r]);      // sin servidor: se guarda aquí y WhatsApp lleva el folio
  return {ok:false, folio:r.folio};
}
async function vaciarCola(){
  const quedan = [];
  for (const r of leerCola()) { const x = await enviarSolicitud(r); if (!x.ok && !x.error) quedan.push(r); }
  ponerCola(quedan);
}
let visitaDe = null;
function agendar(d){
  visitaDe = d; $("#visita-a").textContent = `${d.nombre}, desde ${dinero(d.desde)}`;
  $("#v-consent").checked = false; // el consentimiento se da cada vez, para cada desarrollo
  medir("clic-agendar", {id:d.id});
  $("#dlg-visita").showModal();
}
// Enlace para compartir: la página d/<id>.html tiene la vista previa para WhatsApp (ver generar-paginas.js)
// Mensualidad que la persona estaba viendo en la calculadora de la ficha (si la tocó)
function mensualidadVista(){
  const P = +$("#c-precio")?.value, e = +$("#c-eng")?.value, t = +$("#c-tasa")?.value, n = +$("#c-plazo")?.value;
  return P && n ? Math.round(pago(P * (1 - e), t || TASA_BANCO, n)) : null;
}
function enlaceDe(d){ return `${location.origin}/desarrollos/${d.id}/`; }
function abrirCompartir(d){
  const url = enlaceDe(d), texto = `${d.nombre}: ${TIPO[d.tipo].toLowerCase()} desde ${dinero(d.desde)} en Durango.`;
  $("#comp-nombre").textContent = d.nombre;
  $("#comp-url").value = url;
  $("#comp-whatsapp").href = enlaceWhatsApp(d);
  $("#comp-whatsapp").onclick = () => { medir("compartir", {id:d.id, via:"whatsapp"}); $("#dlg-compartir").close(); };
  $("#comp-copiar").textContent = "Copiar enlace";
  $("#comp-copiar").onclick = async () => {
    try { await navigator.clipboard.writeText(url); } catch (e) { $("#comp-url").select(); document.execCommand("copy"); }
    $("#comp-copiar").textContent = "Enlace copiado"; medir("compartir", {id:d.id, via:"copiar"});
  };
  $("#comp-mas").hidden = !navigator.share;
  $("#comp-mas").onclick = () => navigator.share({title:d.nombre, text:texto, url}).then(() => { medir("compartir", {id:d.id, via:"telefono"}); $("#dlg-compartir").close(); }).catch(() => {});
  $("#dlg-compartir").showModal();
}
function enlaceWhatsApp(d){
  const texto = `${d.nombre}: ${TIPO[d.tipo].toLowerCase()} desde ${dinero(d.desde)} en Durango.\n${enlaceDe(d)}`;
  return "https://wa.me/?text=" + encodeURIComponent(texto);
}
$("#form-visita").addEventListener("submit", async e => {
  if (e.submitter && e.submitter.value === "cancelar") return;
  e.preventDefault();
  if (!$("#v-consent").checked) { $("#v-consent").focus(); return; }
  const d = visitaDe, folio = nuevoFolio("V");
  const registro = {tipo:"visita", folio, id:d.id, nombre:$("#v-nombre").value.trim(), whatsapp:$("#v-tel").value.trim(),
    cuando:$("#v-cuando").value, pago:$("#v-credito").value, consentimiento:true,
    presupuesto:estado.max || null, mensualidad:mensualidadVista(), otros:[...new Set([...FAV, ...COMPARAR])].filter(id => id !== d.id).slice(0, 5), versionAviso:window.ARVENTA?.VERSION_AVISO || "",
    sitio:$("#v-sitio").value, // campo trampa: una persona lo deja vacío
    minutos:estado.ref?.tipo === "trabajo" ? MINUTOS[d.id] ?? null : null};
  // Zona de trabajo redondeada a ~1 km aquí mismo: el punto exacto nunca sale del teléfono
  if (estado.ref?.tipo === "trabajo") registro.trabajo = {texto:estado.ref.nombre === "el punto que marcaste" ? "" : estado.ref.nombre,
    lat:Math.round(estado.ref.lat * 100) / 100, lng:Math.round(estado.ref.lng * 100) / 100};
  const boton = $("#v-enviar"); boton.disabled = true; boton.textContent = "Guardando tu solicitud…";
  const res = await guardarSolicitud(registro);
  boton.disabled = false; boton.textContent = "Enviar por WhatsApp";
  if (res.error) { toast(res.error, 6000); return; }      // dato inválido: se corrige en el formulario
  if (res.ok) toast("Recibimos tu solicitud. Te mandaremos por WhatsApp un enlace para confirmar tu cita.", 6000);
  const url = enlaceDe(d);
  const msg = `Hola ARVENTA, quiero visitar ${d.nombre} (desde ${dinero(d.desde)}).\nNombre: ${registro.nombre}\nWhatsApp: ${registro.whatsapp}\nCuándo: ${registro.cuando}\nPago: ${registro.pago}\nFolio: ${res.folio || folio}\n${url}`;
  $("#dlg-visita").close();
  if (WHATSAPP) location.href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
  else { $("#txt-copiar").value = msg; $("#dlg-copiar").showModal(); }
});
$("#btn-copiar").onclick = async () => { try { await navigator.clipboard.writeText($("#txt-copiar").value); $("#btn-copiar").textContent = "Copiado"; } catch (e) { $("#txt-copiar").select(); } };
$("#cerrar-copiar").onclick = () => { $("#dlg-copiar").close(); $("#btn-copiar").textContent = "Copiar mensaje"; };
const abrirPriv = () => $("#dlg-privacidad").showModal();
$("#abrir-privacidad").onclick = abrirPriv; $("#ver-privacidad-visita").onclick = abrirPriv;
$("#cerrar-privacidad").onclick = () => $("#dlg-privacidad").close();

/* ===== Eventos del buscador ===== */
$("#buscador").addEventListener("submit", e => { e.preventDefault(); estado.q = $("#q").value.trim(); $("#q2").value = estado.q; if (idDeRuta()) irAInicio(); pintar(); if (estado.q) medir("busqueda", {texto:estado.q.slice(0, 60)}); $("#resultados").scrollIntoView({behavior:"smooth"}); });
$("#q").addEventListener("input", () => { estado.q = $("#q").value.trim(); $("#q2").value = estado.q; pintar(); });
$("#q2").addEventListener("input", () => { estado.q = $("#q2").value.trim(); $("#q").value = estado.q; pintar(); });
$("#abrir-cerca").onclick = () => abrirCerca();
$("#buscador-movil").onclick = () => abrirCerca();
$("#abrir-presupuesto").onclick = $("#abrir-presupuesto-2").onclick = () => { pintarPresupuesto(); if ($("#dlg-cerca").open) $("#dlg-cerca").close(); $("#dlg-presupuesto").showModal(); };
$("#in-ingreso").oninput = $("#in-ahorro").oninput = $("#in-subcuenta").oninput = calcularAlcance;
$("#in-ingreso").onchange = () => medir("calcular-alcance"); // sin montos: el ingreso nunca sale del teléfono
$("#quitar-pres").onclick = () => {
  estado.max = null; estado.presEtiqueta = null; PERFIL = null;
  try { localStorage.removeItem("arventa-perfil"); } catch (e) {}
  ["#in-ingreso", "#in-ahorro", "#in-subcuenta"].forEach(s => $(s).value = ""); $("#res-alcance").innerHTML = "";
  pintarPresupuesto(); pintar();
};
if (PERFIL) { $("#in-ingreso").value = PERFIL.sueldo || ""; $("#in-ahorro").value = PERFIL.ahorro || ""; $("#in-subcuenta").value = PERFIL.subcuenta || ""; }
$$(".op[data-cerca]").forEach(b => b.onclick = () => {
  const t = b.dataset.cerca;
  if (t === "ubicacion") usarUbicacion();
  else if (t === "centro") { ponerRef({tipo:"centro", ...CENTRO}); $("#dlg-cerca").close(); }
  else abrirCerca(t);
});
$("#buscar-trabajo").onclick = async () => {
  const q = $("#in-trabajo").value.trim(); if (!q) return;
  $("#msg-cerca").textContent = "Buscando…";
  try {
    const p = await geocodificar(q);
    if (!p) { $("#msg-cerca").textContent = `No encontramos “${q}” en Durango. Prueba con otra referencia o márcalo en el mapa.`; return; }
    $("#dlg-cerca").close(); ponerRef({tipo:"trabajo", ...p, nombre:q});
  } catch (e) { $("#msg-cerca").textContent = "No se pudo buscar la dirección. Márcala en el mapa."; }
};
$("#in-trabajo").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("#buscar-trabajo").click(); } });
$("#marcar-mapa").onclick = () => {
  $("#dlg-cerca").close(); if (idDeRuta()) irAInicio();
  cambiarVista("mapa"); marcando = true; document.body.classList.add("marcando"); $("#aviso-marcar").hidden = false;
};
$("#usar-lugar").onclick = () => {
  const n = $("#in-lugar").value.trim(), cat = tipoLugar === "escuela" ? "escuela" : "salud";
  const l = LUGARES?.find(x => x.cat === cat && normal(x.nombre) === normal(n)) || LUGARES?.find(x => x.cat === cat && normal(x.nombre).includes(normal(n)) && n.length > 2);
  if (!l) { $("#msg-cerca").textContent = "Elige un nombre de la lista que aparece al escribir."; return; }
  $("#dlg-cerca").close(); ponerRef({tipo:tipoLugar, lat:l.lat, lng:l.lng, nombre:l.nombre});
};
$("#quitar-cerca").onclick = () => { ponerRef(null); $("#dlg-cerca").close(); };
$("#orden").onchange = e => { estado.orden = e.target.value; pintar(); };
$("#abrir-filtros").onclick = () => { pintarFiltros(); $("#dlg-filtros").showModal(); };
$("#limpiar-filtros").onclick = () => { estado.recMin = 0; estado.trabajo15 = false; ["creditos", "amen", "cercaReq", "entrega"].forEach(k => estado[k].clear()); pintarFiltros(); };
$("#dlg-filtros").addEventListener("close", () => { pintar(); const f = [...estado.creditos, ...estado.amen, ...estado.cercaReq, ...estado.entrega]; if (estado.recMin) f.push("rec" + estado.recMin); if (estado.trabajo15) f.push("trabajo15"); if (f.length) medir("filtro", {filtros:f.join(",")}); });
$("#alternar").onclick = () => cambiarVista(estado.vista === "mapa" ? "lista" : "mapa");
$("#cerrar-comparar").onclick = () => $("#dlg-comparar").close();
$("#cerrar-compartir").onclick = () => $("#dlg-compartir").close();
// cerrar hojas tocando fuera
$$("dialog").forEach(dl => dl.addEventListener("click", e => { if (e.target === dl) dl.close(); }));

/* Alto real de la barra + categorías, para el mapa y el aviso de marcar */
function medirCabecera(){
  const h = $(".barra").offsetHeight + ($(".categorias").hidden ? 0 : $(".categorias").offsetHeight);
  document.documentElement.style.setProperty("--alto-cab", h + "px");
}
window.addEventListener("resize", medirCabecera);

/* ===== Inicio ===== */
pintarCategorias();
medirCabecera();
ruta();
vaciarCola();
