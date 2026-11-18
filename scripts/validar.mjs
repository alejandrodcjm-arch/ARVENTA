/* Valida data/desarrollos.json. Si hay errores, termina con código 1 y el despliegue se detiene
   (lo corre GitHub Actions en cada cambio). Uso: node scripts/validar.mjs */
import {readFileSync, existsSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const TIPOS = ["casa", "departamento", "terreno"];
export const CREDITOS = ["Infonavit", "Fovissste", "Banco", "Cofinavit", "Contado"];
export const ENTREGAS = ["Preventa", "Entrega inmediata"];
export const DIAS_VIGENCIA = 60; // pasado esto, la ficha dice "precio por confirmar"
const CAJA = {s:23.85, w:-104.85, n:24.20, e:-104.45};

const texto = v => typeof v === "string" && v.trim() !== "";
const esNumero = v => typeof v === "number" && Number.isFinite(v);
export function diasDesde(fecha, hoy = new Date()){
  const f = new Date(fecha + "T12:00:00");
  return Math.floor((hoy - f) / 864e5);
}

export function cargar(){ return JSON.parse(readFileSync(path.join(RAIZ, "data/desarrollos.json"), "utf8")); }

export function validar(lista, {hoy = new Date(), raiz = RAIZ} = {}){
  const errores = [], avisos = [];
  if(!Array.isArray(lista)) return {errores:["data/desarrollos.json debe ser una lista [ … ]."], avisos};
  const vistos = new Map();
  const pend = {creditos:[], entrega:[], incluye:[], convenio:[], ubicacion:[], vencidos:[]};
  lista.forEach((d, i) => {
    const quien = `#${i + 1} ${texto(d?.id) ? d.id : "(sin id)"}`;
    const error = m => errores.push(`${quien}: ${m}`);
    if(!d || typeof d !== "object"){ error("no es un objeto { … }."); return; }
    if(!texto(d.id) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.id)) error("id vacío o inválido (solo minúsculas sin acento, números y guiones; es parte de la dirección).");
    else if(vistos.has(d.id)) error(`id repetido; ya lo usa el #${vistos.get(d.id)}.`);
    else vistos.set(d.id, i + 1);
    if(!texto(d.nombre)) error("falta el nombre.");
    if(!TIPOS.includes(d.tipo)) error(`tipo ${JSON.stringify(d.tipo)} inválido; usa ${TIPOS.join(", ")}.`);
    if(!esNumero(d.desde) || d.desde <= 0) error(`"desde" debe ser un número mayor que cero (está como ${JSON.stringify(d.desde)}).`);
    if(d.hasta != null && (!esNumero(d.hasta) || d.hasta < d.desde)) error(`"hasta" debe ser un número mayor o igual que "desde".`);
    if(!texto(d.zona)) error("falta la zona.");
    // fuentes y verificación
    if(!Array.isArray(d.fuentes) || !d.fuentes.length) error("necesita al menos una fuente [nombre, url].");
    else d.fuentes.forEach((f, j) => { if(!Array.isArray(f) || !texto(f[0]) || !/^https?:\/\/\S+$/.test(f[1] || "")) error(`la fuente ${j + 1} debe ser ["Nombre", "https://…"].`); });
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d.verificado || "") || isNaN(new Date(d.verificado))) error(`falta "verificado" con la fecha en que se confirmó el precio, como "2026-11-18".`);
    else{
      const dias = diasDesde(d.verificado, hoy);
      if(dias < 0) error(`"verificado" (${d.verificado}) está en el futuro.`);
      else if(dias > DIAS_VIGENCIA) pend.vencidos.push(`${d.id} (${dias} días)`);
    }
    // ubicación
    const sinUb = d.lat == null && d.lng == null;
    if(sinUb) pend.ubicacion.push(d.id);
    else if(!esNumero(d.lat) || !esNumero(d.lng)) error("lat y lng deben ser números, o los dos null.");
    else if(d.lat < CAJA.s || d.lat > CAJA.n || d.lng < CAJA.w || d.lng > CAJA.e) error(`la ubicación ${d.lat}, ${d.lng} queda fuera de Durango (¿lat y lng al revés?).`);
    if(typeof d.aprox !== "boolean") error("aprox debe ser true o false.");
    // NOM-247: solo datos confirmados
    if(!Array.isArray(d.creditos)) error('creditos debe ser una lista, [] si no está confirmado.');
    else{ d.creditos.filter(c => !CREDITOS.includes(c)).forEach(c => error(`crédito ${JSON.stringify(c)} inválido; usa ${CREDITOS.join(", ")}.`)); if(!d.creditos.length) pend.creditos.push(d.id); }
    if(!("entrega" in d)) error('falta "entrega" ("Preventa", "Entrega inmediata" o null).');
    else if(d.entrega === null) pend.entrega.push(d.id);
    else if(!ENTREGAS.includes(d.entrega)) error(`entrega ${JSON.stringify(d.entrega)} inválida.`);
    if(d.incluye == null) pend.incluye.push(d.id); else if(!texto(d.incluye)) error("incluye debe ser texto o null.");
    if(typeof d.convenio !== "boolean") error("convenio debe ser true o false.");
    else if(!d.convenio) pend.convenio.push(d.id);
    // fotos: solo con permiso por escrito guardado
    if(!Array.isArray(d.fotos)) error("fotos debe ser una lista ([] si no hay).");
    else if(d.fotos.length){
      if(!texto(d.permisoFotos)) error('tiene fotos pero falta "permisoFotos": de quién y cuándo se recibió el permiso por escrito.');
      d.fotos.forEach(f => {
        const archivo = typeof f === "string" ? f : f?.archivo;
        if(!texto(archivo) || !existsSync(path.join(raiz, archivo))) error(`la foto ${JSON.stringify(archivo)} no existe.`);
        else if(!/\.webp$/i.test(archivo)) avisos.push(`${quien}: ${archivo} no es WebP; conviértela para que cargue rápido.`);
      });
    }
  });
  const grupo = (l, t) => { if(l.length) avisos.push(`${t} (${l.length}): ${l.join(", ")}.`); };
  grupo(pend.vencidos, `Precio verificado hace más de ${DIAS_VIGENCIA} días; la ficha dice "precio por confirmar"`);
  grupo(pend.ubicacion, "Sin ubicación (no salen en el mapa)");
  grupo(pend.creditos, "Créditos por confirmar");
  grupo(pend.entrega, "Entrega por confirmar");
  grupo(pend.incluye, "\"Qué incluye\" por confirmar");
  grupo(pend.convenio, "Sin convenio de asesor externo");
  return {errores, avisos};
}

if(process.argv[1] === fileURLToPath(import.meta.url)){
  let lista;
  try{ lista = cargar(); }catch(e){ console.error("data/desarrollos.json no es JSON válido:\n  " + e.message); process.exit(1); }
  const {errores, avisos} = validar(lista);
  console.log(`Revisé ${lista.length} desarrollos.\n`);
  if(errores.length){ console.log(`✗ ${errores.length} errores:`); errores.forEach(e => console.log("  - " + e)); console.log(""); }
  if(avisos.length){ console.log(`! ${avisos.length} avisos:`); avisos.forEach(a => console.log("  - " + a)); console.log(""); }
  console.log(errores.length ? "Corrige los errores: no se puede publicar." : "✓ Datos válidos.");
  process.exit(errores.length ? 1 : 0);
}
