/* GET /api/reporte?dias=30|90|365&d=<id>   (encabezado x-clave: REPORTE_CLAVE)
   Números agregados para enseñar a una desarrolladora. Nunca devuelve nombres ni teléfonos;
   las zonas de trabajo van redondeadas a ~1 km y solo si las comparten MIN_GRUPO personas. */
import {respuesta, error, sbTodo, claveValida, desarrollos} from "./_lib/comun.js";

export const MIN_GRUPO = 2;

const contar = lista => {
  const m = {};
  for(const k of lista) if(k !== "" && k != null) m[k] = (m[k] || 0) + 1;
  return Object.entries(m).map(([k, n]) => ({k, n})).sort((a, b) => b.n - a.n);
};
const fecha = f => f.toISOString().slice(0, 10);
function lunes(f){ const d = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate())); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d; }
const mediana = v => { if(!v.length) return null; const s = [...v].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const norm = t => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

export function agregar(solicitudes, eventos, desde, hasta, id){
  const sel = solicitudes.filter(s => !id || s.desarrollo === id);
  const ev = eventos.filter(e => !id || e.desarrollo === id);
  const cuenta = (tipo, k) => ev.filter(e => e.tipo === tipo && e.desarrollo === k).length;
  const ids = new Set([...sel.map(s => s.desarrollo), ...ev.filter(e => e.desarrollo).map(e => e.desarrollo)]);
  const lista = [...ids].filter(k => !id || k === id).map(k => ({id:k, vistas:cuenta("ver-ficha", k), clics:cuenta("clic-agendar", k),
    compartidos:cuenta("compartir-whatsapp", k) + cuenta("compartir", k), solicitudes:sel.filter(s => s.desarrollo === k).length}))
    .sort((a, b) => b.solicitudes - a.solicitudes || b.vistas - a.vistas);
  const semanas = [];
  for(let s = lunes(desde); s <= hasta; s = new Date(s.getTime() + 7 * 864e5)){
    const fin = new Date(s.getTime() + 7 * 864e5);
    semanas.push({inicio:fecha(s), n:sel.filter(x => { const t = new Date(x.creado); return t >= s && t < fin; }).length});
  }
  const todasZonas = contar(sel.filter(s => s.trabajo_lat != null).map(s => `${s.trabajo_lat},${s.trabajo_lng}`));
  const zonas = todasZonas.filter(z => z.n >= MIN_GRUPO).map(z => { const [lat, lng] = z.k.split(",").map(Number); return {lat, lng, n:z.n}; });
  const grupos = {};
  for(const s of sel) if(s.trabajo_texto){ const k = norm(s.trabajo_texto); (grupos[k] ||= {texto:s.trabajo_texto, n:0}).n++; }
  const suma = k => lista.reduce((a, d) => a + d[k], 0);
  const r = {
    ok:true, desde:fecha(desde), hasta:fecha(hasta), desarrollo:id || null, medicion:{ok:true, motivo:""}, minGrupo:MIN_GRUPO,
    totales:{vistas:suma("vistas"), clics:suma("clics"), solicitudes:sel.length, compartidos:suma("compartidos")},
    desarrollos:lista, semanas, pago:contar(sel.map(s => s.pago)), cuando:contar(sel.map(s => s.cuando)),
    estados:contar(sel.map(s => s.estado)),
    zonas, zonasOtras:todasZonas.filter(z => z.n < MIN_GRUPO).reduce((a, z) => a + z.n, 0),
    lugares:Object.values(grupos).filter(g => g.n >= MIN_GRUPO).sort((a, b) => b.n - a.n).slice(0, 10),
    conTrabajo:sel.filter(s => s.trabajo_lat != null || s.trabajo_texto).length,
    minutosMediana:mediana(sel.map(s => s.minutos).filter(m => m != null))
  };
  if(!id){ // solo en la vista interna: qué buscan las personas en todo el sitio
    const buckets = [[1e6, "Hasta $1 M"], [1.5e6, "Hasta $1.5 M"], [2e6, "Hasta $2 M"], [3e6, "Hasta $3 M"], [Infinity, "Más de $3 M"]];
    r.presupuestos = contar(eventos.filter(e => e.tipo === "presupuesto" && e.datos?.hasta).map(e => buckets.find(([t]) => e.datos.hasta <= t)[1]));
    r.busquedas = contar(eventos.filter(e => e.tipo === "busqueda" && e.datos?.texto).map(e => norm(e.datos.texto))).filter(b => b.n >= MIN_GRUPO).slice(0, 10).map(b => ({texto:b.k, n:b.n}));
  }
  return r;
}

export async function GET(request){
  const u = new URL(request.url);
  if(!claveValida(request.headers.get("x-clave") || u.searchParams.get("clave"))) return error(401, "La clave no es correcta.");
  const dias = [30, 90, 365].includes(Number(u.searchParams.get("dias"))) ? Number(u.searchParams.get("dias")) : 30;
  const id = desarrollos().some(d => d.id === u.searchParams.get("d")) ? u.searchParams.get("d") : "";
  const hasta = new Date(), desde = new Date(hasta.getTime() - dias * 864e5), iso = encodeURIComponent(desde.toISOString());
  try{
    const filtroId = id ? `&desarrollo=eq.${id}` : "";
    const [solicitudes, eventos] = await Promise.all([
      sbTodo(`solicitudes?select=creado,desarrollo,cuando,pago,estado,trabajo_texto,trabajo_lat,trabajo_lng,minutos&creado=gte.${iso}${filtroId}`),
      sbTodo(`eventos?select=tipo,desarrollo,datos&creado=gte.${iso}&tipo=in.(ver-ficha,clic-agendar,compartir-whatsapp,compartir${id ? "" : ",presupuesto,busqueda"})${filtroId}`)
    ]);
    return respuesta(200, agregar(solicitudes, eventos, desde, hasta, id));
  }catch(e){
    console.error("[reporte]", e.message);
    return error(502, "No se pudo leer la base de datos.");
  }
}
