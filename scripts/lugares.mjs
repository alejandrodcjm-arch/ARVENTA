/* Descarga de OpenStreetMap (Overpass) escuelas, OXXOs, súper, farmacias, hospitales, parques y
   universidades de Durango y los guarda en data/lugares-osm.json. Lo corre GitHub Actions cada semana.
   Si Overpass falla, el archivo se queda como estaba y el sitio sigue funcionando.
   Uso: node scripts/lugares.mjs            (descarga)
        node scripts/lugares.mjs resp.json  (usa una respuesta de Overpass ya guardada) */
import {readFileSync, writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DESTINO = path.join(RAIZ, "data/lugares-osm.json");
const CAJA = {s:23.95, w:-104.77, n:24.10, e:-104.56};
const SERVIDORES = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function consulta(){
  const b = `${CAJA.s},${CAJA.w},${CAJA.n},${CAJA.e}`;
  return `[out:json][timeout:300];(
    nwr["amenity"~"^(school|kindergarten)$"](${b}); nwr["shop"]["brand"~"oxxo",i](${b}); nwr["shop"]["name"~"^oxxo",i](${b});
    nwr["shop"="supermarket"](${b}); nwr["amenity"="pharmacy"](${b}); nwr["amenity"~"^(hospital|clinic)$"](${b});
    nwr["leisure"="park"](${b}); nwr["amenity"="university"](${b}););out center tags;`;
}
export function categoria(t){
  if(/oxxo/i.test(t.brand || "") || /^oxxo/i.test(t.name || "")) return "oxxo";
  if(t.amenity === "school" || t.amenity === "kindergarten") return "escuela";
  if(t.shop === "supermarket") return "super";
  if(t.amenity === "pharmacy") return "farmacia";
  if(t.amenity === "hospital" || t.amenity === "clinic") return "salud";
  if(t.leisure === "park") return "parque";
  if(t.amenity === "university") return "uni";
  return null;
}
export function convertir(j){
  const r5 = n => Math.round(n * 1e5) / 1e5;
  const lista = j.elements.map(e => {
    const t = e.tags || {}, c = categoria(t), lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
    return c && lat != null ? [c, t.name || "", r5(lat), r5(lng)] : null;
  }).filter(Boolean);
  const f = new Date(j.osm3s?.timestamp_osm_base || Date.now());
  return {fecha:`datos de ${MESES[f.getUTCMonth()]} de ${f.getUTCFullYear()}`, lugares:lista};
}
async function descargar(){
  for(const url of SERVIDORES){
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6 * 60 * 1000);
    try{
      console.log(`Consultando ${url}…`);
      const r = await fetch(url, {method:"POST", signal:ctl.signal, body:"data=" + encodeURIComponent(consulta()),
        headers:{"Content-Type":"application/x-www-form-urlencoded", "User-Agent":"ARVENTA-lugares/1.0 (+https://arventa.mx)"}});
      if(r.ok) return await r.json();
      console.log(`  respondió ${r.status}`);
    }catch(e){ console.log(`  no respondió (${e.name === "AbortError" ? "tiempo agotado" : e.message})`); }
    finally{ clearTimeout(t); }
  }
  return null;
}

if(process.argv[1] === fileURLToPath(import.meta.url)){
  const j = process.argv[2] ? JSON.parse(readFileSync(process.argv[2], "utf8")) : await descargar();
  if(!j){ console.error("Overpass no contestó; data/lugares-osm.json se quedó como estaba."); process.exit(0); }
  const r = convertir(j);
  if(r.lugares.length < 100){ console.error(`Solo llegaron ${r.lugares.length} lugares; parece una respuesta incompleta. No se guardó.`); process.exit(1); }
  writeFileSync(DESTINO, JSON.stringify(r) + "\n");
  console.log(`Listo: ${r.lugares.length} lugares (${r.fecha}). Ahora corre: node scripts/construir.mjs`);
}
