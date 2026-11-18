/* ARVENTA · Guarda solicitudes en esta hoja de Google y entrega el reporte.
   Se pega en la hoja: Extensiones → Apps Script. Instrucciones completas en LEEME.md.

   POST (desde el sitio):  {tipo:"visita"|"desarrolladora", folio, ...}  → agrega una fila
   GET  ?accion=reporte&clave=...&dias=30|90|365&d=<id>                 → números agregados

   El reporte nunca devuelve nombres, WhatsApp ni correos: solo conteos, y las zonas de
   trabajo redondeadas a ~1 km y únicamente cuando hay al menos MIN_GRUPO personas. */

const HOJAS = {
  visita: {
    nombre: "Solicitudes",
    columnas: ["Fecha", "Folio", "Desarrollo", "Nombre", "WhatsApp", "Cuándo", "Pago",
               "Trabajo (lo que escribió)", "Trabajo lat (≈1 km)", "Trabajo lng (≈1 km)", "Minutos en auto",
               "Consentimiento", "Estado"]
  },
  desarrolladora: {
    nombre: "Desarrolladoras",
    columnas: ["Fecha", "Folio", "Nombre", "Empresa", "Desarrollo", "Ubicación", "Tipo", "Unidades",
               "Precio desde", "WhatsApp", "Correo", "Mensaje", "Estado"]
  }
};
const COL = {fecha:0, folio:1, id:2, nombre:3, whatsapp:4, cuando:5, pago:6, trabajo:7, lat:8, lng:9, minutos:10};
const MIN_GRUPO = 2;          // una zona o un lugar de trabajo se muestra solo si lo comparten 2+ personas
const CAJA = {s:23.85, w:-104.85, n:24.20, e:-104.45}; // Durango y alrededores

/* ===================== Entradas web ===================== */

function doPost(e){
  let d;
  try{ d = JSON.parse(e.postData.contents); }catch(err){ return responder({ok:false, error:"formato"}); }
  if(d && d.sitio) return responder({ok:true}); // campo trampa: solo un robot lo llena
  const ahora = new Date();
  const fila = d && d.tipo === "visita" ? filaVisita(d, ahora)
             : d && d.tipo === "desarrolladora" ? filaDesarrolladora(d, ahora)
             : {error:"tipo"};
  if(fila.error) return responder({ok:false, error:fila.error});

  const candado = LockService.getScriptLock();
  candado.waitLock(10000);
  try{
    const hoja = hojaDe(d.tipo);
    // Si el mismo folio ya llegó (reintento del navegador), no se duplica
    const ultimas = Math.min(500, hoja.getLastRow() - 1);
    const folios = ultimas > 0 ? hoja.getRange(hoja.getLastRow() - ultimas + 1, 2, ultimas, 1).getValues().map(r => r[0]) : [];
    if(folios.indexOf(fila.valores[1]) === -1) hoja.appendRow(fila.valores);
  }finally{
    candado.releaseLock();
  }
  return responder({ok:true, folio:fila.valores[1]});
}

function doGet(e){
  const p = (e && e.parameter) || {};
  if(p.accion !== "reporte") return responder({ok:true, servicio:"ARVENTA"});
  const props = PropertiesService.getScriptProperties();
  const clave = props.getProperty("CLAVE_REPORTE");
  if(!clave || p.clave !== clave) return responder({ok:false, error:"clave"});

  const dias = [30, 90, 365].indexOf(Number(p.dias)) >= 0 ? Number(p.dias) : 30;
  const hasta = new Date(), desde = new Date(hasta.getTime() - dias * 864e5);
  const id = /^[a-z0-9-]{1,60}$/.test(p.d || "") ? p.d : "";
  const medicion = medicionUmami(props, desde, hasta, dias);
  return responder(agregarReporte(filasDe("visita"), medicion, desde, hasta, id));
}

/* ===================== Filas ===================== */

// Texto seguro para la hoja: recortado y sin fórmulas (=, +, -, @ al inicio se ejecutarían)
function texto(v, max){
  let t = String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max || 120);
  if(/^[=+\-@]/.test(t)) t = "'" + t;
  return t;
}
function coord(v, min, max){
  const n = Number(v);
  return v === null || v === "" || !isFinite(n) || n < min || n > max ? "" : Math.round(n * 100) / 100;
}
function folioValido(f, prefijo){ return new RegExp("^" + prefijo + "-[A-Z0-9]{6}$").test(String(f || "")); }

