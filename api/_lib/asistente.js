/* Motor del asistente de ARVENTA (lo usa api/asistente.js).
   La IA no inventa: todo lo que dice sale de estas herramientas, que leen data/desarrollos.json y data/lugares.json.
   Hay dos tipos de herramientas:
     - de consulta (se ejecutan aquí y regresan datos a la IA)
     - de pantalla (la IA mueve el sitio: mostrar resultados, ordenar por su trabajo, abrir una ficha, comparar, agendar).
       Se ejecutan en el navegador; aquí solo se anotan en "acciones".
   Los supuestos de presupuesto son los mismos de assets/app.js (SUPUESTOS, TASA_BANCO, PLAZO_BANCO): si cambian allá, cámbialos aquí. */
import {readFileSync, existsSync} from "node:fs";
import {desarrollos, metros, env} from "./comun.js";

/* ---------- Datos ---------- */
let LUGARES = null;
function lugares(){
  if(!LUGARES){
    const f = new URL("../../data/lugares.json", import.meta.url);
    LUGARES = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")).porDesarrollo || {} : {};
  }
  return LUGARES;
}
const op = d => d.operacion || "nueva";
const AMEN = {
  alberca:/alberca/i, vigilancia:/vigilan|caseta|control de acceso|acceso con tarjeta/i, gimnasio:/gimnas/i,
  verdes:/verde|pista para correr/i, juegos:/juegos|ludoteca/i, canchas:/cancha|pádel|tenis/i
};
const amenidades = d => { const t = [d.nombre, ...(d.ventajas || [])].join(" "); return Object.keys(AMEN).filter(k => AMEN[k].test(t)); };
const recMax = d => { const m = String(d.recamaras).match(/\d+/g); return m ? Math.max(...m.map(Number)) : 0; };
const m2 = d => { const m = String(d.m2).match(/(\d+)/); return m ? +m[1] : null; };
const porM2 = d => { const m = m2(d); return m && d.tipo !== "terreno" && op(d) !== "renta" ? Math.round(d.desde / m) : null; };
const vencido = d => !d.verificado || (Date.now() - new Date(d.verificado + "T12:00:00")) / 864e5 > 60;
const normal = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const minAuto = m => Math.max(2, Math.round(m * 1.35 / 1000 / 28 * 60));
function promedioM2(tipo){
  const v = desarrollos().filter(d => d.tipo === tipo && op(d) === "nueva").map(porM2).filter(Boolean);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
function cerca(d){
  const p = lugares()[d.id];
  if(!p || d.lat == null) return null;
  const r = {};
  for(const [k, l] of Object.entries(p.mas || {})) r[k] = {nombre:l.nombre || null, metros:l.m};
  return {mas_cercano:r, a_menos_de_1km:p.conteo || {}};
}

/* ---------- Presupuesto (igual que assets/app.js) ---------- */
const TASA_BANCO = 11.3, PLAZO_BANCO = 20;
const S = {bancoPorcentaje:.30, engancheMin:.10, gastos:.06, infPorcentaje:.30, infPlazo:30,
  infTasaMin:3.69, infSueldoMin:9272, infTasaMax:10.45, infSueldoMax:23537, infTope:2935002};
const creditoMax = (mensual, tasa, anios) => { const t = tasa / 100 / 12, n = anios * 12; return mensual * (1 - Math.pow(1 + t, -n)) / t; };
const pago = (monto, tasa, anios) => { const t = tasa / 100 / 12, n = anios * 12; return monto * t / (1 - Math.pow(1 + t, -n)); };
function tasaInfonavit(s){
  if(s <= S.infSueldoMin) return S.infTasaMin;
  if(s >= S.infSueldoMax) return S.infTasaMax;
  return S.infTasaMin + (S.infTasaMax - S.infTasaMin) * (s - S.infSueldoMin) / (S.infSueldoMax - S.infSueldoMin);
}
export function presupuesto({sueldo = 0, ahorro = 0, subcuenta = 0}){
  sueldo = Math.max(0, +sueldo || 0); ahorro = Math.max(0, +ahorro || 0); subcuenta = Math.max(0, +subcuenta || 0);
  const bPago = sueldo * S.bancoPorcentaje, bCredito = creditoMax(bPago, TASA_BANCO, PLAZO_BANCO);
  const bancoMax = Math.min((bCredito + ahorro) / (1 + S.gastos), ahorro / (S.engancheMin + S.gastos));
  const tasa = tasaInfonavit(sueldo), iCredito = Math.min(creditoMax(sueldo * S.infPorcentaje, tasa, S.infPlazo), S.infTope);
  const infMax = (iCredito + subcuenta + ahorro) / (1 + S.gastos);
  const r = n => Math.round(n / 1000) * 1000;
  return {
    con_banco:{vivienda_hasta:r(bancoMax), mensualidad_max:r(bPago), credito_max:r(bCredito), te_limita:ahorro / (S.engancheMin + S.gastos) < (bCredito + ahorro) / (1 + S.gastos) ? "el ahorro para enganche y gastos" : "el ingreso"},
    con_infonavit:{vivienda_hasta:r(infMax), descuento_nomina:r(sueldo * S.infPorcentaje), credito_max:r(iCredito), tasa:+tasa.toFixed(2)},
    presupuesto_recomendado:r(Math.max(bancoMax, infMax)),
    supuestos:`Banco: mensualidad hasta 30% del ingreso, ${TASA_BANCO}% anual a ${PLAZO_BANCO} años, enganche mínimo 10% y ~6% de gastos de escrituración. Infonavit: descuento hasta 30% del sueldo a 30 años, tope $2,935,002. Es estimación; se confirma con la precalificación.`
  };
}

/* ---------- Resumen de un desarrollo para la IA ---------- */
function resumen(d, ref){
  const pm = porM2(d), prom = promedioM2(d.tipo);
  const r = {id:d.id, nombre:d.nombre, operacion:op(d), tipo:d.tipo, desde:d.desde, hasta:d.hasta || null,
    precio_por_confirmar:vencido(d), recamaras:d.recamaras, m2:d.m2, zona:d.zona,
    creditos_confirmados:d.creditos?.length ? d.creditos : "por confirmar", entrega:d.entrega || "por confirmar",
    amenidades:amenidades(d), precio_m2:pm, m2_vs_promedio:pm && prom ? Math.round((pm / prom - 1) * 100) + "%" : null,
    mensualidad_banco_aprox:op(d) === "renta" ? null : Math.round(pago(d.desde * .8, TASA_BANCO, PLAZO_BANCO)),
    ubicacion:d.lat == null ? "por confirmar" : d.aprox ? "aproximada" : "exacta"};
  const c = cerca(d);
  if(c) r.cerca = Object.fromEntries(Object.entries(c.mas_cercano).map(([k, v]) => [k, v.metros]));
  if(ref && d.lat != null){ const m = metros(d, ref); r.km_a_referencia = +(m / 1000).toFixed(1); r.min_auto_aprox = minAuto(m); }
  return r;
}

/* ---------- Herramientas ---------- */
const CRED = ["Infonavit", "Fovissste", "Banco", "Cofinavit", "Contado"];
const CERCA = {escuela:"escuela", oxxo:"oxxo", super:"super", parque:"parque", salud:"salud"};
export const HERRAMIENTAS = [
  {name:"buscar_desarrollos",
   description:"Busca en los desarrollos y anuncios de ARVENTA en Durango. Úsala siempre antes de recomendar algo: es la única fuente de verdad. Regresa a lo más 8 resultados con precio, recámaras, créditos confirmados, amenidades, qué hay cerca (metros) y distancia a la referencia de la persona si la hay.",
   input_schema:{type:"object", properties:{
     operacion:{type:"string", enum:["compra", "nueva", "reventa", "renta"], description:"compra = nueva + reventa (por omisión)"},
     tipos:{type:"array", items:{type:"string", enum:["casa", "departamento", "terreno"]}},
     precio_max:{type:"number"}, precio_min:{type:"number"},
     recamaras_min:{type:"integer"},
     creditos:{type:"array", items:{type:"string", enum:CRED}, description:"Solo los que el desarrollo confirmó"},
     amenidades:{type:"array", items:{type:"string", enum:Object.keys(AMEN)}},
     texto:{type:"string", description:"Palabras de zona, colonia o nombre (ej. 'Mezquital', 'salida a Mazatlán')"},
     cerca_max_metros:{type:"object", description:"Distancia máxima a cada tipo de lugar", properties:Object.fromEntries(Object.keys(CERCA).map(k => [k, {type:"number"}]))},
     orden:{type:"string", enum:["cerca", "barato", "m2"], description:"cerca = a la referencia de la persona (su trabajo, escuela, etc.)"}
   }}},
  {name:"ver_desarrollo",
   description:"Todo lo que se sabe de un desarrollo: ventajas, modelos, qué incluye, entrega, créditos, fuentes y fecha de verificación del precio, lugares cercanos con nombre.",
   input_schema:{type:"object", properties:{id:{type:"string"}}, required:["id"]}},
  {name:"calcular_presupuesto",
   description:"Calcula hasta cuánto podría pagar con banco y con Infonavit según su ingreso mensual, su ahorro y su subcuenta de vivienda. Úsala cuando la persona diga cuánto gana.",
   input_schema:{type:"object", properties:{sueldo:{type:"number", description:"Ingreso mensual de la familia"}, ahorro:{type:"number"}, subcuenta:{type:"number", description:"Saldo de la subcuenta de vivienda Infonavit, si lo sabe"}}, required:["sueldo"]}},
  {name:"poner_referencia",
   description:"Ubica el lugar que le importa a la persona (su trabajo, la escuela de sus hijos, la casa de sus papás) para ordenar por cercanía. Mueve la pantalla y regresa sus coordenadas.",
   input_schema:{type:"object", properties:{lugar:{type:"string", description:"Ej. 'Ciudad Industrial', 'UJED', 'Hospital 450'"}, tipo:{type:"string", enum:["trabajo", "escuela", "hospital", "otro"]}}, required:["lugar"]}},
  {name:"mostrar_en_pantalla",
   description:"Pone en la pantalla de la persona los desarrollos que le recomiendas, en ese orden, con una razón corta y cierta para cada uno (máx. 90 caracteres). Úsala cada vez que recomiendes.",
   input_schema:{type:"object", properties:{ids:{type:"array", items:{type:"string"}, maxItems:8},
     razones:{type:"object", additionalProperties:{type:"string"}}, titulo:{type:"string", description:"Ej. 'Para ti: 3 recámaras con Infonavit'"}}, required:["ids"]}},
  {name:"guardar_presupuesto",
   description:"Guarda en la pantalla el ingreso y ahorro de la persona para que cada tarjeta diga si le alcanza. Solo si ella dio esos datos.",
   input_schema:{type:"object", properties:{sueldo:{type:"number"}, ahorro:{type:"number"}, subcuenta:{type:"number"}}, required:["sueldo"]}},
  {name:"abrir_ficha", description:"Abre la ficha completa de un desarrollo.", input_schema:{type:"object", properties:{id:{type:"string"}}, required:["id"]}},
  {name:"comparar", description:"Abre el comparador con 2 o 3 desarrollos lado a lado.", input_schema:{type:"object", properties:{ids:{type:"array", items:{type:"string"}, minItems:2, maxItems:3}}, required:["ids"]}},
  {name:"agendar_visita", description:"Abre el formulario para agendar visita a un desarrollo. La persona llena sus datos ahí, no en el chat.", input_schema:{type:"object", properties:{id:{type:"string"}}, required:["id"]}}
];
const DE_PANTALLA = new Set(["mostrar_en_pantalla", "guardar_presupuesto", "abrir_ficha", "comparar", "agendar_visita"]);

async function geocodificar(lugar){
  const CAJA = {s:23.95, w:-104.77, n:24.10, e:-104.56};
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.search = new URLSearchParams({q:`${lugar}, Durango, Durango, México`, format:"json", limit:"1", countrycodes:"mx", viewbox:`${CAJA.w},${CAJA.n},${CAJA.e},${CAJA.s}`, bounded:"1"});
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 5000);
  try{
    const r = await fetch(u, {headers:{"User-Agent":"ARVENTA/1.0 (arventa.mx)", "Accept-Language":"es"}, signal:ctl.signal});
    const j = await r.json();
    return j[0] ? {lat:+j[0].lat, lng:+j[0].lon} : null;
  }catch(e){ return null; } finally{ clearTimeout(t); }
}

