/* Cotizador: corrida financiera con los esquemas que cada desarrolladora confirmó (data/desarrollos.json → esquemas).
   /cotizador.html?d=<id>&folio=V-XXXXXX          (comprador)
   /cotizador.html?d=<id>&modo=oficina            (asesor en la oficina de ventas; la cotización queda ligada a la cita) */
import {calcularCorrida, revisarEntrada, preciosDe, financiamientoDe, vigencia, CREDITOS_LIQUIDACION} from "./corrida.mjs";
import {crearPDF, hex} from "./pdf.mjs";

const $ = s => document.querySelector(s);
const q = new URLSearchParams(location.search);
const OFICINA = q.get("modo") === "oficina";
const dinero = n => "$" + Math.round(n).toLocaleString("es-MX");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fecha = f => f.toLocaleDateString("es-MX", {day:"numeric", month:"long", year:"numeric"});
// La tasa no se escribe: la primera que dio el proyecto o la de referencia
const PLAZO = 20;
let TASA_BANCO = 11.3;
const mensualidadBanco = m => { const t = TASA_BANCO / 100 / 12, n = PLAZO * 12; return m * t / (1 - Math.pow(1 + t, -n)); };

const conEsquemas = (window.DESARROLLOS || []).filter(d => d.esquemas?.length);
if(!conEsquemas.length){ $("#sin-esquemas").hidden = false; }
else{
  $("#cotizador").hidden = false;
  if(OFICINA){ $("#eyebrow").textContent = "COTIZADOR PARA ASESORES"; document.title = "Cotizador para asesores · ARVENTA"; }
  $("#q-desarrollo").innerHTML = conEsquemas.map(d => `<option value="${esc(d.id)}">${esc(d.nombre)}</option>`).join("");
  if(conEsquemas.some(d => d.id === q.get("d"))) $("#q-desarrollo").value = q.get("d");
  if(/^V-[A-Z2-9]{6}$/i.test(q.get("folio") || "")) $("#q-folio").value = q.get("folio").toUpperCase();
}

