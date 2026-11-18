/* Crea una página por desarrollo para compartir por WhatsApp (y Facebook, Telegram, etc.).

   Uso:
     node generar-paginas.js https://tu-dominio.com/

   Para cada desarrollo de datos.js escribe:
     d/<id>.html     → la página que se comparte. Trae título, precio e imagen para la vista
                       previa y manda a la persona al mapa con ese desarrollo abierto.
     d/img/<id>.png  → la imagen de la vista previa (1200×630), dibujada con Chrome o Edge.

   WhatsApp no ejecuta JavaScript al armar la vista previa: solo lee las etiquetas og: del HTML.
   Por eso cada desarrollo necesita su propia página, y la imagen necesita la dirección completa
   del sitio (https://...). Vuelve a correr este script cada vez que cambies datos.js.

   Si no encuentra Chrome o Edge, define la variable CHROME con la ruta del navegador. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const {execFileSync} = require("child_process");
const {pathToFileURL} = require("url");
const {cargarTodo, revisar} = require("./revisar-datos.js");

// Dirección pública del sitio, con / al final. También se puede pasar como argumento.
const SITIO_POR_DEFECTO = "";

const RAIZ = __dirname;
const CARPETA = path.join(RAIZ, "d");
const IMAGENES = path.join(CARPETA, "img");
const TIPO = {casa:"casas", departamento:"departamentos", terreno:"terrenos"};

const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dinero = n => "$" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const conRecamaras = d => /^\d/.test(String(d.recamaras));
const conM2 = d => d.m2 && !/por confirmar/i.test(d.m2);

function titulo(d){ return `${d.nombre} · ${TIPO[d.tipo]} desde ${dinero(d.desde)}`; }
function descripcion(d){
  const partes = [d.hasta ? `De ${dinero(d.desde)} a ${dinero(d.hasta)}` : `Desde ${dinero(d.desde)}`];
  if(conRecamaras(d)) partes.push(`${d.recamaras} recámaras`);
  if(conM2(d)) partes.push(d.m2);
  if(d.zona && d.zona !== "Por confirmar") partes.push(d.zona);
  return partes.join(" · ") + ". Mira qué tiene cerca y cuánto tardas a tu trabajo.";
}

function pagina(d, sitio, conImagen){
  const url = sitio ? `${sitio}d/${d.id}.html` : "";
  const img = conImagen ? (sitio ? `${sitio}d/img/${d.id}.png` : `img/${d.id}.png`) : "";
  const t = esc(titulo(d)), des = esc(descripcion(d));
  return `<!DOCTYPE html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t} | ARVENTA</title>
<meta name="description" content="${des}">
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ARVENTA">
<meta property="og:locale" content="es_MX">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${des}">
${url ? `<meta property="og:url" content="${esc(url)}">\n<link rel="canonical" href="${esc(url)}">\n` : ""}${img ? `<meta property="og:image" content="${esc(img)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${t}">
<meta name="twitter:card" content="summary_large_image">
` : ""}<script>location.replace((location.protocol==="file:"?"../index.html":"../")+"#${d.id}");</script>
<style>body{font-family:system-ui,sans-serif;color:#1D2B3A;background:#FBFBF8;padding:24px;line-height:1.4}a{color:#2F6B5E;font-weight:700}</style>
</head>
<body>
<p><b>${esc(d.nombre)}</b><br>${des}</p>
<p><a href="../index.html#${d.id}">Ver en el mapa de ARVENTA</a></p>
</body>
</html>
`;
}

function tarjeta(d){
  const largo = d.nombre.length > 24;
  const datos = [TIPO[d.tipo][0].toUpperCase() + TIPO[d.tipo].slice(1)];
  if(conRecamaras(d)) datos.push(`${d.recamaras} recámaras`);
  if(conM2(d)) datos.push(d.m2.replace(/\s*\(.*\)$/, ""));
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Atkinson+Hyperlegible:wght@400;700&display=block" rel="stylesheet">
<style>
*{box-sizing:border-box}
html,body{margin:0;width:1200px;height:630px;overflow:hidden}
body{background:#FBFBF8;color:#1D2B3A;font-family:"Atkinson Hyperlegible",system-ui,sans-serif;border-top:20px solid #2F6B5E;
  display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 80px;position:relative}
.g{font-family:"Bricolage Grotesque",system-ui,sans-serif;font-weight:800}
.marca{position:absolute;top:40px;font-size:30px;letter-spacing:.16em;color:#2F6B5E}
.datos{font-size:32px;color:#55636F;margin:0 0 14px}
h1{font-size:${largo ? 62 : 80}px;line-height:1.02;letter-spacing:-.02em;margin:0 0 30px}
.precio{font-size:92px;line-height:1;color:#B5654F}
.precio small{font-size:40px;color:#55636F;font-family:"Atkinson Hyperlegible",system-ui,sans-serif;font-weight:400}
.hasta{font-size:30px;color:#55636F;margin-top:12px}
.pie{position:absolute;bottom:38px;font-size:28px;color:#1D2B3A;background:#FFF3D6;border-radius:999px;padding:10px 26px}
</style></head><body>
<div class="g marca">ARVENTA</div>
<p class="datos">${esc(datos.join(" · "))}</p>
<h1 class="g">${esc(d.nombre)}</h1>
<div class="g precio"><small>desde </small>${dinero(d.desde)}</div>
${d.hasta ? `<div class="hasta">hasta ${dinero(d.hasta)} según modelo</div>` : ""}
<div class="pie">Durango · Qué tiene cerca y cuánto tardas a tu trabajo</div>
</body></html>`;
}

function buscarNavegador(){
  if(process.env.CHROME) return process.env.CHROME;
  const local = process.env.LOCALAPPDATA || "";
  return [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    path.join(local, "Google/Chrome/Application/chrome.exe"),
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"
  ].find(p => fs.existsSync(p));
}

function tamañoPng(archivo){
  const b = fs.readFileSync(archivo);
  return b.toString("ascii", 1, 4) === "PNG" ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null;
}

function dibujar(navegador, d, temporal){
  const html = path.join(temporal, `${d.id}.html`);
  const png = path.join(IMAGENES, `${d.id}.png`);
  fs.writeFileSync(html, tarjeta(d));
  execFileSync(navegador, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
    "--force-device-scale-factor=1", "--window-size=1200,630", "--virtual-time-budget=5000",
    `--user-data-dir=${path.join(temporal, "perfil")}`, `--screenshot=${png}`, pathToFileURL(html).href
  ], {stdio:"ignore", timeout:60000});
  const t = fs.existsSync(png) && tamañoPng(png);
  if(!t) throw new Error("el navegador no generó la imagen");
  if(t[0] !== 1200 || t[1] !== 630) throw new Error(`la imagen salió de ${t[0]}×${t[1]} en vez de 1200×630`);
}

function main(){
  let sitio = (process.argv[2] || SITIO_POR_DEFECTO).trim();
  if(sitio && !/^https?:\/\//.test(sitio)){ console.error(`"${sitio}" no parece una dirección. Ejemplo: node generar-paginas.js https://www.arventa.mx/`); process.exit(1); }
  if(sitio && !sitio.endsWith("/")) sitio += "/";

  const {lista, preciosVerificados} = cargarTodo();
  const {errores} = revisar(lista, {preciosVerificados});
  if(errores.length){
    console.error("datos.js tiene errores; corre `node revisar-datos.js` para verlos. No se generó nada.");
    process.exit(1);
  }

  fs.mkdirSync(IMAGENES, {recursive:true});
  const navegador = buscarNavegador();
  const temporal = fs.mkdtempSync(path.join(os.tmpdir(), "arventa-"));
  let conImagen = 0, sinImagen = [];
  try{
    for(const d of lista){
      let ok = false;
      if(navegador){
        try{ dibujar(navegador, d, temporal); ok = true; conImagen++; }
        catch(e){ sinImagen.push(`${d.id} (${e.message})`); }
      }
      // si la imagen falló pero ya existía una de antes, se sigue usando
      if(!ok && fs.existsSync(path.join(IMAGENES, `${d.id}.png`))) ok = true;
      fs.writeFileSync(path.join(CARPETA, `${d.id}.html`), pagina(d, sitio, ok));
      process.stdout.write(".");
    }
  }finally{
    fs.rmSync(temporal, {recursive:true, force:true});
  }
  console.log("");

  // borra páginas e imágenes de desarrollos que ya no están en datos.js
  const ids = new Set(lista.map(d => d.id));
  const borrados = [];
  for(const [dir, ext] of [[CARPETA, ".html"], [IMAGENES, ".png"]])
    for(const f of fs.readdirSync(dir))
      if(f.endsWith(ext) && !ids.has(f.slice(0, -ext.length))){ fs.rmSync(path.join(dir, f)); borrados.push(f); }

  console.log(`Listo: ${lista.length} páginas en d/ y ${conImagen} imágenes en d/img/.`);
  if(borrados.length) console.log(`Borré ${borrados.length} archivos de desarrollos que ya no existen: ${borrados.join(", ")}`);
  if(!navegador) console.log("! No encontré Chrome ni Edge, así que no dibujé imágenes. Define CHROME con la ruta del navegador.");
  if(sinImagen.length) console.log("! Sin imagen nueva: " + sinImagen.join("; "));
  if(!sitio) console.log("! Falta la dirección del sitio. Las páginas funcionan, pero WhatsApp no mostrará la imagen\n  hasta que corras: node generar-paginas.js https://tu-dominio.com/");
}

main();
