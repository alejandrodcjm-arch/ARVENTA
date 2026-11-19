/* POST /api/reclamo (encabezado x-clave: clave de la desarrolladora)
   El asesor NO marca asistencias. Solo puede reclamar una cita como inválida con un motivo:
     telefono_falso · duplicada · cliente_previo (con prueba de los 60 días antes de la solicitud).
   El reclamo queda "pendiente": ARVENTA revisa y decide en Supabase. */
import {respuesta, error, leerJSON, texto, sb, avisar, huella} from "./_lib/comun.js";

const MOTIVOS = {telefono_falso:"Teléfono falso", duplicada:"Cita duplicada", cliente_previo:"Ya era cliente de la desarrolladora"};

export async function POST(request){
  let b;
  try{ b = await leerJSON(request, 3000); }catch(e){ return error(400, "Formato inválido."); }
  const clave = request.headers.get("x-clave") || "";
  if(clave.length < 12) return error(401, "La clave no es correcta.");
  if(!MOTIVOS[b.motivo]) return error(400, "Elige un motivo.");
  const detalle = texto(b.detalle, 1000);
  if(detalle.length < 10) return error(400, "Explica el motivo con un poco más de detalle.");
  try{
    const [des] = await sb(`desarrolladoras?select=id,nombre,desarrollos&clave_hash=eq.${huella(clave)}&activa=is.true&limit=1`);
    if(!des) return error(401, "La clave no es correcta.");
    if(!/^V-[A-Z2-9]{6}$/.test(b.folio || "")) return error(400, "Escribe el código de cita (V-XXXXXX).");
    const [s] = await sb(`solicitudes?select=folio,desarrollo,creado&folio=eq.${b.folio}&limit=1`);
    if(!s || !des.desarrollos.includes(s.desarrollo)) return error(404, "Ese código de cita no es de tus desarrollos.");
    let prueba_fecha = null;
    if(b.motivo === "cliente_previo"){
      const p = new Date(String(b.pruebaFecha) + "T12:00:00"), creada = new Date(s.creado);
      if(isNaN(p)) return error(400, "Indica la fecha de la prueba (último contacto con el cliente).");
      const dias = (creada - p) / 864e5;
      if(dias < 0 || dias > 60) return error(400, "La prueba debe ser de los 60 días anteriores a la solicitud de ARVENTA.");
      prueba_fecha = String(b.pruebaFecha);
    }
    const repetido = await sb(`reclamos?select=id&folio=eq.${s.folio}&estado=eq.pendiente&limit=1`);
    if(repetido.length) return error(409, "Esa cita ya tiene un reclamo en revisión.");
    await sb("reclamos", {method:"POST", headers:{Prefer:"return=minimal"}, body:{folio:s.folio, desarrolladora:des.id, motivo:b.motivo, detalle, prueba_fecha}});
    await avisar(`Reclamo de ${des.nombre} sobre ${s.folio}`, `${MOTIVOS[b.motivo]}${prueba_fecha ? ` (prueba del ${prueba_fecha})` : ""}\n${detalle}\n\nRevísalo en Supabase → reclamos.`);
    return respuesta(200, {ok:true, mensaje:"Recibimos tu reclamo. ARVENTA lo revisa y te responde."});
  }catch(e){
    console.error("[reclamo]", e.message);
    return error(502, "No pudimos guardar el reclamo.");
  }
}