/* Ejecuta una herramienta. ctx = {ref, acciones}. Regresa lo que ve la IA. */
export async function ejecutar(nombre, x = {}, ctx){
  const todos = desarrollos();
  const existe = id => todos.some(d => d.id === id);
  if(nombre === "buscar_desarrollos"){
    const opr = x.operacion || "compra";
    let l = todos.filter(d => opr === "compra" ? op(d) !== "renta" : op(d) === opr);
    if(x.tipos?.length) l = l.filter(d => x.tipos.includes(d.tipo));
    if(x.precio_max) l = l.filter(d => d.desde <= x.precio_max);
    if(x.precio_min) l = l.filter(d => d.desde >= x.precio_min);
    if(x.recamaras_min) l = l.filter(d => d.tipo === "terreno" || recMax(d) >= x.recamaras_min);
    for(const c of x.creditos || []) l = l.filter(d => (d.creditos || []).includes(c));
    for(const a of x.amenidades || []) l = l.filter(d => amenidades(d).includes(a));
    if(x.texto){ const p = normal(x.texto).split(/\s+/).filter(w => w.length > 2); if(p.length) l = l.filter(d => { const t = normal([d.nombre, d.zona, d.desarrolladora].join(" ")); return p.some(w => t.includes(w)); }); }
    for(const [k, max] of Object.entries(x.cerca_max_metros || {})) if(CERCA[k] && max) l = l.filter(d => { const c = lugares()[d.id]?.mas?.[k]; return c && c.m <= max; });
    const ref = ctx.ref;
    const orden = x.orden || (ref ? "cerca" : "barato");
    l.sort((a, b) => orden === "m2" ? (porM2(a) ?? 1e9) - (porM2(b) ?? 1e9)
      : orden === "cerca" && ref ? (a.lat == null) - (b.lat == null) || (a.lat == null ? 0 : metros(a, ref) - metros(b, ref))
      : a.desde - b.desde);
    return {total:l.length, resultados:l.slice(0, 8).map(d => resumen(d, ref)), referencia:ref?.nombre || null,
      nota:l.length ? undefined : "No hay resultados con todo eso. Di con honestidad qué condición no se cumple y ofrece la opción más cercana quitando una sola condición."};
  }
  if(nombre === "ver_desarrollo"){
    const d = todos.find(v => v.id === x.id);
    if(!d) return {error:"No existe ese id."};
    const c = cerca(d);
    return {...resumen(d, ctx.ref), ventajas:d.ventajas || [], modelos:d.modelos || null, incluye:d.incluye || "por confirmar",
      fecha_entrega:d.fechaEntrega || null, desarrolladora:d.desarrolladora || null, precio_verificado_el:d.verificado || null,
      fuentes:(d.fuentes || []).map(f => f[0]), tiene_corrida_financiera:!!d.esquemas?.length, lugares_cercanos:c?.mas_cercano || null, ficha:`/desarrollos/${d.id}/`};
  }
  if(nombre === "calcular_presupuesto") return presupuesto(x);
  if(nombre === "poner_referencia"){
    const lugar = String(x.lugar || "").slice(0, 80);
    const p = env("ASISTENTE_SIN_RED") ? null : await geocodificar(lugar);
    if(!p) return {error:`No encontré "${lugar}" en Durango. Pide otra referencia o que lo marque en el mapa con el botón "Cerca de".`};
    ctx.ref = {...p, nombre:lugar, tipo:x.tipo === "trabajo" ? "trabajo" : x.tipo || "otro"};
    ctx.acciones.push({tipo:"poner_referencia", lat:ctx.ref.lat, lng:ctx.ref.lng, nombre:ctx.ref.nombre, tipo_ref:ctx.ref.tipo});
    return {ok:true, lugar, nota:"Listo. Ahora busca con orden 'cerca' para ordenar por distancia a este lugar."};
  }
  if(DE_PANTALLA.has(nombre)){
    const ids = (x.ids || (x.id ? [x.id] : [])).filter(existe);
    if((x.ids || x.id) && !ids.length) return {error:"Ese id no existe. Usa los ids que regresó buscar_desarrollos."};
    const a = {tipo:nombre, ...x};
    if(x.ids) a.ids = ids;
    if(nombre === "mostrar_en_pantalla") a.razones = Object.fromEntries(Object.entries(x.razones || {}).filter(([k]) => ids.includes(k)).map(([k, v]) => [k, String(v).slice(0, 110)]));
    ctx.acciones.push(a);
    return {ok:true};
  }
  return {error:"Herramienta desconocida."};
}

