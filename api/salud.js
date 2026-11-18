/* GET /api/salud: lo revisa el monitoreo (UptimeRobot / Better Stack) cada 5 minutos.
   Responde 503 si la base de datos no contesta o si hay solicitudes de hace más de 10 minutos
   cuyo aviso a ARVENTA no salió: así el monitoreo te avisa antes de perder un cliente. */
import {respuesta, sb, supabaseListo} from "./_lib/comun.js";

export async function GET(){
  if(!supabaseListo()) return respuesta(503, {ok:false, problema:"Supabase no está configurado"});
  try{
    const hace10 = new Date(Date.now() - 600e3).toISOString(), hace2d = new Date(Date.now() - 2 * 864e5).toISOString();
    const sinAviso = await sb(`solicitudes?select=folio&aviso_enviado=is.false&creado=lt.${encodeURIComponent(hace10)}&creado=gt.${encodeURIComponent(hace2d)}`);
    if(sinAviso.length) return respuesta(503, {ok:false, problema:`${sinAviso.length} solicitudes sin aviso`});
    return respuesta(200, {ok:true});
  }catch(e){
    return respuesta(503, {ok:false, problema:"La base de datos no responde"});
  }
}
