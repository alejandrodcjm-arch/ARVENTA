/* POST /api/contacto: formulario de anuncia.html (desarrolladoras). */
import {respuesta, error, leerJSON, texto, sb, avisar, nuevoFolio, huellaIP} from "./_lib/comun.js";

export async function POST(request){
  let d;
  try{ d = await leerJSON(request, 6000); }catch(e){ return error(400, "Formato inválido."); }
  if(d.sitio) return respuesta(200, {ok:true, folio:nuevoFolio("D")});
  const tel = String(d.whatsapp || "").replace(/\D/g, "");
  const correo = texto(d.correo, 120);
  if(texto(d.nombre).length < 2 || texto(d.desarrollo).length < 2) return error(400, "Escribe tu nombre y el nombre del desarrollo.");
  if(tel.length < 10 && !/^\S+@\S+\.\S+$/.test(correo)) return error(400, "Déjanos un WhatsApp de 10 dígitos o un correo.");
  const fila = {folio:/^D-[A-Z2-9]{6}$/.test(d.folio || "") ? d.folio : nuevoFolio("D"), nombre:texto(d.nombre, 80), empresa:texto(d.empresa, 80) || null,
    desarrollo:texto(d.desarrollo, 80), ubicacion:texto(d.ubicacion, 120) || null, tipo:texto(d.tipoVivienda, 40) || null,
    unidades:texto(d.unidades, 20) || null, precio:texto(d.precio, 30) || null, telefono:tel || null, correo:correo || null,
    mensaje:texto(d.mensaje, 1000) || null, ip_hash:huellaIP(request)};
  try{
    const hace1h = new Date(Date.now() - 3600e3).toISOString();
    if((await sb(`contactos?select=id&ip_hash=eq.${fila.ip_hash}&creado=gte.${encodeURIComponent(hace1h)}`)).length >= 5) return error(429, "Recibimos varios mensajes desde esta conexión. Escríbenos por WhatsApp.");
    await sb("contactos", {method:"POST", body:fila, headers:{Prefer:"return=minimal"}});
  }catch(e){
    if(e.codigo === "23505") return respuesta(200, {ok:true, folio:fila.folio});
    console.error("[contacto]", e.message);
    return error(502, "No pudimos guardar tus datos.");
  }
  await avisar(`Desarrolladora interesada ${fila.folio}: ${fila.desarrollo}`, `${fila.nombre}${fila.empresa ? ` (${fila.empresa})` : ""}\nWhatsApp: ${fila.telefono || "—"} · Correo: ${fila.correo || "—"}\n${fila.mensaje || ""}`);
  return respuesta(200, {ok:true, folio:fila.folio});
}