const actual = () => {
  const d = conEsquemas.find(x => x.id === $("#q-desarrollo").value);
  return {d, e:d.esquemas.find(x => x.nombre === $("#q-esquema").value) || d.esquemas[0]};
};
function preparar(){
  const d = conEsquemas.find(x => x.id === $("#q-desarrollo").value);
  $("#q-esquema").innerHTML = d.esquemas.map(e => `<option>${esc(e.nombre)}</option>`).join("");
  $("#q-esquema").disabled = d.esquemas.length === 1;
  $("#q-precio").innerHTML = preciosDe(d).map(p => `<option value="${p.precio}">${esc(p.modelo)}: ${dinero(p.precio)}</option>`).join("");
  $("#q-precio-rango").textContent = "Precios publicados por el desarrollo; no se pueden modificar.";
  $("#logo-desarrolladora").innerHTML = OFICINA && d.logo ? `<img src="/${esc(d.logo)}" alt="${esc(d.desarrolladora || "")}" height="36">` : "";
  prepararEsquema();
}
function prepararEsquema(){
  const {d, e} = actual();
  Object.assign($("#q-enganche"), {min:e.enganchePct, max:100 - e.diferidoPct, value:e.enganchePct});
  $("#q-meses").innerHTML = e.diferidoPct > 0 ? Array.from({length:e.diferidoMesesMax}, (_, i) => `<option value="${i + 1}">${i + 1} ${i ? "meses" : "mes"}</option>`).join("") : `<option value="0">Sin mensualidades</option>`;
  $("#q-meses").value = e.diferidoPct > 0 ? e.diferidoMesesMax : 0;
  $("#q-meses").disabled = !(e.diferidoPct > 0);
  const creditos = (e.creditos?.length ? e.creditos : CREDITOS_LIQUIDACION);
  $("#q-credito").innerHTML = creditos.map(c => `<option>${c}</option>`).join("");
  $("#q-esquema-info").textContent = `${e.apartado ? `Apartado de ${dinero(e.apartado)}. ` : ""}${e.enganchePct}% de enganche, ${e.diferidoPct}% en mensualidades y ${e.liquidacionPct}% contra escritura.${e.descuentoPct ? ` ${e.descuentoPct}% de descuento sobre precio de lista.` : ""} Confirmado por ${e.confirmadoPor} el ${fecha(new Date(e.confirmado + "T12:00:00"))}.`;
  calcular();
}
function entrada(){
  return {precioLista:Number($("#q-precio").value), enganchePct:Number($("#q-enganche").value), meses:Number($("#q-meses").value), credito:$("#q-credito").value};
}
let ultima = null;
function calcular(){
  const {d, e} = actual(), x = entrada();
  TASA_BANCO = financiamientoDe(d).tasas[0].tasa;
  $("#q-enganche-val").textContent = `${x.enganchePct}%`;
  const problemas = revisarEntrada(d, e, x);
  $("#cot-error").hidden = !problemas.length; $("#cot-error").textContent = problemas.join(" ");
  $("#descargar").disabled = !!problemas.length;
  if(problemas.length){ ultima = null; return; }
  const c = calcularCorrida(e, x); ultima = {d, e, c};
  const credito = c.credito === "Contado" ? "de contado" : c.credito === "Banco" ? `con banco (≈ ${dinero(mensualidadBanco(c.liquidacion))} al mes a ${PLAZO} años, ${TASA_BANCO}%)` : `con ${c.credito} (el monto y la mensualidad los define ${c.credito})`;
  $("#resumen-cot").innerHTML = `
    ${c.descuentoPct ? `<p class="nota" style="margin:0 0 8px">Precio con ${c.descuentoPct}% de descuento: <b>${dinero(c.precio)}</b> (lista ${dinero(c.precioLista)})</p>` : ""}
    <ol class="pasos-pago">
      ${c.apartado ? `<li><span>Al apartar</span><b>${dinero(c.apartado)}</b></li>` : ""}
      <li><span>A la firma del contrato</span><b>${dinero(c.enganche - c.apartado)}</b></li>
      ${c.meses ? `<li><span>${c.meses} ${c.meses === 1 ? "mensualidad" : "mensualidades"} durante la obra</span><b>${dinero(c.mensualidad)}<small> al mes</small></b></li>` : ""}
      <li><span>Al recibirla, ${credito}</span><b>${dinero(c.liquidacion)}</b></li>
    </ol>
    <p class="total-cot">Total <b>${dinero(c.total)}</b></p>`;
  $("#tabla-cot").innerHTML = `<table class="tabla"><thead><tr><th>Pago</th><th>Cuándo</th><th class="n">Monto</th></tr></thead><tbody>${c.pagos.map(p => `<tr><td>${esc(p.concepto)}</td><td>${esc(p.cuando)}</td><td class="n">${dinero(p.monto)}</td></tr>`).join("")}</tbody></table>`;
  $("#leyenda-cot").textContent = `Cotización informativa, sujeta a disponibilidad y cambio de precio. No incluye gastos de escrituración (≈6%) ni avalúo. Precio verificado el ${fecha(new Date(d.verificado + "T12:00:00"))}; vigente hasta el ${fecha(vigencia(d, e))}.`;
}

async function registrar(){
  try{
    const r = await fetch("/api/cotizacion", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
      desarrollo:ultima.d.id, esquema:ultima.e.nombre, ...entrada(), folio:$("#q-folio").value.trim().toUpperCase() || null, origen:OFICINA ? "oficina" : "sitio"})});
    const j = await r.json().catch(() => ({}));
    if(r.ok && j.ok) return j;
    if(r.status === 400) throw new Error(j.mensaje);
  }catch(e){ if(e.message) throw e; }
  return {codigo:null}; // sin conexión: el PDF sale igual, sin código de registro
}

