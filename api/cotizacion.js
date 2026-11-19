/* POST /api/cotizacion: guarda una corrida financiera y le da un código (C-XXXXXX) que va en el PDF.
   Si trae un código de cita (folio) del mismo desarrollo, la cotización queda ligada a esa cita, aunque
   la haga el asesor en la oficina de ventas. No guarda nombres: el nombre solo va en el PDF del cliente. */
import {desarrollos, respuesta, error, leerJSON, sb, nuevoFolio} from "./_lib/comun.js";
import {revisarEntrada, calcularCorrida} from "../assets/corrida.mjs";

export async function POST(request){
  let b;
  try{ b = await leerJSON(request, 2000); }catch(e){ return error(400, "Formato inválido."); }
  const d = desarrollos().find(x => x.id === b.desarrollo);
  if(!d?.esquemas?.length) return error(400, "Este desarrollo todavía no tiene esquemas de pago confirmados.");
  const e = d.esquemas.find(x => x.nombre === b.esquema);
  const x = {precioLista:Number(b.precioLista), enganchePct:Number(b.enganchePct), meses:Number(b.meses), credito:String(b.credito || "")};
  const problemas = revisarEntrada(d, e, x);
  if(problemas.length) return error(400, problemas.join(" "));
  const c = calcularCorrida(e, x);
  try{
    let folio = null;
    if(/^V-[A-Z2-9]{6}$/.test(b.folio || "")){
      const [s] = await sb(`solicitudes?select=folio,desarrollo&folio=eq.${b.folio}&limit=1`);
      if(!s || s.desarrollo !== d.id) return error(400, "Ese código de cita no es de este desarrollo.");
      folio = s.folio;
    }
    const codigo = nuevoFolio("C");
    await sb("cotizaciones", {method:"POST", headers:{Prefer:"return=minimal"}, body:{codigo, folio, desarrollo:d.id, esquema:e.nombre,
      origen:b.origen === "oficina" ? "oficina" : "sitio", precio:c.precio, enganche:c.enganche, meses:c.meses, credito:c.credito,
      datos:{precioLista:c.precioLista, descuentoPct:c.descuentoPct, liquidacion:c.liquidacion, mensualidad:c.mensualidad}}});
    return respuesta(200, {ok:true, codigo, folio});
  }catch(err){
    console.error("[cotizacion]", err.message);
    return error(502, "No pudimos registrar la cotización.");
  }
}
