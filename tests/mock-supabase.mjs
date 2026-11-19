/* Imitación mínima de la API REST de Supabase (PostgREST) para las pruebas: tablas en memoria,
   folio único, filtros eq/gte/gt/lt/is/in, PATCH y paginación con Range. */
import http from "node:http";

export function crearMock(llave){
  const tablas = {solicitudes:[], eventos:[], contactos:[], cotizaciones:[], desarrolladoras:[], reclamos:[]};
  let id = 1;
  const filtrar = (filas, params) => {
    let r = filas;
    for(const [col, cond] of params){
      if(["select", "order", "limit", "offset"].includes(col)) continue;
      const [op, ...resto] = cond.split("."), val = resto.join(".");
      r = r.filter(f => {
        const v = f[col];
        switch(op){
          case "eq": return String(v) === val;
          case "neq": return String(v) !== val;
          case "gte": return v >= val;
          case "gt": return v > val;
          case "lt": return v < val;
          case "is": return val === "null" ? v == null : String(v) === val;
          case "in": return val.replace(/^\(|\)$/g, "").split(",").includes(String(v));
          case "cs": return Array.isArray(v) && val.replace(/^\{|\}$/g, "").split(",").every(x => v.includes(x));
          default: return true;
        }
      });
    }
    return r;
  };
  const servidor = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    if(u.pathname === "/__datos"){ res.writeHead(200, {"Content-Type":"application/json", "Access-Control-Allow-Origin":"*"}); return res.end(JSON.stringify(tablas)); }
    if(u.pathname === "/__reset"){ for(const k in tablas) tablas[k] = []; res.writeHead(204); return res.end(); }
    if(req.headers.apikey !== llave){ res.writeHead(401); return res.end(JSON.stringify({message:"sin llave"})); }
    const tabla = u.pathname.replace("/rest/v1/", "");
    if(!tablas[tabla]){ res.writeHead(404); return res.end(); }
    let cuerpo = ""; req.on("data", c => cuerpo += c); req.on("end", () => {
      const params = [...u.searchParams];
      if(req.method === "POST"){
        const filas = [].concat(JSON.parse(cuerpo));
        for(const f of filas){
          if((f.folio && tabla !== "cotizaciones" && tabla !== "reclamos" && tablas[tabla].some(x => x.folio === f.folio)) || (f.codigo && tablas[tabla].some(x => x.codigo === f.codigo))){ res.writeHead(409, {"Content-Type":"application/json"}); return res.end(JSON.stringify({code:"23505", message:"duplicate key"})); }
          tablas[tabla].push({id:id++, creado:new Date().toISOString(), ...(tabla === "solicitudes" ? {aviso_enviado:false, estado:"nueva"} : tabla === "reclamos" ? {estado:"pendiente"} : {}), ...f});
        }
        res.writeHead(201); return res.end();
      }
      if(req.method === "PATCH"){
        for(const f of filtrar(tablas[tabla], params)) Object.assign(f, JSON.parse(cuerpo));
        res.writeHead(204); return res.end();
      }
      let filas = filtrar(tablas[tabla], params);
      const sel = u.searchParams.get("select");
      if(sel && sel !== "*") filas = filas.map(f => Object.fromEntries(sel.split(",").map(c => [c, f[c] ?? null])));
      const rango = (req.headers.range || "").match(/(\d+)-(\d+)/);
      if(rango) filas = filas.slice(+rango[1], +rango[2] + 1);
      res.writeHead(200, {"Content-Type":"application/json"}); res.end(JSON.stringify(filas));
    });
  });
  return {servidor, tablas};
}