function pdf({d, e, c}, codigo, folio){
  const doc = crearPDF({titulo:`Cotización ${d.nombre}`}).pagina();
  const verde = hex("#2F6B5E"), gris = hex("#5B6873"), tinta = hex("#1D2B3A"), suave = hex("#EEF5F3");
  const M = 54, D = doc.ANCHO - 54, hoy = new Date();
  doc.rect(0, 0, doc.ANCHO, 8, verde);
  doc.texto(M, 50, "ARVENTA", {tam:16, negrita:true, color:verde});
  doc.texto(D, 44, "COTIZACIÓN INFORMATIVA", {tam:9, negrita:true, color:gris, alinear:"der"});
  doc.texto(D, 58, `Emitida el ${fecha(hoy)}`, {tam:9, color:gris, alinear:"der"});
  let y = 96;
  doc.texto(M, y, d.nombre, {tam:22, negrita:true, color:tinta}); y += 20;
  doc.texto(M, y, `${{casa:"Casas", departamento:"Departamentos", terreno:"Terrenos"}[d.tipo]} · ${d.zona}`.slice(0, 95), {tam:10, color:gris}); y += 26;
  const nombre = $("#q-nombre").value.trim();
  const datos = [["Para", nombre || "—"], ["Código de cotización", codigo || "Sin registrar (sin conexión)"], ["Código de cita", folio || "—"],
    ["Esquema", e.nombre], ["Precio de lista", dinero(c.precioLista)], ...(c.descuentoPct ? [["Precio con descuento", `${dinero(c.precio)} (${c.descuentoPct}%)`]] : []),
    ["Enganche", `${c.enganchePct}% · ${dinero(c.enganche)}`], ["Liquidación con", c.credito]];
  doc.rect(M - 8, y - 14, D - M + 16, datos.length * 16 + 12, suave);
  for(const [k, v] of datos){ doc.texto(M, y, k, {tam:10, color:gris}); doc.texto(M + 150, y, v, {tam:10, negrita:true, color:tinta}); y += 16; }
  y += 22;
  doc.texto(M, y, "Pago", {tam:9, negrita:true, color:gris}); doc.texto(M + 250, y, "Cuándo", {tam:9, negrita:true, color:gris}); doc.texto(D, y, "Monto", {tam:9, negrita:true, color:gris, alinear:"der"});
  y += 6; doc.linea(M, y, D, y, {color:gris});
  for(const p of c.pagos){
    if(y > 700){ doc.pagina(); y = 60; }
    y += 15;
    doc.texto(M, y, p.concepto, {tam:10, color:tinta}); doc.texto(M + 250, y, p.cuando, {tam:10, color:gris}); doc.texto(D, y, dinero(p.monto), {tam:10, color:tinta, alinear:"der"});
    y += 5; doc.linea(M, y, D, y);
  }
  y += 18; doc.texto(M, y, "Total", {tam:12, negrita:true, color:tinta}); doc.texto(D, y, dinero(c.total), {tam:12, negrita:true, color:tinta, alinear:"der"});
  if(c.credito === "Banco"){ y += 18; doc.texto(M, y, `Mensualidad estimada del crédito bancario por la liquidación: ${dinero(mensualidadBanco(c.liquidacion))} a ${PLAZO} años (${TASA_BANCO}% anual).`, {tam:9, color:gris}); }
  if(y > 640){ doc.pagina(); y = 40; }
  y += 30;
  y = doc.parrafo(M, y, `Cotización informativa, sujeta a disponibilidad y cambio de precio. No es una oferta vinculante: el precio y las condiciones finales los define ${d.desarrolladora || "la desarrolladora"} en el contrato. No incluye gastos de escrituración (aprox. 6%), avalúo ni comisiones del crédito.`, D - M, {tam:9, color:gris});
  y = doc.parrafo(M, y + 4, `Precio verificado el ${fecha(new Date(d.verificado + "T12:00:00"))}. Esquema confirmado por ${e.confirmadoPor} el ${fecha(new Date(e.confirmado + "T12:00:00"))}. Vigente hasta el ${fecha(vigencia(d, e))}.`, D - M, {tam:9, color:gris});
  doc.parrafo(M, y + 4, `ARVENTA · ${window.ARVENTA?.SITIO?.replace("https://", "") || "arventa.mx"} · WhatsApp 618 446 3867 · ARVENTA es un portal: no vende inmuebles.`, D - M, {tam:8, color:gris});
  const limpio = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  doc.descargar(`Cotizacion-${limpio(d.nombre)}${nombre ? "-" + limpio(nombre) : ""}.pdf`);
}

for(const id of ["#q-precio", "#q-enganche", "#q-meses", "#q-credito"]) $(id)?.addEventListener("input", calcular);
$("#q-desarrollo")?.addEventListener("change", preparar);
$("#q-esquema")?.addEventListener("change", prepararEsquema);
$("#descargar")?.addEventListener("click", async () => {
  if(!ultima) return;
  const b = $("#descargar"); b.disabled = true; b.textContent = "Preparando…";
  try{
    const r = await registrar();
    pdf(ultima, r.codigo, r.folio || null);
    window.medir?.("cotizacion", {id:ultima.d.id});
  }catch(e){ $("#cot-error").hidden = false; $("#cot-error").textContent = e.message; }
  finally{ b.disabled = false; b.textContent = "Descargar PDF"; }
});

// Arranque al final, cuando ya existen todas las funciones
if(conEsquemas.length) preparar();
