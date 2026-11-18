/* Servidor local: sirve el sitio y las funciones de /api igual que Vercel (sin instalar su CLI).
   Uso: node scripts/servidor.mjs [puerto]     (lee las variables de .env si existe)
   Abre http://localhost:3000 */
import http from "node:http";
import {readFileSync, existsSync, statSync} from "node:fs";
import {fileURLToPath, pathToFileURL} from "node:url";
import path from "node:path";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUERTO = Number(process.argv[2] || process.env.PORT || 3000);
// .env sencillo: CLAVE=valor
if(existsSync(path.join(RAIZ, ".env")))
  for(const l of readFileSync(path.join(RAIZ, ".env"), "utf8").split(/\r?\n/)){ const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if(m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, ""); }

const TIPOS = {".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".mjs":"text/javascript", ".css":"text/css; charset=utf-8",
  ".json":"application/json", ".png":"image/png", ".webp":"image/webp", ".jpg":"image/jpeg", ".svg":"image/svg+xml", ".xml":"application/xml", ".txt":"text/plain; charset=utf-8"};
const PRIVADO = /^\/(scripts|tests|supabase|docs|node_modules|\.git|\.github|\.env)/;

export function crear(){
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PUERTO}`);
    try{
      const api = url.pathname.match(/^\/api\/([a-z-]+)$/);
      if(api){
        const archivo = path.join(RAIZ, "api", api[1] + ".js");
        if(!existsSync(archivo)){ res.writeHead(404); return res.end(); }
        const mod = await import(pathToFileURL(archivo).href);
        const fn = mod[req.method];
        if(!fn){ res.writeHead(405); return res.end(); }
        const cuerpo = ["GET", "HEAD"].includes(req.method) ? undefined : await new Promise(ok => { const p = []; req.on("data", c => p.push(c)); req.on("end", () => ok(Buffer.concat(p))); });
        const r = await fn(new Request(url, {method:req.method, headers:{...req.headers, "x-forwarded-for":req.socket.remoteAddress}, body:cuerpo}));
        res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(Buffer.from(await r.arrayBuffer()));
      }
      let p = decodeURIComponent(url.pathname);
      if(PRIVADO.test(p)){ res.writeHead(404); return res.end("No encontrado"); }
      let f = path.join(RAIZ, p);
      if(existsSync(f) && statSync(f).isDirectory()) f = path.join(f, "index.html");
      if(!existsSync(f)){ res.writeHead(404, {"Content-Type":"text/html; charset=utf-8"}); return res.end(readFileSync(path.join(RAIZ, "404.html"))); }
      res.writeHead(200, {"Content-Type":TIPOS[path.extname(f)] || "application/octet-stream"}); res.end(readFileSync(f));
    }catch(e){ console.error(e); res.writeHead(500); res.end("Error"); }
  });
}
if(process.argv[1] === fileURLToPath(import.meta.url)) crear().listen(PUERTO, () => console.log(`ARVENTA en http://localhost:${PUERTO}`));
