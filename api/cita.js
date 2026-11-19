/* /api/cita: lo que hace el CLIENTE con su enlace (/cita/?c=FOLIO&t=TOKEN), que le llega por WhatsApp.
   GET  ?c&t                         → estado de su cita
   POST {c, t, accion:"confirmar"}   → verificada; en seguida sale por WhatsApp a la desarrolladora (enviada)
   POST {c, t, accion:"llegue", lat, lng, precision}
        → visita hecha si está a menos de 300 m. Solo se guarda la distancia, nunca su ubicación.
   Nada de esto lo decide el asesor. */
import {desarrollos, respuesta, error, leerJSON, sb, mismoTexto, metros} from "./_lib/comun.js";
import {avisar} from "./_lib/whatsapp.js";
import {mandarADesarrolladora} from "./_lib/citas.js";

export const RADIO_LLEGADA = 300;      // metros
export const PRECISION_MAX = 150;      // metros: con más error, se pide volver a intentar
const CAMPOS = "folio,token,nombre,telefono,desarrollo,cuando,pago,presupuesto,mensualidad,otros,trabajo_texto,minutos,cita_fecha,verificada_en,enviada_en,llegada_en,llegada_distancia_m,estado";

async function buscar(c, t){
  if(!/^V-[A-Z2-9]{6}$/.test(c || "")) return null;
  const [s] = await sb(`solicitudes?select=${CAMPOS}&folio=eq.${c}&limit=1`);
  return s && mismoTexto(s.token, t) ? s : null;
}
function publica(s){
  const d = desarrollos().find(x => x.id === s.desarrollo) || {};
  return {ok:true, folio:s.folio, nombre:s.nombre.split(" ")[0], cita_fecha:s.cita_fecha, confirmada:!!s.verificada_en, confirmada_en:s.verificada_en,
    llegada_en:s.llegada_en, llegada_distancia_m:s.llegada_distancia_m, invalida:s.estado === "invalida",
    desarrollo:{id:d.id, nombre:d.nombre, zona:d.zona, verificable:d.lat != null && d.aprox === false, tieneCorrida:!!d.esquemas?.length},
    beneficio:s.llegada_en ? (d.beneficioArventa || null) : null};
}
const guardar = (s, cambios) => sb(`solicitudes?folio=eq.${s.folio}`, {method:"PATCH", body:cambios, headers:{Prefer:"return=minimal"}}).then(() => Object.assign(s, cambios));

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
    if(s.estado === "invalida") return error(409, "Esta cita ya no está activa. Escríbenos por WhatsApp si quieres agendar de nuevo.");
    const d = desarrollos().find(x => x.id === s.desarrollo);
    if(b.accion === "confirmar"){
      if(s.verificada_en) return respuesta(200, publica(s));
      await guardar(s, {verificada_en:new Date().toISOString(), ...(s.estado === "nueva" ? {estado:"verificada"} : {})});
      // Verificada: se le manda a quien comercializa el desarrollo
      const e = await mandarADesarrolladora(s);
      await avisar(`Cita verificada ${s.folio}: ${d.nombre}`, e.ok ? `${s.nombre} confirmó. Ya se le mandó a ${e.desarrolladora}.`
        : `${s.nombre} confirmó. ${e.manual ? `Mándasela a la desarrolladora: ${e.manual}` : `${e.motivo} Envíala desde tu panel.`}`);
    }else if(b.accion === "llegue"){
      if(s.llegada_en) return respuesta(200, publica(s));
      if(d.lat == null || d.aprox !== false) return error(409, "Todavía no tenemos la ubicación exacta de este desarrollo, así que no podemos registrar tu llegada. Muestra tu código al asesor.");
      const lat = Number(b.lat), lng = Number(b.lng), precision = Number(b.precision);
      if(!isFinite(lat) || !isFinite(lng)) return error(400, "No llegó tu ubicación.");
      if(isFinite(precision) && precision > PRECISION_MAX) return error(422, "Tu ubicación no es precisa todavía. Sal a un lugar abierto y vuelve a tocar “Ya llegué”.");
      const m = Math.round(metros({lat, lng}, d));
      if(m > RADIO_LLEGADA) return error(422, `Te vemos a ${m >= 1000 ? (m / 1000).toFixed(1) + " km" : m + " m"} del desarrollo. Toca “Ya llegué” cuando estés en la oficina de ventas.`);
      const ahora = new Date().toISOString();
      await guardar(s, {llegada_en:ahora, llegada_distancia_m:m, estado:"visita_hecha", ...(s.verificada_en ? {} : {verificada_en:ahora})});
      await avisar(`Llegó a la visita ${s.folio}: ${d.nombre}`, `${s.nombre} llegó (a ${m} m), ${new Date(ahora).toLocaleString("es-MX", {timeZone:"America/Monterrey"})}.`);
    }else return error(400, "Acción desconocida.");
    return respuesta(200, publica(s));
  }catch(e){ console.error("[cita]", e.message); return error(502, "No pudimos guardar. Intenta en un momento."); }
}
