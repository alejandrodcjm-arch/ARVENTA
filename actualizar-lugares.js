/* Descarga de OpenStreetMap (vía Overpass) las escuelas, OXXOs, supermercados, farmacias,
   hospitales, parques y universidades de Durango y los guarda en lugares.js.

   Uso (una vez al mes basta):
     node actualizar-lugares.js
     node actualizar-lugares.js respuesta.json   ← usa una respuesta de Overpass ya descargada

   Overpass a veces tarda varios minutos en contestar. Por eso el sitio ya no lo consulta en
   cada visita: usa lugares.js, que carga al instante. Si falla la descarga, lugares.js no se toca. */
const fs = require("fs");
const path = require("path");

const CAJA = {s:23.95, w:-104.77, n:24.10, e:-104.56}; // la misma área que app.js
const SERVIDORES = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const DESTINO = path.join(__dirname, "lugares.js");
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function consulta(){
  const b = `${CAJA.s},${CAJA.w},${CAJA.n},${CAJA.e}`;
  return `[out:json][timeout:300];(
    nwr["amenity"~"^(school|kindergarten)$"](${b});
    nwr["shop"]["brand"~"oxxo",i](${b});
    nwr["shop"]["name"~"^oxxo",i](${b});
    nwr["shop"="supermarket"](${b});
    nwr["amenity"="pharmacy"](${b});
    nwr["amenity"~"^(hospital|clinic)$"](${b});
    nwr["leisure"="park"](${b});
    nwr["amenity"="university"](${b});
  );out center tags;`;
}
function categoria(t){
  if(/oxxo/i.test(t.brand||"") || /^oxxo/i.test(t.name||"")) return "oxxo";
  if(t.amenity==="school" || t.amenity==="kindergarten") return "escuela";
  if(t.shop==="supermarket") return "super";
  if(t.amenity==="pharmacy") return "farmacia";
  if(t.amenity==="hospital" || t.amenity==="clinic") return "salud";
  if(t.leisure==="park") return "parque";
  if(t.amenity==="university") return "uni";
  return null;
}
// Respuesta de Overpass → [categoría, nombre, lat, lng] con 5 decimales (≈1 m)
function convertir(j){
  const r5 = n => Math.round(n*1e5)/1e5;
  return j.elements.map(e=>{
    const t = e.tags||{}, c = categoria(t);
    const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
    if(!c || lat==null) return null;
    return [c, t.name||"", r5(lat), r5(lng)];
  }).filter(Boolean);
}
function fechaDe(j){
  const f = new Date(j.osm3s?.timestamp_osm_base || Date.now());
  return `datos de ${MESES[f.getUTCMonth()]} de ${f.getUTCFullYear()}`;
}
function guardar(j){
  const datos = convertir(j);
  if(!datos.length) throw new Error("la respuesta no trae ningún lugar");
  const texto = `/* Generado por actualizar-lugares.js con datos de OpenStreetMap. No se edita a mano. */\n`+
    `window.LUGARES_OSM = {fecha:${JSON.stringify(fechaDe(j))}, datos:[\n`+
    datos.map(d=>JSON.stringify(d)).join(",\n")+`\n]};\n`;
  fs.writeFileSync(DESTINO, texto);
  const porCat = {};
  for(const d of datos) porCat[d[0]] = (porCat[d[0]]||0)+1;
  console.log(`Listo: ${datos.length} lugares en lugares.js (${fechaDe(j)}).`);
  console.log(Object.entries(porCat).map(([k,v])=>`  ${k}: ${v}`).join("\n"));
}

async function descargar(){
  for(const url of SERVIDORES){
    console.log(`Consultando ${url} (puede tardar unos minutos)…`);
    const ctl = new AbortController(), t = setTimeout(()=>ctl.abort(), 6*60*1000);
    try{
      const r = await fetch(url, {
        method:"POST", signal:ctl.signal,
        headers:{"Content-Type":"application/x-www-form-urlencoded", "User-Agent":"ARVENTA-actualizar-lugares/1.0 (Node.js)"},
        body:"data="+encodeURIComponent(consulta())
      });
      if(!r.ok){ console.log(`  respondió ${r.status}, pruebo el siguiente.`); continue; }
      return await r.json();
    }catch(e){
      console.log(`  no respondió (${e.name==="AbortError"?"tiempo agotado":e.message}), pruebo el siguiente.`);
    }finally{ clearTimeout(t); }
  }
  return null;
}

if(require.main === module){
  (async()=>{
    try{
      const archivo = process.argv[2];
      const j = archivo ? JSON.parse(fs.readFileSync(archivo, "utf8")) : await descargar();
      if(!j){ console.error("Ningún servidor de Overpass contestó (suelen saturarse). lugares.js se quedó como estaba; intenta más tarde."); process.exit(1); }
      guardar(j);
    }catch(e){
      console.error("No se pudo actualizar lugares.js: "+e.message);
      process.exit(1);
    }
  })();
}
module.exports = {convertir, categoria};
