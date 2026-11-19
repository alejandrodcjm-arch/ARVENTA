/* POST /api/evento: medición anónima (docs/REQUISITOS.md §8).
   Nunca guarda nombre, teléfono, IP ni ubicación exacta: solo el tipo de evento y datos de una lista cerrada. */
import {leerJSON, texto, sb, desarrollos} from "./_lib/comun.js";

// tipo → campos permitidos y cómo se limpian
const NUM = v => (isFinite(Number(v)) ? Number(v) : null);
const ZONA = v => (isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : null); // ~1 km
const ID = v => (desarrollos().some(d => d.id === v) ? v : null);
export const TIPOS = {
  "ver-ficha":{id:ID}, "clic-agendar":{id:ID}, "solicitud":{id:ID}, "compartir-whatsapp":{id:ID}, "compartir":{id:ID, via:v => (["whatsapp", "copiar", "telefono"].includes(v) ? v : null)},
  "busqueda":{texto:v => texto(v, 60).toLowerCase()}, "filtro":{filtros:v => texto(v, 200)},
  "presupuesto":{hasta:NUM}, "zona-trabajo":{lat:ZONA, lng:ZONA}, "comparar":{cuantos:NUM},
  "calcular-alcance":{}, "asistente":{acciones:NUM, modo:v => (["ia", "demo"].includes(v) ? v : null)}, "contacto-desarrolladora":{}, "cotizacion":{id:ID},
  "error":{mensaje:v => texto(v, 200), archivo:v => texto(v, 80), linea:NUM}
};

export async function POST(request){
  let e;
  try{ e = await leerJSON(request, 2000); }catch(x){ return new Response(null, {status:204}); }
  const campos = TIPOS[e.tipo];
  if(!campos) return new Response(null, {status:204});
  const datos = {};
  for(const [k, limpiar] of Object.entries(campos)){ const v = limpiar(e.datos?.[k]); if(v !== null && v !== "") datos[k] = v; }
  if(e.tipo === "error") console.error("[navegador]", datos.mensaje, datos.archivo, datos.linea);
  try{
    await sb("eventos", {method:"POST", body:{tipo:e.tipo, desarrollo:datos.id || null, datos, pagina:texto(e.pagina, 120) || null}, headers:{Prefer:"return=minimal"}});
  }catch(x){ console.error("[evento]", x.message); }
  return new Response(null, {status:204});
}
