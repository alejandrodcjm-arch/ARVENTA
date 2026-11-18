/* POST /api/visita: guarda una solicitud de visita ANTES de que el navegador abra WhatsApp.
   docs/REQUISITOS.md §3: validación en el servidor, honeypot, 5 por hora por IP, aviso inmediato. */
import {desarrollos, respuesta, error, leerJSON, huellaIP, texto, sb, avisar, nuevoFolio} from "./_lib/comun.js";

export const LIMITE_POR_HORA = 5;
const CUANDO = ["Este fin de semana", "Entre semana por la tarde", "Entre semana por la mañana", "Primero quiero más información"];
const PAGO = ["Infonavit", "Fovissste", "Crédito bancario", "Cofinavit (Infonavit + banco)", "Contado", "Aún no sé"];
const CAJA = {s:23.85, w:-104.85, n:24.20, e:-104.45};

export function revisar(d){
  const des = desarrollos().find(x => x.id === d.id);
  const tel = String(d.whatsapp || "").replace(/\D/g, "").replace(/^52(?=\d{10}$)/, "").replace(/^521(?=\d{10}$)/, "");
  if(!des) return {error:"Ese desarrollo no existe."};
  if(texto(d.nombre, 80).length < 2) return {error:"Escribe tu nombre."};
  if(!/^\d{10}$/.test(tel)) return {error:"Escribe tu WhatsApp a 10 dígitos."};
  if(d.consentimiento !== true) return {error:"Para agendar necesitamos que aceptes compartir tus datos con la desarrolladora."};
  const t = d.trabajo || {}, lat = Number(t.lat), lng = Number(t.lng);
  const zonaValida = isFinite(lat) && isFinite(lng) && lat > CAJA.s && lat < CAJA.n && lng > CAJA.w && lng < CAJA.e;
  const min = Number(d.minutos);
  return {fila:{
    folio:/^V-[A-Z2-9]{6}$/.test(d.folio || "") ? d.folio : nuevoFolio("V"),
    desarrollo:des.id, nombre:texto(d.nombre, 80), telefono:tel,
    cuando:CUANDO.includes(d.cuando) ? d.cuando : "Primero quiero más información",
    pago:PAGO.includes(d.pago) ? d.pago : "Aún no sé",
    // la zona de trabajo llega ya redondeada a ~1 km; aquí se vuelve a redondear por si acaso
    trabajo_texto:texto(t.texto, 80) || null,
    trabajo_lat:zonaValida ? Math.round(lat * 100) / 100 : null, trabajo_lng:zonaValida ? Math.round(lng * 100) / 100 : null,
    minutos:isFinite(min) && min > 0 && min < 300 ? Math.round(min) : null,
    consentimiento:true, version_aviso:texto(d.versionAviso, 40) || null
  }, des};
}

export async function POST(request){
  let d;
  try{ d = await leerJSON(request, 4000); }catch(e){ return error(e.status || 400, "Formato inválido."); }
  if(d.sitio) return respuesta(200, {ok:true, folio:nuevoFolio("V")}); // campo trampa: un robot lo llenó
  const r = revisar(d);
  if(r.error) return error(400, r.error);
  const ip_hash = huellaIP(request);
  try{
    // Límite: 5 solicitudes por hora por IP
    const hace1h = new Date(Date.now() - 3600e3).toISOString();
    const recientes = await sb(`solicitudes?select=id&ip_hash=eq.${ip_hash}&creado=gte.${encodeURIComponent(hace1h)}`);
    if(recientes.length >= LIMITE_POR_HORA) return error(429, "Recibimos varias solicitudes desde esta conexión. Escríbenos directo por WhatsApp.");
    try{
      await sb("solicitudes", {method:"POST", body:{...r.fila, ip_hash}, headers:{Prefer:"return=minimal"}});
    }catch(e){
      // Mismo folio = reintento de una solicitud ya guardada (cola del navegador): no es error
      if(e.codigo === "23505") return respuesta(200, {ok:true, folio:r.fila.folio, repetida:true});
      throw e;
    }
  }catch(e){
    console.error("[visita] No se pudo guardar:", e.message);
    return error(e.status === 503 ? 503 : 502, "No pudimos guardar tu solicitud; te la mandamos por WhatsApp.");
  }
  // Ya está guardada: el aviso no puede hacer que se pierda
  const f = r.fila, ok = await avisar(`Nueva solicitud ${f.folio}: ${r.des.nombre}`,
    `${f.nombre} · WhatsApp ${f.telefono} (https://wa.me/52${f.telefono})\nCuándo: ${f.cuando}\nPago: ${f.pago}` +
    `${f.trabajo_texto ? `\nTrabaja en: ${f.trabajo_texto}` : ""}${f.minutos ? ` (${f.minutos} min en auto)` : ""}`);
  if(ok) await sb(`solicitudes?folio=eq.${f.folio}`, {method:"PATCH", body:{aviso_enviado:true}, headers:{Prefer:"return=minimal"}}).catch(() => {});
  return respuesta(200, {ok:true, folio:f.folio});
}