function filaVisita(d, ahora){
  if(!folioValido(d.folio, "V")) return {error:"folio"};
  if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(d.id || ""))) return {error:"desarrollo"};
  if(!texto(d.nombre)) return {error:"nombre"};
  const tel = String(d.whatsapp || "").replace(/\D/g, "");
  if(tel.length < 10 || tel.length > 13) return {error:"whatsapp"};
  // Sin la casilla marcada no se guarda: es lo que permite pasar los datos a la desarrolladora
  if(d.consentimiento !== true) return {error:"consentimiento"};
  const t = d.trabajo || {};
  const min = Number(d.minutos);
  return {valores:[
    ahora, d.folio, d.id, texto(d.nombre, 80), "'" + tel, texto(d.cuando, 60), texto(d.pago, 60),
    texto(t.texto, 80), coord(t.lat, CAJA.s, CAJA.n), coord(t.lng, CAJA.w, CAJA.e),
    isFinite(min) && min > 0 && min < 300 && d.minutos !== null && d.minutos !== "" ? Math.round(min) : "",
    "Sí, compartir con la desarrolladora (aviso del " + texto(d.versionAviso, 40) + ")",
    "Nueva"
  ]};
}
function filaDesarrolladora(d, ahora){
  if(!folioValido(d.folio, "D")) return {error:"folio"};
  if(!texto(d.nombre) || !texto(d.desarrollo)) return {error:"faltan-datos"};
  if(!/\d{10}/.test(String(d.whatsapp || "").replace(/\D/g, "")) && !/@/.test(String(d.correo || ""))) return {error:"contacto"};
  return {valores:[
    ahora, d.folio, texto(d.nombre, 80), texto(d.empresa, 80), texto(d.desarrollo, 80), texto(d.ubicacion, 120),
    texto(d.tipoVivienda, 40), texto(d.unidades, 20), texto(d.precio, 30), texto(d.whatsapp, 30),
    texto(d.correo, 80), texto(d.mensaje, 1000), "Nueva"
  ]};
}

/* ===================== Reporte ===================== */

function mediana(nums){
  if(!nums.length) return null;
  const s = nums.slice().sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}
