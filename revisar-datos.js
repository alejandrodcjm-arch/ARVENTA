/* Revisa datos.js antes de publicar (paso 3 de "Antes de terminar cualquier cambio" en CLAUDE.md).

   Uso:
     node revisar-datos.js

   Errores (hay que corregirlos; el script termina con código 1):
     - id repetido, vacío o con caracteres que no sirven en un enlace (solo a-z, 0-9 y guiones)
     - nombre vacío
     - precio "desde" que no es número, o "hasta" que no es número o es menor que "desde"
     - tipo distinto de casa, departamento o terreno
     - sin fuentes, o una fuente sin nombre o sin enlace http(s)
     - lat/lng que no son números (o solo uno de los dos)
     - creditos que no es una lista, o con un crédito que no existe
     - entrega distinta de "Preventa", "Entrega inmediata" o null
     - convenio que no es true/false; fotos que no existen en la carpeta
     - falta window.PRECIOS_VERIFICADOS (la fecha en que se verificaron los precios)
   Avisos (no detienen nada):
     - desarrollos sin ubicación (lat:null), que no salen en el mapa
     - ubicación fuera del área de Durango (¿lat y lng al revés?)
     - créditos, entrega o "qué incluye" por confirmar; desarrollos sin convenio */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const TIPOS = ["casa", "departamento", "terreno"];
const CREDITOS = ["Infonavit", "Fovissste", "Banco", "Cofinavit", "Contado"];
const ENTREGAS = ["Preventa", "Entrega inmediata"];
const CAJA = {s:23.95, w:-104.77, n:24.10, e:-104.56}; // la misma área que app.js

// Ejecuta datos.js como lo haría el navegador
function cargarTodo(archivo = path.join(__dirname, "datos.js")){
  const codigo = fs.readFileSync(archivo, "utf8");
  const contexto = {window:{}};
  vm.runInNewContext(codigo, contexto, {filename:archivo});
  return {lista:contexto.window.DESARROLLOS, preciosVerificados:contexto.window.PRECIOS_VERIFICADOS};
}
function cargar(archivo){ return cargarTodo(archivo).lista; }

const esNumero = v => typeof v === "number" && Number.isFinite(v);
const texto = v => typeof v === "string" && v.trim() !== "";

