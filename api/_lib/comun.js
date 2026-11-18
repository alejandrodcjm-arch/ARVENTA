/* Utilidades de las funciones de /api (Vercel). Sin librerías: Supabase se usa por su API REST.
   Variables de entorno (ver .env.example):
     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   base de datos (la llave solo vive en el servidor)
     IP_SALT                                   para guardar la IP como huella, nunca en claro
     REPORTE_CLAVE                             clave del reporte para desarrolladoras
     RESEND_API_KEY, AVISO_CORREO_PARA, AVISO_CORREO_DE        aviso por correo (opcional)
     CALLMEBOT_TELEFONO, CALLMEBOT_APIKEY                      aviso por WhatsApp (opcional) */
import {readFileSync} from "node:fs";
import {createHash, timingSafeEqual} from "node:crypto";

export const env = k => process.env[k] || "";

let cacheDesarrollos = null;
export function desarrollos(){
  if(!cacheDesarrollos) cacheDesarrollos = JSON.parse(readFileSync(new URL("../../data/desarrollos.json", import.meta.url), "utf8"));
  return cacheDesarrollos;
}

export function respuesta(status, cuerpo, extra = {}){
  return new Response(JSON.stringify(cuerpo), {status, headers:{"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store", ...extra}});
}
export const error = (status, mensaje, extra) => respuesta(status, {ok:false, mensaje}, extra);

// Lee JSON del cuerpo con tamaño máximo (sendBeacon manda text/plain o application/json)
export async function leerJSON(request, max = 8000){
  const t = await request.text();
  if(t.length > max) throw Object.assign(new Error("muy grande"), {status:413});
  try{ return JSON.parse(t || "{}"); }catch(e){ throw Object.assign(new Error("JSON inválido"), {status:400}); }
}

export function huellaIP(request){
  const ip = (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "").split(",")[0].trim() || "desconocida";
  return createHash("sha256").update(env("IP_SALT") + "|" + ip).digest("hex").slice(0, 32);
}

// Texto seguro: sin caracteres de control y con largo máximo
export const texto = (v, max = 120) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
export function claveValida(dada){
  const esperada = env("REPORTE_CLAVE");
  if(!esperada || !dada) return false;
  const a = Buffer.from(String(dada)), b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function conTiempo(url, opciones = {}, ms = 6000){
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try{ return await fetch(url, {...opciones, signal:ctl.signal}); } finally{ clearTimeout(t); }
}

/* Supabase REST (PostgREST). Lanza error si no está configurado o falla. */
export const supabaseListo = () => !!(env("SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY"));
export async function sb(ruta, {method = "GET", body, headers = {}} = {}){
  if(!supabaseListo()) throw Object.assign(new Error("Supabase no está configurado"), {status:503});
  const r = await conTiempo(`${env("SUPABASE_URL").replace(/\/$/, "")}/rest/v1/${ruta}`, {
    method, body:body ? JSON.stringify(body) : undefined,
    headers:{apikey:env("SUPABASE_SERVICE_ROLE_KEY"), Authorization:`Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type":"application/json", ...headers}
  });
  const t = await r.text();
  if(!r.ok) throw Object.assign(new Error(`Supabase ${r.status}: ${t.slice(0, 200)}`), {status:r.status, codigo:(() => { try{ return JSON.parse(t).code; }catch(e){ return ""; } })()});
  return t ? JSON.parse(t) : null;
}
// Lee todas las filas (de 1000 en 1000)
export async function sbTodo(ruta){
  const filas = [];
  for(let i = 0; ; i += 1000){
    const lote = await sb(ruta, {headers:{"Range-Unit":"items", Range:`${i}-${i + 999}`}});
    filas.push(...lote);
    if(lote.length < 1000) return filas;
  }
}

/* Aviso inmediato a ARVENTA. Devuelve true si al menos un canal funcionó. Nunca lanza error. */
export async function avisar(asunto, cuerpo){
  const intentos = [];
  if(env("RESEND_API_KEY") && env("AVISO_CORREO_PARA")) intentos.push(conTiempo("https://api.resend.com/emails", {method:"POST",
    headers:{Authorization:`Bearer ${env("RESEND_API_KEY")}`, "Content-Type":"application/json"},
    body:JSON.stringify({from:env("AVISO_CORREO_DE") || "ARVENTA <onboarding@resend.dev>", to:env("AVISO_CORREO_PARA").split(","), subject:asunto, text:cuerpo})}).then(r => r.ok));
  if(env("CALLMEBOT_TELEFONO") && env("CALLMEBOT_APIKEY")) intentos.push(conTiempo(`https://api.callmebot.com/whatsapp.php?${new URLSearchParams({
    phone:env("CALLMEBOT_TELEFONO"), apikey:env("CALLMEBOT_APIKEY"), text:`${asunto}\n${cuerpo}`})}`).then(r => r.ok));
  const res = await Promise.allSettled(intentos);
  const ok = res.some(r => r.status === "fulfilled" && r.value);
  if(!ok) console.error("[aviso] No se pudo avisar a ARVENTA:", asunto, res.map(r => r.reason?.message || r.value));
  return ok;
}

export function nuevoFolio(prefijo){
  const letras = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return prefijo + "-" + Array.from(crypto.getRandomValues(new Uint8Array(6)), x => letras[x % letras.length]).join("");
}
