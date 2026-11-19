/* /api/panel: tu panel (solo ARVENTA). Encabezado x-clave = REPORTE_CLAVE.
   GET  ?dias=30|90|365&estado=…        → solicitudes con su camino, desarrolladoras y resumen del mes
   POST {accion, folio, …}
     verificar      manda (o vuelve a mandar) al cliente su WhatsApp de verificación
     enviar         manda la cita verificada por WhatsApp a la desarrolladora
     marcar_enviada la mandaste tú desde tu WhatsApp (queda la fecha y hora)
     visita_hecha   el asesor te confirmó que llegó
     invalida       {motivo, detalle, pruebaFecha}: teléfono falso, duplicada, cliente previo (prueba de 60 días) u otro
     reactivar      quita la marca de inválida
     cita_fecha     {fecha}: día y hora acordados */
import {respuesta, error, leerJSON, texto, sb, sbTodo, claveValida, desarrollos} from "./_lib/comun.js";
import {mandarVerificacion, mandarADesarrolladora, marcarEnviada, desarrolladoraDe, textoVerificacion, enlaceCita} from "./_lib/citas.js";
import {apiLista, enlaceWa} from "./_lib/whatsapp.js";

const MOTIVOS = ["telefono_falso", "duplicada", "cliente_previo", "otro"];
const CAMPOS = "folio,token,creado,desarrollo,nombre,telefono,cuando,pago,presupuesto,mensualidad,otros,trabajo_texto,minutos,duplicada_de,estado," +
  "verificacion_enviada_en,verificada_en,enviada_en,enviada_a,cita_fecha,llegada_en,llegada_distancia_m,motivo_invalida,detalle_invalida,prueba_fecha";
const autorizado = request => claveValida(request.headers.get("x-clave"));

function paraPanel(s, devs){
  const des = desarrollos().find(d => d.id === s.desarrollo) || {nombre:s.desarrollo};
  const dev = devs.find(x => x.desarrollos.includes(s.desarrollo));
  const {token, ...resto} = s;
  return {...resto, desarrolloNombre:des.nombre, desarrolladora:dev ? {nombre:dev.nombre, whatsapp:dev.whatsapp} : null,
    enlaceCliente:enlaceCita(s), waVerificacion:enlaceWa(s.telefono, textoVerificacion(s, des)), cobrable:!!(s.verificada_en && s.enviada_en && s.estado !== "invalida" && !s.duplicada_de)};
}

export async function GET(request){
  if(!autorizado(request)) return error(401, "La clave no es correcta.");
  const u = new URL(request.url);
  const dias = [7, 30, 90, 365].includes(Number(u.searchParams.get("dias"))) ? Number(u.searchParams.get("dias")) : 30;
  const desde = encodeURIComponent(new Date(Date.now() - dias * 864e5).toISOString());
  const estado = ["nueva", "verificada", "enviada", "visita_hecha", "invalida"].includes(u.searchParams.get("estado")) ? `&estado=eq.${u.searchParams.get("estado")}` : "";
  try{
    const [filas, devs] = await Promise.all([sbTodo(`solicitudes?select=${CAMPOS}&creado=gte.${desde}${estado}&order=creado.desc`), sb("desarrolladoras?select=nombre,whatsapp,desarrollos,activa")]);
    const mes = new Date(); mes.setUTCDate(1); mes.setUTCHours(6, 0, 0, 0);
    const delMes = filas.filter(s => new Date(s.creado) >= mes);
    const resumen = {};
    for(const s of delMes){
      const r = resumen[s.desarrollo] ||= {desarrollo:desarrollos().find(d => d.id === s.desarrollo)?.nombre || s.desarrollo, solicitudes:0, verificadas:0, cobrables:0, invalidas:0};
      r.solicitudes++; if(s.verificada_en) r.verificadas++; if(s.estado === "invalida") r.invalidas++;
      if(s.verificada_en && s.enviada_en && s.estado !== "invalida" && !s.duplicada_de) r.cobrables++;
    }
    return respuesta(200, {ok:true, apiWhatsApp:apiLista(), solicitudes:filas.map(s => paraPanel(s, devs)),
      resumenMes:Object.values(resumen).sort((a, b) => b.cobrables - a.cobrables), desarrolladoras:devs});
  }catch(e){ console.error("[panel]", e.message); return error(502, "No se pudo leer la base de datos."); }
}

export async function POST(request){
  if(!autorizado(request)) return error(401, "La clave no es correcta.");
  let b;
  try{ b = await leerJSON(request, 3000); }catch(e){ return error(400, "Formato inválido."); }
  try{
    if(!/^V-[A-Z2-9]{6}$/.test(b.folio || "")) return error(400, "Folio inválido.");
    const [s] = await sb(`solicitudes?select=${CAMPOS}&folio=eq.${b.folio}&limit=1`);
    if(!s) return error(404, "No existe esa solicitud.");
    const guardar = cambios => sb(`solicitudes?folio=eq.${s.folio}`, {method:"PATCH", body:cambios, headers:{Prefer:"return=minimal"}}).then(() => Object.assign(s, cambios));
    let extra = {};
    switch(b.accion){
      case "verificar": { const v = await mandarVerificacion(s); extra = {enviado:v.ok, manual:v.manual}; break; }
      case "enviar": {
        if(!s.verificada_en) return error(409, "Primero el cliente tiene que verificar su cita.");
        const e = await mandarADesarrolladora(s); extra = {enviado:e.ok, manual:e.manual, motivo:e.motivo || null}; break;
      }
      case "marcar_enviada": {
        if(!s.verificada_en) return error(409, "Solo se envían citas verificadas por el cliente.");
        const dev = await desarrolladoraDe(s.desarrollo);
        await marcarEnviada(s, dev?.whatsapp || texto(b.a, 20) || null); break;
      }
      case "visita_hecha": await guardar({estado:"visita_hecha"}); break;
      case "invalida": {
        if(!MOTIVOS.includes(b.motivo)) return error(400, "Elige un motivo.");
        const detalle = texto(b.detalle, 600);
        if(detalle.length < 5) return error(400, "Escribe el detalle (qué te dijo el asesor y cómo consta).");
        let prueba_fecha = null;
        if(b.motivo === "cliente_previo"){
          const p = new Date(String(b.pruebaFecha) + "T12:00:00"), dias = (new Date(s.creado) - p) / 864e5;
          if(isNaN(p) || dias < 0 || dias > 60) return error(400, "Cliente previo: la prueba debe ser de los 60 días anteriores a la solicitud.");
          prueba_fecha = String(b.pruebaFecha);
        }
        await guardar({estado:"invalida", motivo_invalida:b.motivo, detalle_invalida:detalle, prueba_fecha}); break;
      }
      case "reactivar":
        await guardar({estado:s.llegada_en ? "visita_hecha" : s.enviada_en ? "enviada" : s.verificada_en ? "verificada" : "nueva", motivo_invalida:null, detalle_invalida:null, prueba_fecha:null}); break;
      case "cita_fecha": {
        const f = new Date(b.fecha);
        if(isNaN(f)) return error(400, "Fecha inválida.");
        await guardar({cita_fecha:f.toISOString()}); break;
      }
      default: return error(400, "Acción desconocida.");
    }
    const devs = await sb("desarrolladoras?select=nombre,whatsapp,desarrollos,activa");
    return respuesta(200, {ok:true, ...extra, solicitud:paraPanel(s, devs)});
  }catch(e){ console.error("[panel]", e.message); return error(502, "No se pudo guardar."); }
}
