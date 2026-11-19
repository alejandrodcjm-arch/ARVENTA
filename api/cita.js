/* /api/cita: lo que hace el CLIENTE con su enlace (/cita/?c=FOLIO&t=TOKEN). Nada de esto lo decide el asesor.
   GET  ?c&t                         → estado de su cita
   POST {c, t, accion:"confirmar"}   → la cita queda confirmada (es la que se cobra)
   POST {c, t, accion:"llegue", lat, lng, precision}
        → si está a menos de 300 m del desarrollo, registra la hora de llegada. Solo se guarda la
          distancia, nunca su ubicación. Requiere que la ubicación del desarrollo esté confirmada. */
import {desarrollos, respuesta, error, leerJSON, sb, avisar, mismoTexto, metros} from "./_lib/comun.js";

export const RADIO_LLEGADA = 300;      // metros
export const PRECISION_MAX = 150;      // metros: con más error, se pide volver a intentar

async function buscar(c, t){
  if(!/^V-[A-Z2-9]{6}$/.test(c || "")) return null;
  const [s] = await sb(`solicitudes?select=folio,token,nombre,desarrollo,cita_fecha,confirmada_en,llegada_en,llegada_distancia_m,estado&folio=eq.${c}&limit=1`);
  return s && mismoTexto(s.token, t) ? s : null;
}
function publica(s){
  const d = desarrollos().find(x => x.id === s.desarrollo) || {};
  return {ok:true, folio:s.folio, nombre:s.nombre.split(" ")[0], cita_fecha:s.cita_fecha, confirmada:!!s.confirmada_en, confirmada_en:s.confirmada_en,
    llegada_en:s.llegada_en, llegada_distancia_m:s.llegada_distancia_m,
    desarrollo:{id:d.id, nombre:d.nombre, zona:d.zona, verificable:d.lat != null && d.aprox === false, tieneCorrida:!!d.esquemas?.length},
    beneficio:s.llegada_en ? (d.beneficioArventa || null) : null};
}

export async function GET(request){
  const u = new URL(request.url);
  try{
    const s = await buscar(u.searchParams.get("c"), u.searchParams.get("t"));
    return s ? respuesta(200, publica(s)) : error(404, "Este enlace no es válido. Pídenos uno nuevo por WhatsApp.");
  }catch(e){ console.error("[cita]", e.message); return error(502, "No pudimos consultar tu cita. Intenta en un momento."); }
}

export async function POST(request){
  let b;
  try{ b = await leerJSON(request, 1000); }catch(e){ return error(400, "Formato inválido."); }
  try{
    const s = await buscar(b.c, b.t);
    if(!s) return error(404, "Este enlace no es válido. Pídenos uno nuevo por WhatsApp.");
    const d = desarrollos().find(x => x.id === s.desarrollo);
    const cambios = {};
    if(b.accion === "confirmar"){
      if(!s.confirmada_en){
        cambios.confirmada_en = new Date().toISOString();
        if(["nueva", "contactada"].includes(s.estado)) cambios.estado = "visita_agendada";
      }
    }else if(b.accion === "llegue"){
      if(s.llegada_en) return respuesta(200, publica(s));
      if(d.lat == null || d.aprox !== false) return error(409, "Todavía no tenemos la ubicación exacta de este desarrollo, así que no podemos registrar tu llegada. Muestra tu código al asesor.");
      const lat = Number(b.lat), lng = Number(b.lng), precision = Number(b.precision);
      if(!isFinite(lat) || !isFinite(lng)) return error(400, "No llegó tu ubicación.");
      if(isFinite(precision) && precision > PRECISION_MAX) return error(422, "Tu ubicación no es precisa todavía. Sal a un lugar abierto y vuelve a tocar “Ya llegué”.");
      const m = Math.round(metros({lat, lng}, d));
      if(m > RADIO_LLEGADA) return error(422, `Te vemos a ${m >= 1000 ? (m / 1000).toFixed(1) + " km" : m + " m"} del desarrollo. Toca “Ya llegué” cuando estés en la oficina de ventas.`);
      Object.assign(cambios, {llegada_en:new Date().toISOString(), llegada_distancia_m:m, ...(s.confirmada_en ? {} : {confirmada_en:new Date().toISOString()})});
      if(["nueva", "contactada", "visita_agendada"].includes(s.estado)) cambios.estado = "visita_hecha";
    }else return error(400, "Acción desconocida.");
    if(Object.keys(cambios).length){
      await sb(`solicitudes?folio=eq.${s.folio}`, {method:"PATCH", body:cambios, headers:{Prefer:"return=minimal"}});
      Object.assign(s, cambios);
      await avisar(b.accion === "llegue" ? `Llegó a la visita ${s.folio}: ${d.nombre}` : `Cita confirmada ${s.folio}: ${d.nombre}`,
        b.accion === "llegue" ? `${s.nombre} llegó (a ${cambios.llegada_distancia_m} m), ${new Date(cambios.llegada_en).toLocaleString("es-MX", {timeZone:"America/Monterrey"})}.` : `${s.nombre} confirmó su visita desde su WhatsApp.`);
    }
    return respuesta(200, publica(s));
  }catch(e){ console.error("[cita]", e.message); return error(502, "No pudimos guardar. Intenta en un momento."); }
}
