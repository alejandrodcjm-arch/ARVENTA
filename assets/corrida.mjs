/* Corrida financiera de preventa: apartado → enganche a la firma → mensualidades durante la obra →
   liquidación contra escritura (crédito o contado). La usan el navegador (cotizador) y el servidor
   (/api/cotizacion), así lo que ve la persona y lo que se guarda es exactamente lo mismo.

   Esquema (data/desarrollos.json → esquemas[]), solo si la desarrolladora lo confirmó:
   {nombre, apartado, enganchePct, diferidoPct, diferidoMesesMax, liquidacionPct, descuentoPct,
    creditos, confirmado:"AAAA-MM-DD", confirmadoPor, vigenciaDias} */
export const CREDITOS_LIQUIDACION = ["Infonavit", "Fovissste", "Banco", "Cofinavit", "Contado"];
const r = n => Math.round(n);

export function rangoPrecio(d){ return {min:d.desde, max:d.hasta || d.desde}; }

/* El precio no se escribe: solo se elige entre los que dio el proyecto (por modelo si los hay; si no, desde/hasta) */
export function preciosDe(d){
  if(d.precios?.length) return d.precios.map(p => ({modelo:p.modelo, precio:p.precio}));
  if(d.operacion === "reventa") return [{modelo:"Precio de venta", precio:d.desde}];
  return [{modelo:"Precio desde", precio:d.desde}, ...(d.hasta && d.hasta !== d.desde ? [{modelo:"Precio hasta", precio:d.hasta}] : [])];
}
/* La tasa tampoco: o las opciones que dio el proyecto (bancos con convenio, por ejemplo) o una tasa de referencia fija */
export const TASA_REFERENCIA = {nombre:"Tasa de referencia (promedio de los bancos, Banxico)", tasa:11.3};
export function financiamientoDe(d){
  const f = d.financiamiento || {};
  return {tasas:f.tasas?.length ? f.tasas : [TASA_REFERENCIA], propias:!!f.tasas?.length,
    enganches:f.enganches?.length ? f.enganches : [10, 15, 20, 30], plazos:f.plazos?.length ? f.plazos : [10, 15, 20]};
}

export function revisarEntrada(d, e, x){
  const errores = [];
  if(!e) return ["Ese esquema de pago no existe."];
  if(!preciosDe(d).some(p => p.precio === x.precioLista)) errores.push("Elige uno de los precios del desarrollo.");
  if(!(x.enganchePct >= e.enganchePct && x.enganchePct <= 100 - e.diferidoPct)) errores.push(`El enganche va de ${e.enganchePct}% a ${100 - e.diferidoPct}%.`);
  if(e.diferidoPct > 0 && !(Number.isInteger(x.meses) && x.meses >= 1 && x.meses <= e.diferidoMesesMax)) errores.push(`Las mensualidades van de 1 a ${e.diferidoMesesMax}.`);
  const creditos = e.creditos?.length ? e.creditos : CREDITOS_LIQUIDACION;
  if(!creditos.includes(x.credito)) errores.push(`Para liquidar acepta: ${creditos.join(", ")}.`);
  return errores;
}

export function calcularCorrida(e, x){
  const precio = r(x.precioLista * (1 - (e.descuentoPct || 0) / 100));
  // El apartado se descuenta del enganche; si es mayor que el porcentaje elegido, el enganche real es el apartado
  const apartado = e.apartado || 0;
  const enganche = Math.max(r(precio * x.enganchePct / 100), apartado);
  const diferido = r(precio * e.diferidoPct / 100);
  const meses = e.diferidoPct > 0 ? x.meses : 0;
  const base = meses ? Math.floor(diferido / meses) : 0;
  const liquidacion = precio - enganche - diferido;
  const pagos = [];
  if(apartado) pagos.push({concepto:"Apartado", cuando:"Al reservar", monto:apartado});
  pagos.push({concepto:apartado ? "Resto del enganche" : "Enganche", cuando:"A la firma del contrato", monto:enganche - apartado});
  for(let i = 1; i <= meses; i++) pagos.push({concepto:`Mensualidad ${i} de ${meses}`, cuando:`Mes ${i} de obra`, monto:i === meses ? diferido - base * (meses - 1) : base});
  pagos.push({concepto:`Liquidación${x.credito === "Contado" ? " de contado" : ` con ${x.credito}`}`, cuando:"A la entrega (contra escritura)", monto:liquidacion});
  return {precioLista:x.precioLista, descuentoPct:e.descuentoPct || 0, precio, enganchePct:Math.round(enganche / precio * 1000) / 10, enganche, apartado,
    diferido, meses, mensualidad:base, liquidacion, credito:x.credito, pagos, total:pagos.reduce((a, p) => a + p.monto, 0)};
}

// Vigencia: la del esquema (15 días por omisión), sin pasar de 60 días desde que se verificó el precio
export function vigencia(d, e, hoy = new Date()){
  const porEsquema = new Date(hoy.getTime() + (e.vigenciaDias || 15) * 864e5);
  const porPrecio = new Date(new Date(d.verificado + "T12:00:00").getTime() + 60 * 864e5);
  return porEsquema < porPrecio ? porEsquema : porPrecio;
}
