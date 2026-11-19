/* Todo por WhatsApp: verificación al cliente, la cita a la desarrolladora y tus avisos.

   Con la API oficial (Meta WhatsApp Cloud API) los mensajes salen solos. Variables de entorno:
     WHATSAPP_TOKEN, WHATSAPP_PHONE_ID   Meta → WhatsApp → API Setup (token permanente de usuario del sistema)
     ARVENTA_WHATSAPP                    tu número (10 dígitos), para tus avisos
   Plantillas (Meta → WhatsApp Manager → Plantillas; categoría "Utilidad", idioma es_MX):
     arventa_verificar  "Hola {{1}}, recibimos tu solicitud para visitar {{2}}. Para confirmarla toca aquí: {{3}}"
     arventa_cita       "Nueva cita de ARVENTA {{1}} para {{2}}. {{3}}"
     arventa_aviso      "Aviso de ARVENTA: {{1}}"
   Mientras la API no esté lista, tus avisos llegan por CallMeBot (CALLMEBOT_TELEFONO, CALLMEBOT_APIKEY)
   con los mensajes listos para mandar con un toque (enlaces wa.me). */
import {env} from "./comun.js";

const VERSION = "v21.0";
export const apiLista = () => !!(env("WHATSAPP_TOKEN") && env("WHATSAPP_PHONE_ID"));
// Meta no acepta saltos de línea, tabuladores ni más de 4 espacios seguidos en los parámetros
export const parametro = s => String(s ?? "").replace(/[\r\n\t]+/g, " · ").replace(/ {4,}/g, "   ").trim().slice(0, 900) || "—";
export const enlaceWa = (tel10, texto) => `https://wa.me/52${tel10}?text=${encodeURIComponent(texto)}`;

async function conTiempo(url, opciones, ms = 6000){
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try{ return await fetch(url, {...opciones, signal:ctl.signal}); } finally{ clearTimeout(t); }
}

// Manda una plantilla aprobada. Devuelve true si Meta la aceptó.
export async function plantilla(tel10, nombre, parametros){
  if(!apiLista() || !/^\d{10}$/.test(tel10 || "")) return false;
  try{
    const r = await conTiempo(`https://graph.facebook.com/${VERSION}/${env("WHATSAPP_PHONE_ID")}/messages`, {method:"POST",
      headers:{Authorization:`Bearer ${env("WHATSAPP_TOKEN")}`, "Content-Type":"application/json"},
      body:JSON.stringify({messaging_product:"whatsapp", to:"52" + tel10, type:"template",
        template:{name:nombre, language:{code:"es_MX"}, components:[{type:"body", parameters:parametros.map(p => ({type:"text", text:parametro(p)}))}]}})});
    if(!r.ok) console.error(`[whatsapp] ${nombre} → ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return r.ok;
  }catch(e){ console.error(`[whatsapp] ${nombre}:`, e.message); return false; }
}

// Aviso para ti (ARVENTA). Nunca lanza error; devuelve true si salió por algún lado.
export async function avisar(asunto, cuerpo = ""){
  if(await plantilla(env("ARVENTA_WHATSAPP"), "arventa_aviso", [`${asunto}. ${cuerpo}`])) return true;
  if(env("CALLMEBOT_TELEFONO") && env("CALLMEBOT_APIKEY")){
    try{
      const r = await conTiempo(`https://api.callmebot.com/whatsapp.php?${new URLSearchParams({phone:env("CALLMEBOT_TELEFONO"), apikey:env("CALLMEBOT_APIKEY"), text:`${asunto}\n${cuerpo}`})}`);
      if(r.ok) return true;
    }catch(e){}
  }
  console.error("[aviso] No se pudo avisar a ARVENTA por WhatsApp:", asunto);
  return false;
}
