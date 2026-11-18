/* ARVENTA: buscador de vivienda nueva en Durango
   Vista principal: tarjetas con imágenes. El mapa es una vista alterna.
   Todo corre en el navegador; los datos viven en datos.js. */

/* ===== Configuración ===== */
// Tu número de WhatsApp con lada de país, sin espacios. Ej. "5216181234567".
const WHATSAPP = "";
const CENTRO = {lat:24.0248, lng:-104.6705, nombre:"el Centro Histórico"};
const CAJA = {s:23.95, w:-104.77, n:24.10, e:-104.56};
const TASA_BANCO = 11;     // % anual de referencia para cálculos
const PLAZO_BANCO = 20;    // años

/* ===== Datos ===== */
const DESARROLLOS = (window.DESARROLLOS || []).map(d => ({
  fotos: [], incluye: null, convenio: false, creditos: [], entrega: null, ...d
}));
const TIPO = {casa:"Casas", departamento:"Departamentos", terreno:"Terrenos"};
const TIPO_UNO = {casa:"Casa", departamento:"Departamento", terreno:"Terreno"};

const AMEN = {
  alberca:   {nombre:"Alberca", ico:"🏊", re:/alberca/i},
  vigilancia:{nombre:"Vigilancia o acceso controlado", ico:"🛡️", re:/vigilan|caseta|control de acceso|acceso con tarjeta/i},
  gimnasio:  {nombre:"Gimnasio", ico:"🏋️", re:/gimnas/i},
  verdes:    {nombre:"Áreas verdes", ico:"🌳", re:/verde|pista para correr/i},
  juegos:    {nombre:"Juegos infantiles", ico:"🛝", re:/juegos|ludoteca/i},
  canchas:   {nombre:"Canchas", ico:"🎾", re:/cancha|pádel|tenis/i},
};
function amenidades(d){
  const t = [d.nombre, ...(d.ventajas || [])].join(" ");
  return Object.keys(AMEN).filter(k => AMEN[k].re.test(t));
}

/* ===== Lugares cercanos (OpenStreetMap) ===== */
const CATS = {
  escuela: {ico:"🎒", nombre:"Escuela", f:1},
  oxxo:    {ico:"🏪", nombre:"OXXO"},
  super:   {ico:"🛒", nombre:"Supermercado"},
  farmacia:{ico:"💊", nombre:"Farmacia", f:1},
  salud:   {ico:"🏥", nombre:"Hospital o clínica"},
  parque:  {ico:"🌳", nombre:"Parque"},
  uni:     {ico:"🎓", nombre:"Universidad", f:1}
};
let LUGARES = null;
const CERCA_CACHE = new Map();