function revisar(lista, {preciosVerificados = "x", raiz = __dirname} = {}){
  const errores = [], avisos = [];
  if(!Array.isArray(lista)){
    errores.push("datos.js no define window.DESARROLLOS como una lista [ ... ].");
    return {errores, avisos, total:0};
  }
  if(!texto(preciosVerificados)) errores.push('Falta window.PRECIOS_VERIFICADOS = "mes de año" en datos.js: la fecha en que se verificaron los precios (NOM-247).');
  const vistos = new Map();
  const pendientes = {creditos:[], entrega:[], incluye:[], convenio:[]};
  lista.forEach((d, i) => {
    const quien = `#${i+1} ${texto(d?.id) ? `"${d.id}"` : ""}${texto(d?.nombre) ? ` (${d.nombre})` : ""}`.trim();
    const error = m => errores.push(`${quien}: ${m}`);
    if(!d || typeof d !== "object"){ error("no es un bloque { ... }"); return; }

    // id y nombre
    if(!texto(d.id)) error("falta el id.");
    else{
      if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.id)) error(`el id "${d.id}" solo puede llevar minúsculas sin acento, números y guiones (se usa en el enlace para compartir).`);
      if(vistos.has(d.id)) error(`el id "${d.id}" está repetido; ya lo usa el #${vistos.get(d.id)}.`);
      else vistos.set(d.id, i+1);
    }
    if(!texto(d.nombre)) error("falta el nombre.");

    // precios
    if(!esNumero(d.desde)) error(`el precio "desde" debe ser un número sin comillas ni comas (está como ${JSON.stringify(d.desde)}).`);
    else if(d.desde <= 0) error(`el precio "desde" debe ser mayor que cero (está en ${d.desde}).`);
    if(d.hasta !== undefined && d.hasta !== null){
      if(!esNumero(d.hasta)) error(`el precio "hasta" debe ser un número sin comillas ni comas (está como ${JSON.stringify(d.hasta)}).`);
      else if(esNumero(d.desde) && d.hasta < d.desde) error(`el precio "hasta" (${d.hasta}) es menor que "desde" (${d.desde}).`);
    }

    if(!TIPOS.includes(d.tipo)) error(`el tipo ${JSON.stringify(d.tipo)} no es válido; usa ${TIPOS.map(t=>`"${t}"`).join(", ")}.`);

    // fuentes
    if(!Array.isArray(d.fuentes) || d.fuentes.length === 0) error("necesita al menos una fuente: fuentes:[[\"Nombre\",\"https://...\"]].");
    else d.fuentes.forEach((f, j) => {
      if(!Array.isArray(f) || !texto(f[0])) error(`la fuente ${j+1} no tiene nombre.`);
      if(!Array.isArray(f) || !/^https?:\/\/\S+$/.test(f[1] || "")) error(`la fuente ${j+1} no tiene un enlace que empiece con http:// o https://.`);
    });

    // Condiciones de la ficha (NOM-247): solo datos confirmados
    if(!Array.isArray(d.creditos)) error(`creditos debe ser una lista, como ["Infonavit","Banco"], o [] si no está confirmado.`);
    else{
      d.creditos.filter(c => !CREDITOS.includes(c)).forEach(c => error(`el crédito ${JSON.stringify(c)} no es válido; usa ${CREDITOS.map(x=>`"${x}"`).join(", ")}.`));
      if(!d.creditos.length) pendientes.creditos.push(d.id);
    }
    if(!("entrega" in d)) error('falta el campo entrega ("Preventa", "Entrega inmediata" o null si no se sabe).');
    else if(d.entrega === null) pendientes.entrega.push(d.id);
    else if(!ENTREGAS.includes(d.entrega)) error(`entrega ${JSON.stringify(d.entrega)} no es válida; usa "Preventa", "Entrega inmediata" o null.`);
    if(d.incluye === undefined || d.incluye === null) pendientes.incluye.push(d.id);
    else if(!texto(d.incluye)) error('incluye debe ser un texto (ej. "Cocina integral y closets") o null.');
    if(d.convenio !== undefined && typeof d.convenio !== "boolean") error("convenio debe ser true o false, sin comillas.");
    else if(d.convenio !== true) pendientes.convenio.push(d.id);

    // fotos: deben existir en la carpeta del sitio
    if(d.fotos !== undefined){
      if(!Array.isArray(d.fotos)) error('fotos debe ser una lista: fotos:["fotos/mi-id/1.jpg"].');
      else d.fotos.forEach(f => { if(!texto(f) || !fs.existsSync(path.join(raiz, f))) error(`la foto ${JSON.stringify(f)} no existe en la carpeta del sitio.`); });
    }

    // ubicación
    const sinLat = d.lat === null || d.lat === undefined, sinLng = d.lng === null || d.lng === undefined;
    if(sinLat && sinLng) avisos.push(`${quien}: sin ubicación, no sale en el mapa${texto(d.zona) ? ` (zona: ${d.zona})` : ""}.`);
    else if(sinLat || sinLng) error("tiene lat o lng, pero no ambos.");
    else if(!esNumero(d.lat) || !esNumero(d.lng)) error("lat y lng deben ser números sin comillas.");
    else if(d.lat < CAJA.s || d.lat > CAJA.n || d.lng < CAJA.w || d.lng > CAJA.e)
      avisos.push(`${quien}: la ubicación ${d.lat}, ${d.lng} queda fuera de Durango. ¿Están lat y lng al revés?`);
  });
  // Lo que falta confirmar, agrupado
  const grupo = (l, t) => { if(l.length) avisos.push(`${t} (${l.length}): ${l.join(", ")}.`); };
  grupo(pendientes.creditos, "Créditos por confirmar");
  grupo(pendientes.entrega, "Entrega por confirmar");
  grupo(pendientes.incluye, "\"Qué incluye\" por confirmar");
  grupo(pendientes.convenio, "Sin convenio de asesor externo firmado; la ficha dice \"Información pública\"");
  return {errores, avisos, total:lista.length};
}

if(require.main === module){
  let datos;
  try{ datos = cargarTodo(); }
  catch(e){
    console.error("No se pudo leer datos.js. Revisa comas, llaves y comillas cerca de esto:\n  " + (e.stack || e.message).split("\n").slice(0, 3).join("\n  "));
    process.exit(1);
  }
  const {errores, avisos, total} = revisar(datos.lista, {preciosVerificados:datos.preciosVerificados});
  console.log(`Revisé ${total} desarrollos de datos.js.\n`);
  if(errores.length){ console.log(`✗ ${errores.length} ${errores.length===1?"error":"errores"}:`); errores.forEach(e=>console.log("  - "+e)); console.log(""); }
  if(avisos.length){ console.log(`! ${avisos.length} ${avisos.length===1?"aviso":"avisos"}:`); avisos.forEach(a=>console.log("  - "+a)); console.log(""); }
  console.log(errores.length ? "Corrige los errores antes de publicar." : "✓ Sin errores.");
  process.exit(errores.length ? 1 : 0);
}
module.exports = {cargar, cargarTodo, revisar, TIPOS, CREDITOS};
