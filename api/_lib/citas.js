/* El camino de una cita, todo por WhatsApp:
   nueva → (WhatsApp de verificación al cliente) → verificada → (WhatsApp con la cita a la desarrolladora) → enviada
   → visita_hecha ("Ya llegué" a menos de 300 m) · invalida (la marca ARVENTA, con motivo) */
import {desarrollos, sb, SITIO} from "./comun.js";
import {plantilla, enlaceWa, apiLista} from "./whatsapp.js";

const dinero = n => "$" + Math.round(n).toLocaleString("es-MX");
export const primerNombre = s => String(s.nombre).split(" ")[0];
export const enlaceCita = s => `${SITIO()}/cita/?c=${s.folio}&t=${s.token}`;

export function textoVerificacion(s, des){
  return `Hola ${primerNombre(s)}, recibimos tu solicitud para visitar ${des.nombre}. Para confirmarla toca aquí: ${enlaceCita(s)}`;
}
// La ficha de la cita para el asesor: solo lo que el cliente aceptó compartir en la casilla
export function detalleCita(s){
  const nombres = (s.otros || []).map(id => desarrollos().find(d => d.id === id)?.nombre).filter(Boolean);
  return [
    `${s.nombre}, WhatsApp ${s.telefono} (wa.me/52${s.telefono})`,
    `Cuándo: ${s.cita_fecha ? new Date(s.cita_fecha).toLocaleString("es-MX", {timeZone:"America/Monterrey", weekday:"long", day:"numeric", month:"long", hour:"numeric", minute:"2-digit"}) : s.cuando}`,
    `Pagaría con: ${s.pago}`,
    s.presupuesto ? `Presupuesto: hasta ${dinero(s.presupuesto)}` : "",
    s.mensualidad ? `Mensualidad que calculó: ${dinero(s.mensualidad)}` : "",
    s.trabajo_texto || s.minutos ? `Trabaja en: ${s.trabajo_texto || "zona marcada en el mapa"}${s.minutos ? ` (${s.minutos} min en auto)` : ""}` : "",
    nombres.length ? `También vio: ${nombres.join(", ")}` : "",
    `Cita verificada por el cliente${s.verificada_en ? ` el ${new Date(s.verificada_en).toLocaleString("es-MX", {timeZone:"America/Monterrey", day:"numeric", month:"short", hour:"numeric", minute:"2-digit"})}` : ""}. Código: ${s.folio}`
  ].filter(Boolean).join(". ");
}

export async function desarrolladoraDe(id){
  const [d] = await sb(`desarrolladoras?select=nombre,whatsapp&desarrollos=cs.{${id}}&activa=is.true&limit=1`);
  return d || null;
}

// WhatsApp de verificación al cliente. Si no sale solo, regresa el enlace para mandarlo con un toque.
export async function mandarVerificacion(s){
  const des = desarrollos().find(d => d.id === s.desarrollo);
  const ok = await plantilla(s.telefono, "arventa_verificar", [primerNombre(s), des.nombre, enlaceCita(s)]);
  if(ok) await sb(`solicitudes?folio=eq.${s.folio}`, {method:"PATCH", body:{verificacion_enviada_en:new Date().toISOString()}, headers:{Prefer:"return=minimal"}});
  return {ok, manual:ok ? null : enlaceWa(s.telefono, textoVerificacion(s, des))};
}

// La cita a la desarrolladora (solo verificadas). Si sale, queda "enviada" con fecha y hora: con eso se cobra.
export async function mandarADesarrolladora(s){
  const des = desarrollos().find(d => d.id === s.desarrollo);
  const dev = await desarrolladoraDe(s.desarrollo);
  const texto = `Nueva cita de ARVENTA ${s.folio} para ${des.nombre}. ${detalleCita(s)}`;
  if(!dev) return {ok:false, motivo:"Este desarrollo no tiene WhatsApp de desarrolladora registrado.", manual:null, texto};
  const ok = await plantilla(dev.whatsapp, "arventa_cita", [s.folio, des.nombre, detalleCita(s)]);
  if(ok) await marcarEnviada(s, dev.whatsapp);
  return {ok, manual:ok ? null : enlaceWa(dev.whatsapp, texto), a:dev.whatsapp, desarrolladora:dev.nombre, texto};
}
export async function marcarEnviada(s, a){
  const cambios = {enviada_en:new Date().toISOString(), enviada_a:a || null};
  if(["nueva", "verificada"].includes(s.estado)) cambios.estado = "enviada";
  await sb(`solicitudes?folio=eq.${s.folio}`, {method:"PATCH", body:cambios, headers:{Prefer:"return=minimal"}});
  Object.assign(s, cambios);
}
export {apiLista};