function consultaOverpass(){
  const b = `${CAJA.s},${CAJA.w},${CAJA.n},${CAJA.e}`;
  return `[out:json][timeout:60];(
    nwr["amenity"~"^(school|kindergarten)$"](${b});
    nwr["shop"]["brand"~"oxxo",i](${b});
    nwr["shop"]["name"~"^oxxo",i](${b});
    nwr["shop"="supermarket"](${b});
    nwr["amenity"="pharmacy"](${b});
    nwr["amenity"~"^(hospital|clinic)$"](${b});
    nwr["leisure"="park"](${b});
    nwr["amenity"="university"](${b});
  );out center tags;`;
}
function categoria(t){
  if (/oxxo/i.test(t.brand || "") || /^oxxo/i.test(t.name || "")) return "oxxo";
  if (t.amenity === "school" || t.amenity === "kindergarten") return "escuela";
  if (t.shop === "supermarket") return "super";
  if (t.amenity === "pharmacy") return "farmacia";
  if (t.amenity === "hospital" || t.amenity === "clinic") return "salud";
  if (t.leisure === "park") return "parque";
  if (t.amenity === "university") return "uni";
  return null;
}
async function cargarLugares(){
  try {
    const g = localStorage.getItem("lugares-v1");
    if (g) { const o = JSON.parse(g); if (Date.now() - o.t < 7 * 864e5) { LUGARES = o.d; return; } }
  } catch (e) {}
  const servidores = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
  for (const url of servidores) {
    try {
      const r = await fetch(url, {method:"POST", body:"data=" + encodeURIComponent(consultaOverpass()),
        headers:{"Content-Type":"application/x-www-form-urlencoded"}});
      if (!r.ok) continue;
      const j = await r.json();
      LUGARES = j.elements.map(e => {
        const t = e.tags || {}, c = categoria(t), lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
        if (!c || lat == null) return null;
        return {cat:c, nombre:t.name || CATS[c].nombre, lat, lng, nombrado:!!t.name};
      }).filter(Boolean);
      try { localStorage.setItem("lugares-v1", JSON.stringify({t:Date.now(), d:LUGARES})); } catch (e) {}
      return;
    } catch (e) {}
  }
}
function cercanos(d){
  if (!LUGARES || d.lat == null) return null;
  if (CERCA_CACHE.has(d.id)) return CERCA_CACHE.get(d.id);
  const mas = {}, conteo = {};
  for (const l of LUGARES) {
    const m = metros(d, l);
    if (m <= 1000) conteo[l.cat] = (conteo[l.cat] || 0) + 1;
    if (!mas[l.cat] || m < mas[l.cat].m) mas[l.cat] = {...l, m};
  }
  const r = {mas, conteo};
  CERCA_CACHE.set(d.id, r);
  return r;
}

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
function laminas(d){
  const l = [];
  for (const f of d.fotos) l.push(`<img src="${esc(f)}" alt="Foto de ${esc(d.nombre)}" loading="lazy">`);
  if (!d.fotos.length) l.push(ilustracion(d, 0) + `<span class="ilustrativa">Imagen ilustrativa</span>`);
  const c = laminaCerca(d); if (c) l.push(c);
  l.push(laminaBasico(d));
  return l;
}