/* ---------- Instrucciones ---------- */
export function instrucciones(){
  const n = desarrollos().length;
  return `Eres el asistente de ARVENTA, un portal de vivienda en Durango, Dgo., México. Ayudas a familias a encontrar casa, departamento o terreno que les convenga, y manejas la pantalla del sitio por ellas.

Cómo trabajas:
- Hablas español de México, cálido y directo, como un buen amigo que sabe de casas. Respuestas cortas: 2 a 5 renglones, porque casi todos leen en el celular.
- Primero usa herramientas, luego responde. Para recomendar SIEMPRE llama buscar_desarrollos y después mostrar_en_pantalla con los ids y una razón cierta para cada uno. La pantalla es tu respuesta principal: no repitas en texto toda la lista.
- Si la persona dice cuánto gana, usa calcular_presupuesto y guardar_presupuesto, y busca con precio_max igual a presupuesto_recomendado. Explica el resultado en una frase y aclara que es estimación.
- Si menciona su trabajo, la escuela de sus hijos u otro lugar, usa poner_referencia y busca con orden "cerca". Habla de minutos aproximados en auto.
- Si le faltan datos importantes, haz UNA sola pregunta a la vez (presupuesto o ingreso, zona o trabajo, recámaras). Si ya hay suficiente, recomienda sin preguntar.
- Para agendar, usa agendar_visita: la persona deja sus datos en el formulario, nunca le pidas nombre ni teléfono en el chat.

Reglas que no se rompen:
- Solo dices lo que regresan las herramientas. Nunca inventes precios, créditos, amenidades, fechas, distancias ni corridas. Lo que diga "por confirmar" lo dices así.
- Precios: di "desde $X" y que pueden variar al cerrar. Si precio_por_confirmar es true, dilo. No prometas plusvalía, rendimientos ni descuentos.
- ARVENTA no vende: conecta a la persona con quien comercializa el desarrollo. Es gratis para ella.
- No das asesoría financiera ni legal: das estimaciones y recomiendas confirmar con Infonavit, su banco o la desarrolladora.
- Trata a todos igual. Recomienda por presupuesto, necesidades y ubicación; nunca por edad, origen, religión, estado civil u otra característica de la persona, y no hables de "qué tipo de gente vive" en una zona.
- Si preguntan algo que no es de vivienda en Durango, regresa amablemente al tema.
Hay ${n} opciones en el catálogo de hoy.`;
}

