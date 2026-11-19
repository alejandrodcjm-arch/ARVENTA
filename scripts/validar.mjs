/* Valida data/desarrollos.json. Si hay errores, termina con código 1 y el despliegue se detiene
   (lo corre GitHub Actions en cada cambio). Uso: node scripts/validar.mjs */
import {readFileSync, existsSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const TIPOS = ["casa", "departamento", "terreno"];
export const CREDITOS = ["Infonavit", "Fovissste", "Banco", "Cofinavit", "Contado"];
export const ENTREGAS = ["Preventa", "Entrega inmediata"];
// nueva: desarrollos (por omisión) · reventa: casa usada de un particular o inmobiliaria · renta
export const OPERACIONES = ["nueva", "reventa", "renta"];
export const GARANTIAS = ["Depósito", "Aval", "Póliza jurídica"];
export const AMENIDADES = ["alberca", "vigilancia", "gimnasio", "verdes", "juegos", "canchas", "casaclub", "asador", "salon", "roof", "elevador"];
export const DIAS_VIGENCIA = 60; // pasado esto, la ficha dice "precio por confirmar"
const CAJA = {s:23.85, w:-104.85, n:24.20, e:-104.45};

const texto = v => typeof v === "string" && v.trim() !== "";
const esNumero = v => typeof v === "number" && Number.isFinite(v);
export function diasDesde(fecha, hoy = new Date()){
  const f = new Date(fecha + "T12:00:00");
  return Math.floor((hoy - f) / 864e5);
}

export function cargar(){ return JSON.parse(readFileSync(path.join(RAIZ, "data/desarrollos.json"), "utf8")); }

export function validar(lista, {hoy = new Date(), raiz = RAIZ} = {}){
  const errores = [], avisos = [];
  if(!Array.isArray(lista)) return {errores:["data/desarrollos.json debe ser una lista [ … ]."], avisos};
  const vistos = new Map();
  const pend = {creditos:[], entrega:[], incluye:[], convenio:[], ubicacion:[], vencidos:[]};
  lista.forEach((d, i) => {
    const quien = `#${i + 1} ${texto(d?.id) ? d.id : "(sin id)"}`;
    const error = m => errores.push(`${quien}: ${m}`);
    if(!d || typeof d !== "object"){ error("no es un objeto { … }."); return; }
    if(!texto(d.id) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.id)) error("id vacío o inválido (solo minúsculas sin acento, números y guiones; es parte de la dirección).");
    else if(vistos.has(d.id)) error(`id repetido; ya lo usa el #${vistos.get(d.id)}.`);
    else vistos.set(d.id, i + 1);
    if(!texto(d.nombre)) error("falta el nombre.");
    if(!TIPOS.includes(d.tipo)) error(`tipo ${JSON.stringify(d.tipo)} inválido; usa ${TIPOS.join(", ")}.`);
    if(!esNumero(d.desde) || d.desde <= 0) error(`"desde" debe ser un número mayor que cero (está como ${JSON.stringify(d.desde)}).`);
    if(d.hasta != null && (!esNumero(d.hasta) || d.hasta < d.desde)) error(`"hasta" debe ser un número mayor o igual que "desde".`);
    if(!texto(d.zona)) error("falta la zona.");
    const op = d.operacion ?? "nueva", nueva = op === "nueva";
    if(!OPERACIONES.includes(op)) error(`operacion ${JSON.stringify(d.operacion)} inválida; usa ${OPERACIONES.join(", ")}.`);
    // Usadas y rentas: la ficha dice quién lo anuncia, y ARVENTA confirmó en persona que puede anunciarlo
    if(!nueva){
      const a = d.anunciante;
      if(!a || !["particular", "inmobiliaria"].includes(a.tipo)) error('falta "anunciante": {"tipo":"particular" o "inmobiliaria", "nombre" (si es inmobiliaria), "verificado":"AAAA-MM-DD"}.');
      else{
        if(a.tipo === "inmobiliaria" && !texto(a.nombre)) error("anunciante.nombre: el nombre de la inmobiliaria.");
        if(!/^\d{4}-\d{2}-\d{2}$/.test(a.verificado || "")) error("anunciante.verificado: fecha en que ARVENTA confirmó en persona que es el dueño (escrituras e identificación) o que la inmobiliaria lo tiene autorizado. No se guardan copias.");
        if(a.tipo === "particular" && d.aprox === false) avisos.push(`${quien}: publica la ubicación exacta de la casa de un particular; confirma que el dueño lo autorizó.`);
      }
      if(d.hasta != null) error('"hasta" no aplica: un inmueble usado o en renta tiene un solo precio.');
      for(const k of ["esquemas", "precios"]) if(d[k] !== undefined) error(`"${k}" solo aplica a vivienda nueva.`);
    }
    if(op === "renta"){
      if(Array.isArray(d.creditos) && d.creditos.length) error("una renta no lleva créditos; deja creditos: [].");
      if(d.financiamiento !== undefined) error('"financiamiento" no aplica a una renta.');
      if(esNumero(d.desde) && d.desde > 200000) error(`en renta, "desde" es la renta mensual; ${d.desde} parece precio de venta.`);
      const r = d.renta ?? {};
      if(typeof r !== "object" || Array.isArray(r)) error('"renta" debe ser un objeto { … }.');
      else{
        if(r.deposito != null && !(esNumero(r.deposito) && r.deposito >= 0 && r.deposito <= 6)) error("renta.deposito: meses de renta, de 0 a 6.");
        if(r.garantia != null && (!Array.isArray(r.garantia) || r.garantia.some(g => !GARANTIAS.includes(g)))) error(`renta.garantia: lista con ${GARANTIAS.join(", ")}.`);
        if(r.plazoMeses != null && !(Number.isInteger(r.plazoMeses) && r.plazoMeses >= 1 && r.plazoMeses <= 60)) error("renta.plazoMeses: meses enteros, de 1 a 60.");
        if(r.mantenimiento != null && !texto(r.mantenimiento) && !(esNumero(r.mantenimiento) && r.mantenimiento >= 0)) error('renta.mantenimiento: "Incluido", un monto al mes o null.');
        for(const k of ["amueblado", "mascotas"]) if(r[k] != null && typeof r[k] !== "boolean") error(`renta.${k}: true, false o null.`);
        for(const k of ["servicios", "requisitos", "disponible"]) if(r[k] != null && !texto(r[k])) error(`renta.${k}: texto o null.`);
      }
      if(/^\d{4}-\d{2}-\d{2}$/.test(d.verificado || "") && diasDesde(d.verificado, hoy) > 30) avisos.push(`${quien}: renta verificada hace más de 30 días; confirma que sigue disponible o quítala.`);
    }
    if(op === "reventa"){
      if(esNumero(d.desde) && d.desde < 100000) error(`"desde" (${d.desde}) parece renta mensual; en reventa es el precio de venta.`);
      const v = d.reventa ?? {};
      if(v.construida != null && !(Number.isInteger(v.construida) && v.construida > 1900 && v.construida <= hoy.getFullYear() + 1)) error("reventa.construida: año de construcción.");
      for(const k of ["escrituras", "alCorriente"]) if(v[k] != null && typeof v[k] !== "boolean") error(`reventa.${k}: true, false o null.`);
      if(v.gravamen != null && !/^\d{4}-\d{2}-\d{2}$/.test(v.gravamen)) error("reventa.gravamen: fecha del certificado de libertad de gravamen, AAAA-MM-DD.");
      else if(v.gravamen && diasDesde(v.gravamen, hoy) > 30) avisos.push(`${quien}: el certificado de libertad de gravamen tiene más de 30 días; la ficha pide uno nuevo.`);
    }
    // fuentes y verificación
    // Usadas y rentas pueden no tener anuncio en otro sitio: la fuente es quien lo anuncia (anunciante.verificado)
    if(!nueva && (d.fuentes == null || (Array.isArray(d.fuentes) && !d.fuentes.length))){}
    else if(!Array.isArray(d.fuentes) || !d.fuentes.length) error("necesita al menos una fuente [nombre, url].");
    else d.fuentes.forEach((f, j) => { if(!Array.isArray(f) || !texto(f[0]) || !/^https?:\/\/\S+$/.test(f[1] || "")) error(`la fuente ${j + 1} debe ser ["Nombre", "https://…"].`); });
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d.verificado || "") || isNaN(new Date(d.verificado))) error(`falta "verificado" con la fecha en que se confirmó el precio, como "2026-11-18".`);
    else{
      const dias = diasDesde(d.verificado, hoy);
      if(dias < 0) error(`"verificado" (${d.verificado}) está en el futuro.`);
      else if(dias > DIAS_VIGENCIA) pend.vencidos.push(`${d.id} (${dias} días)`);
    }
    // Esquemas de pago (corrida financiera): solo los que la desarrolladora confirmó por escrito
    if(d.esquemas !== undefined){
      if(!Array.isArray(d.esquemas)) error("esquemas debe ser una lista.");
      else d.esquemas.forEach((e, j) => {
        const q = `esquema ${j + 1}${texto(e?.nombre) ? ` "${e.nombre}"` : ""}`;
        const pct = k => esNumero(e?.[k]) && e[k] >= 0 && e[k] <= 100;
        if(!texto(e?.nombre)) error(`${q}: falta el nombre.`);
        for(const k of ["enganchePct", "diferidoPct", "liquidacionPct"]) if(!pct(k)) error(`${q}: ${k} debe ser un porcentaje de 0 a 100.`);
        if(pct("enganchePct") && pct("diferidoPct") && pct("liquidacionPct") && Math.abs(e.enganchePct + e.diferidoPct + e.liquidacionPct - 100) > 0.01)
          error(`${q}: enganche + diferido + liquidación deben sumar 100% (suman ${e.enganchePct + e.diferidoPct + e.liquidacionPct}%).`);
        if(e.diferidoPct > 0 && !(Number.isInteger(e.diferidoMesesMax) && e.diferidoMesesMax >= 1 && e.diferidoMesesMax <= 60)) error(`${q}: diferidoMesesMax debe ser de 1 a 60.`);
        if(e.apartado != null && !(esNumero(e.apartado) && e.apartado >= 0)) error(`${q}: apartado debe ser un número.`);
        if(e.descuentoPct != null && !(esNumero(e.descuentoPct) && e.descuentoPct >= 0 && e.descuentoPct < 50)) error(`${q}: descuentoPct inválido.`);
        if(e.creditos != null && (!Array.isArray(e.creditos) || e.creditos.some(c => !CREDITOS.includes(c)))) error(`${q}: créditos inválidos.`);
        if(!/^\d{4}-\d{2}-\d{2}$/.test(e?.confirmado || "") || !texto(e?.confirmadoPor)) error(`${q}: falta "confirmado" (fecha) y "confirmadoPor" (quién lo mandó y por dónde). Sin confirmación no se publica: sería publicidad engañosa.`);
      });
    }
    if(d.precios !== undefined){
      if(!Array.isArray(d.precios) || !d.precios.length) error("precios debe ser una lista de {modelo, precio}.");
      else{
        d.precios.forEach((p, j) => { if(!texto(p?.modelo) || !esNumero(p?.precio)) error(`precio ${j + 1}: necesita "modelo" (texto) y "precio" (número).`); });
        const vals = d.precios.map(p => p.precio).filter(esNumero);
        if(vals.length && Math.min(...vals) !== d.desde) error(`"desde" (${d.desde}) debe ser el precio más bajo de "precios" (${Math.min(...vals)}).`);
        if(vals.length && d.hasta != null && Math.max(...vals) !== d.hasta) error(`"hasta" (${d.hasta}) debe ser el precio más alto de "precios" (${Math.max(...vals)}).`);
      }
    }
    if(d.financiamiento !== undefined){
      const f = d.financiamiento || {};
      if(f.tasas != null && (!Array.isArray(f.tasas) || f.tasas.some(t => !texto(t?.nombre) || !esNumero(t?.tasa) || t.tasa < 1 || t.tasa > 30))) error('financiamiento.tasas: lista de {nombre, tasa} con tasa de 1 a 30.');
      if(f.enganches != null && (!Array.isArray(f.enganches) || f.enganches.some(x => !Number.isInteger(x) || x < 0 || x > 90))) error("financiamiento.enganches: porcentajes enteros de 0 a 90.");
      if(f.plazos != null && (!Array.isArray(f.plazos) || f.plazos.some(x => !Number.isInteger(x) || x < 1 || x > 30))) error("financiamiento.plazos: años enteros de 1 a 30.");
      if(!/^\d{4}-\d{2}-\d{2}$/.test(f.confirmado || "") || !texto(f.confirmadoPor)) error('financiamiento: falta "confirmado" (fecha) y "confirmadoPor". Solo se publican opciones que dio el proyecto.');
    }
    // Lo que piden los portales (opcional; lo que falte sale "Por confirmar")
    const textoONum = x => texto(x) || esNumero(x);
    for(const k of ["banos", "estacionamientos", "niveles", "terreno"]) if(d[k] != null && !textoONum(d[k])) error(`${k}: texto o número (por ejemplo "2" o "1.5 a 2.5").`);
    if(d.mantenimiento != null){
      if(op === "renta") error('en renta, el mantenimiento va en "renta.mantenimiento".');
      else if(!(esNumero(d.mantenimiento) && d.mantenimiento >= 0)) error("mantenimiento: cuota mensual en pesos (0 si no hay).");
    }
    if(d.descripcion != null && (!texto(d.descripcion) || d.descripcion.length > 800)) error("descripcion: texto de hasta 800 letras.");
    for(const k of ["video", "recorrido"]) if(d[k] != null && !/^https:\/\/\S+$/.test(d[k])) error(`${k}: enlace que empiece con https://`);
    if(d.amenidades != null && (!Array.isArray(d.amenidades) || d.amenidades.some(a => !AMENIDADES.includes(a)))) error(`amenidades: lista con ${AMENIDADES.join(", ")}.`);
    if(Array.isArray(d.precios)) d.precios.forEach((p, j) => { for(const k of ["recamaras", "banos", "m2", "terreno"]) if(p?.[k] != null && !textoONum(p[k])) error(`precio ${j + 1}: ${k} debe ser texto o número.`); });
    if(d.beneficioArventa != null && !texto(d.beneficioArventa)) error("beneficioArventa debe ser texto (lo que acordaste con la desarrolladora) o no ir.");

    // ubicación
    const sinUb = d.lat == null && d.lng == null;
    if(sinUb) pend.ubicacion.push(d.id);
    else if(!esNumero(d.lat) || !esNumero(d.lng)) error("lat y lng deben ser números, o los dos null.");
    else if(d.lat < CAJA.s || d.lat > CAJA.n || d.lng < CAJA.w || d.lng > CAJA.e) error(`la ubicación ${d.lat}, ${d.lng} queda fuera de Durango (¿lat y lng al revés?).`);
    if(typeof d.aprox !== "boolean") error("aprox debe ser true o false.");
    // NOM-247: solo datos confirmados
    if(!Array.isArray(d.creditos)) error('creditos debe ser una lista, [] si no está confirmado.');
    else{ d.creditos.filter(c => !CREDITOS.includes(c)).forEach(c => error(`crédito ${JSON.stringify(c)} inválido; usa ${CREDITOS.join(", ")}.`)); if(!d.creditos.length && op !== "renta") pend.creditos.push(d.id); }
    if(!nueva){ if(d.entrega != null) error('"entrega" (preventa o inmediata) solo aplica a vivienda nueva; quítalo.'); }
    else if(!("entrega" in d)) error('falta "entrega" ("Preventa", "Entrega inmediata" o null).');
    else if(d.entrega === null) pend.entrega.push(d.id);
    else if(!ENTREGAS.includes(d.entrega)) error(`entrega ${JSON.stringify(d.entrega)} inválida.`);
    if(d.incluye == null) pend.incluye.push(d.id); else if(!texto(d.incluye)) error("incluye debe ser texto o null.");
    if(typeof d.convenio !== "boolean") error("convenio debe ser true o false.");
    else if(!d.convenio) pend.convenio.push(d.id);
    // fotos: solo con permiso por escrito guardado
    if(!Array.isArray(d.fotos)) error("fotos debe ser una lista ([] si no hay).");
    else if(d.fotos.length){
      if(!texto(d.permisoFotos)) error('tiene fotos pero falta "permisoFotos": de quién y cuándo se recibió el permiso por escrito.');
      d.fotos.forEach(f => {
        const archivo = typeof f === "string" ? f : f?.archivo;
        if(!texto(archivo) || !existsSync(path.join(raiz, archivo))) error(`la foto ${JSON.stringify(archivo)} no existe.`);
        else if(!/\.webp$/i.test(archivo)) avisos.push(`${quien}: ${archivo} no es WebP; conviértela para que cargue rápido.`);
      });
    }
  });
  const grupo = (l, t) => { if(l.length) avisos.push(`${t} (${l.length}): ${l.join(", ")}.`); };
  grupo(pend.vencidos, `Precio verificado hace más de ${DIAS_VIGENCIA} días; la ficha dice "precio por confirmar"`);
  grupo(pend.ubicacion, "Sin ubicación (no salen en el mapa)");
  grupo(pend.creditos, "Créditos por confirmar");
  grupo(pend.entrega, "Entrega por confirmar");
  grupo(pend.incluye, "\"Qué incluye\" por confirmar");
  grupo(pend.convenio, "No son anunciantes (la ficha dice: Información pública de anuncios)");
  return {errores, avisos};
}

if(process.argv[1] === fileURLToPath(import.meta.url)){
  let lista;
  try{ lista = cargar(); }catch(e){ console.error("data/desarrollos.json no es JSON válido:\n  " + e.message); process.exit(1); }
  const {errores, avisos} = validar(lista);
  console.log(`Revisé ${lista.length} desarrollos.\n`);
  if(errores.length){ console.log(`✗ ${errores.length} errores:`); errores.forEach(e => console.log("  - " + e)); console.log(""); }
  if(avisos.length){ console.log(`! ${avisos.length} avisos:`); avisos.forEach(a => console.log("  - " + a)); console.log(""); }
  console.log(errores.length ? "Corrige los errores: no se puede publicar." : "✓ Datos válidos.");
  process.exit(errores.length ? 1 : 0);
}