/* ===== Estado ===== */
const estado = {
  cat: "todo", q: "", max: null, presEtiqueta: null,
  recMin: 0, creditos: new Set(), amen: new Set(), cercaReq: new Set(), entrega: new Set(),
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
  if (c?.mas.escuela && c.mas.escuela.m <= 800) partes.push(`Escuela a ${textoDist(c.mas.escuela.m)}`);
  const am = amenidades(d);
  if (am.includes("alberca")) partes.push("Alberca");
  else if (am.includes("vigilancia")) partes.push("Vigilancia");
  if (partes.length < 2 && c?.mas.oxxo && c.mas.oxxo.m <= 600) partes.push(`OXXO a ${textoDist(c.mas.oxxo.m)}`);
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
      <div class="l1"><h3><a class="titulo-enlace" href="#${d.id}">${esc(d.nombre)}</a></h3>${cerc ? `<span class="cercania">${cerc}</span>` : ""}</div>
      <p class="gris">${esc(TIPO[d.tipo])} · ${esc(zonaCorta(d))}</p>
      ${bueno ? `<p class="bueno">${esc(bueno)}</p>` : ""}
      <p class="precio">desde <b>${corto(d.desde)}</b>${d.tipo !== "terreno" ? ` · ${esc(d.recamaras)} rec.` : ""}</p>
    </div>
  </div>`;
}
function activarTarjetas(raiz){
  raiz.querySelectorAll(".tarjeta").forEach(t => {
    const id = t.dataset.id, carril = t.querySelector(".carril"), puntos = t.querySelectorAll(".puntos i");
    t.addEventListener("click", e => {
      if (e.target.closest("button")) return;
      if (e.target.closest("a")) return; // el enlace ya navega
      location.hash = id;
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
  if (estado.cercaReq.size && !LUGARES) ctx += " Cargando lugares cercanos para aplicar tus filtros…";
  $("#contexto").innerHTML = ctx;
  $("#ctx-ubicacion")?.addEventListener("click", usarUbicacion);
  $("#ctx-trabajo")?.addEventListener("click", () => abrirCerca("trabajo"));
  $("#rejilla").innerHTML = l.length ? l.map(tarjeta).join("") :
    `<div class="vacio"><h2>No hay desarrollos con esa búsqueda</h2><p>Quita algún filtro o sube tu presupuesto.</p><button class="btn" type="button" id="limpiar-todo">Quitar filtros</button></div>`;
  $("#limpiar-todo")?.addEventListener("click", limpiarTodo);
  activarTarjetas($("#rejilla"));
  if (estado.vista === "mapa") pintarPines(l);
  const n = estado.creditos.size + estado.amen.size + estado.cercaReq.size + estado.entrega.size + (estado.recMin ? 1 : 0);
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
  Object.assign(estado, {cat:"todo", q:"", max:null, recMin:0});
  ["creditos", "amen", "cercaReq", "entrega"].forEach(k => estado[k].clear());
  $("#q").value = ""; $("#q2").value = "";
  pintarCategorias(); pintarFiltros(); pintar();
}

/* ===== Cerca de… ===== */
function ponerRef(ref){
  estado.ref = ref; estado.orden = "cerca"; $("#orden").value = "cerca";
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
  if (!LUGARES) { $("#msg-cerca").textContent = "Todavía estamos cargando las escuelas y hospitales. Intenta en unos segundos."; return; }
  const nombres = [...new Set(LUGARES.filter(l => l.cat === cat && l.nombrado).map(l => l.nombre))].sort((a, b) => a.localeCompare(b, "es"));
  $("#lista-lugares").innerHTML = nombres.map(n => `<option value="${esc(n)}">`).join("");
}
async function geocodificar(q){
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.search = new URLSearchParams({q:q + ", Durango, Durango, México", format:"json", limit:"1", countrycodes:"mx",
    viewbox:`${CAJA.w},${CAJA.n},${CAJA.e},${CAJA.s}`, bounded:"1"});
  const r = await fetch(u, {headers:{"Accept-Language":"es"}});
  const j = await r.json();
  return j[0] ? {lat:+j[0].lat, lng:+j[0].lon} : null;
}
async function calcularTiempos(){
  const con = DESARROLLOS.filter(d => d.lat != null), ref = estado.ref;
  try {
    const coords = [[ref.lng, ref.lat], ...con.map(d => [d.lng, d.lat])].map(c => c.join(",")).join(";");
    const fuentes = con.map((_, i) => i + 1).join(";");
    const r = await fetch(`https://router.project-osrm.org/table/v1/driving/${coords}?sources=${fuentes}&destinations=0&annotations=duration`);
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
function calcularAlcance(){
  const ing = +$("#in-ingreso").value || 0, ah = +$("#in-ahorro").value || 0;
  if (!ing) { $("#res-alcance").textContent = ""; return; }
  const cred = creditoMax(ing * .3, TASA_BANCO, PLAZO_BANCO), tope = Math.round((cred + ah) / 10000) * 10000;
  estado.max = tope; estado.presEtiqueta = "ingreso";
  const n = DESARROLLOS.filter(d => d.desde <= tope).length;
  $("#res-alcance").innerHTML = `Con una mensualidad de hasta <b>${dinero(ing * .3)}</b> te podrían prestar unos <b>${dinero(cred)}</b> a ${PLAZO_BANCO} años al ${TASA_BANCO}%. Con tu ahorro, podrías buscar hasta <b>${dinero(tope)}</b>: hay <b>${n}</b> ${n === 1 ? "desarrollo" : "desarrollos"} en ese rango.<br><small>Es una estimación. Con Infonavit el monto depende de tu salario, tu edad y tu ahorro en la subcuenta.</small>`;
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
  contarFiltros();
}
function contarFiltros(){
  const n = DESARROLLOS.filter(pasa).length;
  $("#ver-filtros").textContent = n ? `Mostrar ${n} ${n === 1 ? "desarrollo" : "desarrollos"}` : "Ningún desarrollo cumple";
}

/* ===== Mapa (vista alterna) ===== */
let mapa = null, capaPines = null, marcaRef = null, marcando = false;
const TILES = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const ATRIB = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
function iniciarMapa(){
  if (mapa) return;
  mapa = L.map("mapa", {zoomControl:false}).setView([24.018, -104.655], 13);
  L.control.zoom({position:"topright"}).addTo(mapa);
  L.tileLayer(TILES, {maxZoom:19, subdomains:"abcd", attribution:ATRIB}).addTo(mapa);
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
  const ico = {trabajo:"💼", ubicacion:"📍", escuela:"🎒", hospital:"🏥", centro:"⛪"}[estado.ref.tipo] || "📍";
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
  if (enMapa) { iniciarMapa(); setTimeout(() => { mapa.invalidateSize(); pintarPines(ordenar(DESARROLLOS.filter(pasa))); }, 30); }
  else $("#tarjeta-flotante").hidden = true;
}

/* ===== Ficha del desarrollo ===== */
let mapaFicha = null;
function abrirFicha(d){
  document.body.classList.add("en-ficha");
  $("#principal").hidden = true; $(".categorias").hidden = true; $("#ficha").hidden = false;
  const c = cercanos(d), am = amenidades(d), pm = porM2(d);
  const imgs = [
    ...(d.fotos.length ? d.fotos.map(f => `<img src="${esc(f)}" alt="Foto de ${esc(d.nombre)}">`) : [ilustracion(d, 0)]),
  ];
  const extra = [ilustracion(d, 1), laminaCerca(d) || ilustracion(d, 3), laminaBasico(d), ilustracion(d, 2)];
  const mosaico = [...imgs, ...extra].slice(0, 5);
  const carrusel = [...imgs, ...extra.filter(x => !x.startsWith("<svg")).slice(0, 2)];
  const aviso = d.fotos.length ? "" : `<span class="ilustrativa">Imagen ilustrativa</span>`;

  // Lo mejor de aquí: solo cosas buenas y ciertas
  const mejores = [];
  if (c) {
    const n = c.conteo, f = [];
    if (n.escuela) f.push(`${n.escuela} ${n.escuela === 1 ? "escuela" : "escuelas"}`);
    if (n.oxxo) f.push(`${n.oxxo} ${n.oxxo === 1 ? "OXXO" : "OXXOs"}`);
    if (n.farmacia) f.push(`${n.farmacia} ${n.farmacia === 1 ? "farmacia" : "farmacias"}`);
    if (f.length) mejores.push(["🚶", `<b>A menos de 1 km tienes ${f.join(", ")}.</b>`]);
  }
  if (pm && pm < PROM_M2[d.tipo] * .97) mejores.push(["📉", `<b>Su precio por m² (${dinero(pm)}) está ${Math.round((1 - pm / PROM_M2[d.tipo]) * 100)}% abajo</b> del promedio de los ${d.tipo === "casa" ? "fraccionamientos" : "edificios"} nuevos de Durango en ARVENTA.`]);
  const usadas = new Set();
  for (const a of am) { const v = (d.ventajas || []).find(v => AMEN[a].re.test(v)) || AMEN[a].nombre; if (usadas.has(v)) continue; usadas.add(v); mejores.push([AMEN[a].ico, esc(v)]); }
  for (const v of d.ventajas || []) if (!am.some(a => AMEN[a].re.test(v)) && !/crédito|infonavit|fovissste/i.test(v)) mejores.push(["✔️", esc(v)]);
  if (d.entrega === "Preventa" && d.tipo !== "terreno") mejores.push(["🏗️", "Comprar en preventa suele salir entre 10% y 20% más barato que una vivienda ya terminada."]);

  const filasCerca = c ? Object.keys(CATS).filter(k => c.mas[k] && c.mas[k].m <= 5000).map(k => {
    const l = c.mas[k], cam = minCaminando(l.m), modo = cam <= 20 ? `${cam} min caminando` : `${minAuto(l.m)} min en auto`;
    return `<li><span class="ico" aria-hidden="true">${CATS[k].ico}</span><span class="nombre">${esc(l.nombre)}<small>${CATS[k].nombre} más ${CATS[k].f ? "cercana" : "cercano"}</small></span><span class="dist">${textoDist(l.m)}<small>${modo}</small></span></li>`;
  }).join("") : "";
  const seccionCerca = d.lat == null
    ? `<p class="nota">Todavía no tenemos la ubicación exacta. En cuanto la confirmemos verás aquí qué tiene cerca.</p>`
    : (c ? `<ul class="cerca">${filasCerca}</ul><div class="mapa-ficha" id="mapa-ficha" role="img" aria-label="Mapa de lo que hay cerca"></div><p class="nota">Distancias en línea recta según OpenStreetMap${d.aprox ? ", desde una ubicación aproximada" : ""}. El tiempo caminando considera las vueltas de las calles.</p>`
         : `<p class="nota">Cargando lugares cercanos…</p><div class="mapa-ficha" id="mapa-ficha"></div>`);
  const camino = d.lat == null ? `<p class="nota">Disponible cuando confirmemos la ubicación.</p>`
    : estado.ref?.tipo === "trabajo" && MINUTOS[d.id] != null ? `<p class="resumen"><span><b>${MINUTOS[d.id]} min</b> en auto a ${esc(estado.ref.nombre)}</span></p>`
    : estado.ref ? `<p class="resumen"><span><b>${textoDist(metros(d, estado.ref))}</b> de ${esc(estado.ref.nombre)}</span></p><p class="nota"><button type="button" class="enlace" id="f-trabajo">Calcula los minutos a tu trabajo</button>.</p>`
    : `<p class="nota" style="margin:0"><button type="button" class="enlace" id="f-trabajo">Dinos dónde trabajas</button> y te decimos cuántos minutos haces desde aquí.</p>`;
  const pend = `<dd class="pend">Por confirmar</dd>`;

  $("#ficha").innerHTML = `
    <div class="ficha-texto-top">
      <button class="volver" type="button" id="volver"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>Todos los desarrollos</button>
    </div>
    <div class="galeria-movil"><div class="carril">${carrusel.map(x => `<div class="lamina">${x}</div>`).join("")}</div>${aviso}</div>
    <div class="ficha-texto">
      <h1 id="ficha-titulo">${esc(d.nombre)}</h1>
      <p class="sub-titulo">${esc(TIPO[d.tipo])} · ${esc(d.zona)}${d.aprox ? " (ubicación aproximada)" : ""}</p>
    </div>
    <div class="mosaico">${mosaico.map((x, i) => `<div>${x}${i === 0 ? aviso : ""}</div>`).join("")}</div>
    <div class="cuerpo-ficha">
      <div>
        <section class="seccion">
          <ul class="resumen">${d.tipo !== "terreno" ? `<li><b>${esc(d.recamaras)}</b> recámaras</li>` : ""}<li><b>${esc(d.m2)}</b></li>${pm ? `<li><b>${dinero(pm)}</b> por m²</li>` : ""}${d.desarrolladora ? `<li>Por ${esc(d.desarrolladora)}</li>` : ""}</ul>
        </section>
        ${mejores.length ? `<section class="seccion"><h2>Lo mejor de aquí</h2><ul class="lo-mejor">${mejores.map(([i, t]) => `<li><span class="i" aria-hidden="true">${i}</span><span>${t}</span></li>`).join("")}</ul></section>` : ""}
        <section class="seccion"><h2>Lo que tienes cerca</h2>${seccionCerca}</section>
        <section class="seccion"><h2>Tu camino al trabajo</h2>${camino}</section>
        <section class="seccion"><h2>Condiciones</h2>
          <dl class="condiciones">
            <div><dt>Precio</dt><dd>Desde ${dinero(d.desde)}${d.hasta ? ` hasta ${dinero(d.hasta)}` : ""}</dd><dd class="pend">Puede variar al cerrar la operación</dd></div>
            <div><dt>Créditos que acepta</dt>${d.creditos.length ? `<dd>${esc(d.creditos.join(", "))}</dd>` : pend}</div>
            <div><dt>Entrega</dt>${d.entrega ? `<dd>${esc(d.entrega)}${d.fechaEntrega ? ". " + esc(d.fechaEntrega) : ""}</dd>` : pend}</div>
            <div><dt>Qué incluye</dt>${d.incluye ? `<dd>${esc(d.incluye)}</dd>` : pend}</div>
            ${d.modelos ? `<div><dt>Modelos</dt><dd>${esc(d.modelos)}</dd></div>` : ""}
            <div><dt>Ubicación</dt><dd>${d.lat == null ? "Por confirmar" : d.aprox ? "Aproximada, por zona" : "Confirmada"}</dd></div>
          </dl>
          <p class="nota">${d.convenio ? "ARVENTA es asesor externo autorizado de esta desarrolladora." : "Información pública de anuncios. ARVENTA te acompaña a la visita y te ayuda con el trámite, sin costo para ti."}</p>
        </section>
        <section class="seccion fuentes"><h2>De dónde salen estos datos</h2>
          <p class="nota" style="margin:0">Visto en ${d.fuentes.map((f, i) => { const rep = d.fuentes.filter(x => x[0] === f[0]).length > 1; return `<a href="${esc(f[1])}" target="_blank" rel="noopener">${esc(f[0])}${rep ? " (" + d.fuentes.slice(0, i + 1).filter(x => x[0] === f[0]).length + ")" : ""}</a>`; }).join(", ")}. Precios verificados en ${esc(window.PRECIOS_VERIFICADOS)}.</p>
        </section>
      </div>
      <aside class="caja" aria-label="Precio y visita">
        <p class="precio">${dinero(d.desde)} <small>precio desde</small></p>
        <p class="rango">${d.hasta ? `Hasta ${dinero(d.hasta)} según modelo. ` : ""}Puede variar al cerrar.</p>
        <div class="calc">
          <label>Precio<input id="c-precio" type="number" min="0" step="1000" value="${d.desde}"></label>
          <label>Enganche<select id="c-eng"><option value="0.1">10%</option><option value="0.15">15%</option><option value="0.2" selected>20%</option><option value="0.3">30%</option></select></label>
          <label>Tasa anual %<input id="c-tasa" type="number" min="1" max="30" step="0.05" value="${TASA_BANCO}"></label>
          <label>Plazo<select id="c-plazo"><option value="10">10 años</option><option value="15">15 años</option><option value="20" selected>20 años</option></select></label>
          <div class="mensual" aria-live="polite">Mensualidad estimada con banco<b id="c-res"></b><span id="c-eng-txt"></span></div>
        </div>
        <button class="btn" type="button" id="agendar">Agendar visita</button>
        <p class="leyenda">Agendar no te cuesta nada. Estimación sin seguros ni comisiones; las tasas en México van de 9% a 13%.</p>
      </aside>
    </div>
    <div class="barra-reserva"><span><b>desde ${corto(d.desde)}</b><small>${esc(TIPO[d.tipo])} · ${esc(zonaCorta(d))}</small></span><button class="btn" type="button" id="agendar-2">Agendar visita</button></div>`;
  $("#volver").onclick = () => { history.length > 1 && cameFromList ? history.back() : (location.hash = ""); };
  $("#agendar").onclick = $("#agendar-2").onclick = () => agendar(d);
  $("#f-trabajo")?.addEventListener("click", () => abrirCerca("trabajo"));
  ["c-precio", "c-eng", "c-tasa", "c-plazo"].forEach(id => $("#" + id).oninput = calcular);
  calcular();
  window.scrollTo({top:0});
  document.title = `${d.nombre}: ${TIPO[d.tipo].toLowerCase()} desde ${corto(d.desde)} · ARVENTA`;
  if (d.lat != null) setTimeout(() => mapaDeFicha(d, c), 0);
}
function mapaDeFicha(d, c){
  if (mapaFicha) { mapaFicha.remove(); mapaFicha = null; }
  const el = $("#mapa-ficha"); if (!el) return;
  mapaFicha = L.map(el, {scrollWheelZoom:false, zoomControl:true}).setView([d.lat, d.lng], 15);
  L.tileLayer(TILES, {maxZoom:19, subdomains:"abcd", attribution:ATRIB}).addTo(mapaFicha);
  L.circle([d.lat, d.lng], {radius:310, color:"#2F6B5E", weight:1.5, dashArray:"4 6", fillColor:"#2F6B5E", fillOpacity:.07, interactive:false}).addTo(mapaFicha);
  L.circle([d.lat, d.lng], {radius:615, color:"#2F6B5E", weight:1, dashArray:"2 8", fill:false, interactive:false}).addTo(mapaFicha);
  L.marker([d.lat, d.lng], {icon:L.divIcon({className:"", html:`<span class="pin activo">${corto(d.desde)}</span>`, iconSize:[0, 0]}), keyboard:false}).addTo(mapaFicha);
  const pts = [[d.lat, d.lng]];
  if (c) for (const k of ["escuela", "oxxo", "super", "farmacia", "salud", "parque"]) {
    const l = c.mas[k]; if (!l || l.m > 2500) continue;
    L.polyline([[d.lat, d.lng], [l.lat, l.lng]], {color:"#F0A202", weight:3, opacity:.9, interactive:false}).addTo(mapaFicha);
    L.marker([l.lat, l.lng], {icon:L.divIcon({className:"", html:`<div class="poi" title="${esc(l.nombre)}">${CATS[k].ico}</div><span class="poi-etq">${textoDist(l.m)}</span>`, iconSize:[0, 0]}), title:l.nombre, keyboard:false}).addTo(mapaFicha);
    pts.push([l.lat, l.lng]);
  }
  if (pts.length > 1) mapaFicha.fitBounds(L.latLngBounds(pts).pad(.2), {maxZoom:16});
}
function cerrarFicha(){
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
let cameFromList = false;
function ruta(){
  const id = decodeURIComponent(location.hash.slice(1));
  const d = DESARROLLOS.find(x => x.id === id);
  if (d) abrirFicha(d); else { cerrarFicha(); pintar(); }
}
window.addEventListener("hashchange", () => { cameFromList = true; ruta(); });

/* ===== Agendar visita ===== */
let visitaDe = null;
function agendar(d){ visitaDe = d; $("#visita-a").textContent = `${d.nombre}, desde ${dinero(d.desde)}`; $("#dlg-visita").showModal(); }
$("#form-visita").addEventListener("submit", e => {
  if (e.submitter && e.submitter.value === "cancelar") return;
  e.preventDefault();
  if (!$("#v-consent").checked) { $("#v-consent").focus(); return; }
  const url = location.href.split("#")[0] + "#" + visitaDe.id;
  const msg = `Hola ARVENTA, quiero visitar ${visitaDe.nombre} (desde ${dinero(visitaDe.desde)}).\nNombre: ${$("#v-nombre").value}\nWhatsApp: ${$("#v-tel").value}\nCuándo: ${$("#v-cuando").value}\nPago: ${$("#v-credito").value}\n${url}`;
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
$("#buscador").addEventListener("submit", e => { e.preventDefault(); estado.q = $("#q").value.trim(); $("#q2").value = estado.q; if (location.hash) location.hash = ""; pintar(); $("#resultados").scrollIntoView({behavior:"smooth"}); });
$("#q").addEventListener("input", () => { estado.q = $("#q").value.trim(); $("#q2").value = estado.q; pintar(); });
$("#q2").addEventListener("input", () => { estado.q = $("#q2").value.trim(); $("#q").value = estado.q; pintar(); });
$("#abrir-cerca").onclick = () => abrirCerca();
$("#buscador-movil").onclick = () => abrirCerca();
$("#abrir-presupuesto").onclick = $("#abrir-presupuesto-2").onclick = () => { pintarPresupuesto(); if ($("#dlg-cerca").open) $("#dlg-cerca").close(); $("#dlg-presupuesto").showModal(); };
$("#in-ingreso").oninput = $("#in-ahorro").oninput = calcularAlcance;
$("#quitar-pres").onclick = () => { estado.max = null; estado.presEtiqueta = null; $("#in-ingreso").value = ""; $("#in-ahorro").value = ""; $("#res-alcance").textContent = ""; pintarPresupuesto(); pintar(); };
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
  $("#dlg-cerca").close(); if (location.hash) location.hash = "";
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
$("#limpiar-filtros").onclick = () => { estado.recMin = 0; ["creditos", "amen", "cercaReq", "entrega"].forEach(k => estado[k].clear()); pintarFiltros(); };
$("#dlg-filtros").addEventListener("close", pintar);
$("#alternar").onclick = () => cambiarVista(estado.vista === "mapa" ? "lista" : "mapa");
$("#fecha-precios").textContent = window.PRECIOS_VERIFICADOS;
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
cargarLugares().then(() => {
  CERCA_CACHE.clear();
  const id = location.hash.slice(1), d = DESARROLLOS.find(x => x.id === id);
  if (d) abrirFicha(d); else pintar();
});