/* ---------- Modo demostración (sin llave de IA) ----------
   Entiende frases sencillas con reglas para que el sitio funcione en pruebas y sin ANTHROPIC_API_KEY. */
function numero(t){
  const m = String(t).match(/(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(mil|millones?|millon|mdp|m|k)?\b/i);
  if(!m) return null;
  let n = m[1].includes(",") ? +m[1].replace(/,/g, "") : parseFloat(m[1]);
  const u = (m[2] || "").toLowerCase();
  if(u === "mil" || u === "k") n *= 1e3; else if(u) n *= 1e6;
  return n;
}
export async function demo(mensaje, ctx){
  const t = normal(mensaje), x = {};
  if(/renta/.test(t)) x.operacion = "renta";
  const tipos = [["casa", /\bcasas?\b/], ["departamento", /departamento|depa/], ["terreno", /terreno|lote/]].filter(([, r]) => r.test(t)).map(([k]) => k);
  if(tipos.length) x.tipos = tipos;
  const rec = t.match(/(\d)\s*(recamaras|cuartos|habitaciones)/); if(rec) x.recamaras_min = +rec[1];
  x.creditos = CRED.filter(c => t.includes(normal(c))); if(!x.creditos.length) delete x.creditos;
  x.amenidades = Object.keys(AMEN).filter(k => AMEN[k].test(t)); if(!x.amenidades.length) delete x.amenidades;
  if(/escuela/.test(t)) x.cerca_max_metros = {escuela:800};
  const gano = t.match(/(gano|ganamos|ingreso|sueldo)[^\d]*(\d[\d.,]*\s*(mil|k)?)/);
  let texto = "";
  if(gano){
    const sueldo = numero(gano[2]);
    const ah = t.match(/(\d[\d.,]*\s*(?:mil|k|m|millones?)?)\s*(?:de\s+)?(?:ahorr|enganche)/) || t.match(/(?:ahorr\w*|enganche)(?:\s+(?:de|como|unos|tengo|es|son|seria))*\s*\$?\s*(\d[\d.,]*\s*(?:mil|k|m|millones?)?)/);
    const ahorro = ah ? numero(ah[1]) : 0;
    const p = presupuesto({sueldo, ahorro});
    await ejecutar("guardar_presupuesto", {sueldo, ahorro}, ctx);
    x.precio_max = p.presupuesto_recomendado;
    texto += `Con ${"$" + Math.round(sueldo).toLocaleString("es-MX")} al mes${ahorro ? " y tu ahorro" : ""}, te podría alcanzar hasta unos $${Math.round(p.presupuesto_recomendado).toLocaleString("es-MX")} (estimación). `;
  }else{
    const pm = t.match(/(menos de|hasta|maximo|max|no pase de)\s*\$?\s*([\d.,]+\s*(m|millones?|mdp|mil|k)?)/);
    if(pm) x.precio_max = numero(pm[2]);
  }
  const lugar = mensaje.match(/(?:trabajo|trabajamos|estudio)\s+(?:en|cerca de)\s+([^,.;]+)/i)?.[1];
  if(lugar){ const r = await ejecutar("poner_referencia", {lugar:lugar.trim(), tipo:"trabajo"}, ctx); if(r.ok) x.orden = "cerca"; }
  const r = await ejecutar("buscar_desarrollos", x, ctx);
  const ids = r.resultados.slice(0, 6).map(d => d.id);
  if(ids.length){
    const razones = Object.fromEntries(r.resultados.slice(0, 6).map(d => [d.id,
      [d.min_auto_aprox ? `~${d.min_auto_aprox} min de ${ctx.ref.nombre}` : null,
       d.cerca?.escuela && d.cerca.escuela <= 800 ? `escuela a ${d.cerca.escuela} m` : null, d.amenidades.includes("alberca") ? "alberca" : null].filter(Boolean).join(" · ") || "Cumple lo que pediste"]));
    await ejecutar("mostrar_en_pantalla", {ids, razones, titulo:"Lo que encontré para ti"}, ctx);
    texto += `Encontré ${r.total} ${r.total === 1 ? "opción" : "opciones"}; te puse ${ids.length === r.total ? "todas" : "las mejores " + ids.length} en pantalla. Los precios son "desde" y pueden variar al cerrar.`;
  }else texto += "No encontré opciones con todo eso. Prueba quitando una condición, por ejemplo el precio o el tipo de crédito.";
  return texto + " (Modo demostración: con la IA activada te entiendo mucho mejor.)";
}
