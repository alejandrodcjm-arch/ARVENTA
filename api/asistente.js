/* POST /api/asistente: el asistente de ARVENTA. La persona platica y la IA busca, calcula y mueve la pantalla.
   Cuerpo: {mensajes:[{rol:"persona"|"asistente", texto}], contexto:{ref:{lat,lng,nombre,tipo}|null}}
   Respuesta: {ok, texto, acciones:[...], modo:"ia"|"demo"}
   Sin ANTHROPIC_API_KEY funciona en modo demostración (reglas sencillas), para pruebas y desarrollo.
   No se guarda la plática: solo se cuenta que hubo una (evento anónimo, desde el navegador). */
import {respuesta, error, leerJSON, huellaIP, texto, env} from "./_lib/comun.js";
import {HERRAMIENTAS, ejecutar, instrucciones, demo} from "./_lib/asistente.js";

const MAX_MENSAJES = 14, MAX_TEXTO = 700, MAX_VUELTAS = 6;
const LIMITE = 25, VENTANA = 10 * 60e3;   // 25 mensajes cada 10 minutos por conexión
const usos = new Map();
function permitido(h){
  const ahora = Date.now(), l = (usos.get(h) || []).filter(t => ahora - t < VENTANA);
  if(l.length >= LIMITE) return false;
  l.push(ahora); usos.set(h, l);
  if(usos.size > 5000) for(const [k, v] of usos) if(!v.some(t => ahora - t < VENTANA)) usos.delete(k);
  return true;
}

function limpiarRef(r){
  const lat = Number(r?.lat), lng = Number(r?.lng);
  if(!isFinite(lat) || !isFinite(lng) || lat < 23.8 || lat > 24.25 || lng < -104.9 || lng > -104.4) return null;
  return {lat, lng, nombre:texto(r.nombre, 60) || "tu referencia", tipo:["trabajo", "ubicacion", "escuela", "hospital", "centro", "otro"].includes(r.tipo) ? r.tipo : "otro"};
}

async function claude(cuerpo){
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 25000);
  try{
    const r = await fetch("https://api.anthropic.com/v1/messages", {method:"POST", signal:ctl.signal,
      headers:{"x-api-key":env("ANTHROPIC_API_KEY"), "anthropic-version":"2023-06-01", "content-type":"application/json"},
      body:JSON.stringify(cuerpo)});
    const j = await r.json();
    if(!r.ok) throw new Error(`IA ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
    return j;
  }finally{ clearTimeout(t); }
}

export async function conversar(mensajes, ctx){
  const msgs = mensajes.map(m => ({role:m.rol === "asistente" ? "assistant" : "user", content:m.texto}));
  const sistema = instrucciones() + (ctx.ref ? `\nLa persona ya marcó como referencia: ${ctx.ref.nombre} (${ctx.ref.tipo}). Úsala para ordenar por cercanía.` : "");
  let final = "";
  for(let i = 0; i < MAX_VUELTAS; i++){
    const r = await claude({model:env("ANTHROPIC_MODEL") || "claude-haiku-5-5", max_tokens:900, system:sistema, tools:HERRAMIENTAS, messages:msgs});
    const textos = r.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
    if(textos) final = textos;
    const usos = r.content.filter(b => b.type === "tool_use");
    if(r.stop_reason !== "tool_use" || !usos.length) break;
    msgs.push({role:"assistant", content:r.content});
    const resultados = [];
    for(const u of usos){
      let salida;
      try{ salida = await ejecutar(u.name, u.input, ctx); }catch(e){ salida = {error:"No se pudo: " + e.message}; }
      resultados.push({type:"tool_result", tool_use_id:u.id, content:JSON.stringify(salida)});
    }
    msgs.push({role:"user", content:resultados});
  }
  return final || "Listo, te dejé las opciones en pantalla.";
}

export async function POST(request){
  let b;
  try{ b = await leerJSON(request, 14000); }catch(e){ return error(e.status || 400, "Formato inválido."); }
  if(!permitido(huellaIP(request))) return error(429, "Vas muy rápido. Espera unos minutos y vuelve a preguntarme.");
  const mensajes = (Array.isArray(b.mensajes) ? b.mensajes : []).slice(-MAX_MENSAJES)
    .map(m => ({rol:m?.rol === "asistente" ? "asistente" : "persona", texto:texto(String(m?.texto ?? "").replace(/\s+/g, " "), MAX_TEXTO)}))
    .filter(m => m.texto);
  while(mensajes.length && mensajes[0].rol !== "persona") mensajes.shift();
  if(!mensajes.length || mensajes.at(-1).rol !== "persona") return error(400, "Escríbeme qué buscas.");
  const ctx = {ref:limpiarRef(b.contexto?.ref), acciones:[]};
  try{
    if(!env("ANTHROPIC_API_KEY")){
      const t = await demo(mensajes.at(-1).texto, ctx);
      return respuesta(200, {ok:true, texto:t, acciones:ctx.acciones, modo:"demo"});
    }
    const t = await conversar(mensajes, ctx);
    return respuesta(200, {ok:true, texto:t, acciones:ctx.acciones, modo:"ia"});
  }catch(e){
    console.error("[asistente]", e.message);
    // Si la IA falla, el modo demostración responde para que la persona no se quede sin nada
    try{
      ctx.acciones.length = 0;
      const t = await demo(mensajes.at(-1).texto, ctx);
      return respuesta(200, {ok:true, texto:t.replace(/ \(Modo demostración.*\)$/, " (La IA no respondió; usé la búsqueda sencilla.)"), acciones:ctx.acciones, modo:"demo"});
    }catch(x){ return error(502, "No pude responder ahorita. Usa el buscador de arriba o intenta en un momento."); }
  }
}