function contar(lista){
  const m = {};
  lista.forEach(k => { if(k !== "" && k != null) m[k] = (m[k] || 0) + 1; });
  return Object.keys(m).map(k => ({k:k, n:m[k]})).sort((a, b) => b.n - a.n);
}
function inicioSemana(f){ // lunes 00:00
  const d = new Date(f.getFullYear(), f.getMonth(), f.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
function iso(f){ // aaaa-mm-dd en la zona horaria del proyecto
  const p = n => (n < 10 ? "0" : "") + n;
  return f.getFullYear() + "-" + p(f.getMonth() + 1) + "-" + p(f.getDate());
}

/* filas: valores de la hoja "Solicitudes" (sin encabezado)
   medicion: {ok, motivo?, vistas:{id:n}, compartidos:{id:n}} */
function agregarReporte(filas, medicion, desde, hasta, id){
  const sel = filas.filter(f => {
    const t = f[COL.fecha] instanceof Date ? f[COL.fecha] : new Date(f[COL.fecha]);
    return !isNaN(t) && t >= desde && t <= hasta && (!id || f[COL.id] === id);
  });
  const vistas = (medicion && medicion.vistas) || {}, compartidos = (medicion && medicion.compartidos) || {};

  // Por desarrollo
  const ids = {};
  sel.forEach(f => { ids[f[COL.id]] = true; });
  Object.keys(vistas).concat(Object.keys(compartidos)).forEach(k => { ids[k] = true; });
  const desarrollos = Object.keys(ids).filter(k => !id || k === id).map(k => ({
    id:k,
    vistas:vistas[k] || 0,
    compartidos:compartidos[k] || 0,
    solicitudes:sel.filter(f => f[COL.id] === k).length
  })).sort((a, b) => b.solicitudes - a.solicitudes || b.vistas - a.vistas);

  // Solicitudes por semana, incluidas las semanas en cero
  const semanas = [];
  for(let s = inicioSemana(desde); s <= hasta; s = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7)){
    const fin = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7);
    semanas.push({inicio:iso(s), n:sel.filter(f => { const t = new Date(f[COL.fecha]); return t >= s && t < fin; }).length});
  }

  // Zonas de trabajo: celdas de ~1 km; las que tienen menos de MIN_GRUPO personas se suman en "otras"
  const zonasTodas = contar(sel.filter(f => f[COL.lat] !== "" && f[COL.lng] !== "").map(f => f[COL.lat] + "," + f[COL.lng]));
  const zonas = zonasTodas.filter(z => z.n >= MIN_GRUPO).map(z => {
    const c = z.k.split(",");
    return {lat:Number(c[0]), lng:Number(c[1]), n:z.n};
  });
  const zonasOtras = zonasTodas.filter(z => z.n < MIN_GRUPO).reduce((a, z) => a + z.n, 0);

  // Lugares de trabajo escritos ("UJED", "Hospital 450"): se agrupan sin importar mayúsculas ni acentos
  const norm = t => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  const grupos = {};
  sel.forEach(f => {
    const t = String(f[COL.trabajo] || "").replace(/^'/, "").trim();
    if(!t) return;
    const k = norm(t);
    (grupos[k] = grupos[k] || {texto:t, n:0}).n++;
  });
  const lugares = Object.keys(grupos).map(k => grupos[k]).filter(g => g.n >= MIN_GRUPO).sort((a, b) => b.n - a.n).slice(0, 10);

  const minutos = sel.map(f => f[COL.minutos]).filter(m => m !== "" && isFinite(Number(m))).map(Number);
  const suma = k => desarrollos.reduce((a, d) => a + d[k], 0);
  return {
    ok:true,
    desde:iso(desde), hasta:iso(hasta),
    desarrollo:id || null,
    medicion:{ok:!!(medicion && medicion.ok), motivo:(medicion && medicion.motivo) || ""},
    totales:{vistas:suma("vistas"), solicitudes:sel.length, compartidos:suma("compartidos")},
    desarrollos:desarrollos,
    semanas:semanas,
    pago:contar(sel.map(f => f[COL.pago])),
    cuando:contar(sel.map(f => f[COL.cuando])),
    zonas:zonas, zonasOtras:zonasOtras,
    lugares:lugares,
    conTrabajo:sel.filter(f => f[COL.lat] !== "" || f[COL.trabajo]).length,
    minutosMediana:mediana(minutos),
    minGrupo:MIN_GRUPO
  };
}

/* ===================== Umami (vistas y compartidos) ===================== */

function medicionUmami(props, desde, hasta, dias){
  const llave = props.getProperty("UMAMI_API_KEY"), sitio = props.getProperty("UMAMI_WEBSITE_ID");
  if(!llave || !sitio) return {ok:false, motivo:"Umami no está configurado; las vistas salen en cero."};
  const cache = CacheService.getScriptCache(), clave = "umami-" + dias;
  const guardado = cache.get(clave);
  if(guardado) return JSON.parse(guardado);
  const base = (props.getProperty("UMAMI_API_URL") || "https://api.umami.is/v1").replace(/\/$/, "");
  const porId = evento => {
    // Umami cambió el nombre del parámetro (eventName → event); se mandan los dos
    const q = "startAt=" + desde.getTime() + "&endAt=" + hasta.getTime() + "&eventName=" + evento + "&event=" + evento + "&propertyName=id";
    const r = UrlFetchApp.fetch(base + "/websites/" + sitio + "/event-data/values?" + q,
      {headers:{"x-umami-api-key":llave, "Accept":"application/json"}, muteHttpExceptions:true});
    if(r.getResponseCode() !== 200) throw new Error("Umami respondió " + r.getResponseCode());
    const m = {};
    JSON.parse(r.getContentText()).forEach(x => { m[x.value] = (m[x.value] || 0) + Number(x.total); });
    return m;
  };
  try{
    const res = {ok:true, vistas:porId("ver-desarrollo"), compartidos:porId("compartir-whatsapp")};
    cache.put(clave, JSON.stringify(res), 600); // 10 minutos
    return res;
  }catch(err){
    return {ok:false, motivo:String(err.message || err)};
  }
}

/* ===================== Hoja ===================== */

function hojaDe(tipo){
  const conf = HOJAS[tipo], libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(conf.nombre);
  if(!hoja){
    hoja = libro.insertSheet(conf.nombre);
    hoja.appendRow(conf.columnas);
    hoja.setFrozenRows(1);
    hoja.getRange(1, 1, 1, conf.columnas.length).setFontWeight("bold");
  }
  return hoja;
}
function filasDe(tipo){
  const hoja = hojaDe(tipo), n = hoja.getLastRow() - 1;
  return n > 0 ? hoja.getRange(2, 1, n, HOJAS[tipo].columnas.length).getValues() : [];
}
function responder(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* Córrela una vez desde el editor (botón ▶ Ejecutar). Crea las pestañas y la clave del reporte. */
function configurar(){
  hojaDe("visita");
  hojaDe("desarrolladora");
  const props = PropertiesService.getScriptProperties();
  if(!props.getProperty("CLAVE_REPORTE")) props.setProperty("CLAVE_REPORTE", Utilities.getUuid().replace(/-/g, ""));
  Logger.log("Listo. Clave del reporte: " + props.getProperty("CLAVE_REPORTE"));
  Logger.log("Para las vistas, agrega en Configuración del proyecto → Propiedades de la secuencia de comandos: UMAMI_API_KEY y UMAMI_WEBSITE_ID.");
}
