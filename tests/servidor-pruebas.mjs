/* Servidor para las pruebas de Playwright: sitio + /api en :3100 y Supabase de mentiras en :54399.
   Usa datos de prueba (un esquema de pago ficticio en Valladolid) tanto en /api como en /assets/datos.js. */
import http from "node:http";
import {crearMock} from "./mock-supabase.mjs";
import {escribirFixture, ESQUEMA_PRUEBA, ANUNCIOS_PRUEBA} from "./fixture.mjs";
import {preciosDe, financiamientoDe} from "../assets/corrida.mjs";
const LLAVE = "llave-e2e";
crearMock(LLAVE).servidor.listen(54399);
Object.assign(process.env, {SUPABASE_URL:"http://127.0.0.1:54399", SUPABASE_SERVICE_ROLE_KEY:LLAVE, IP_SALT:"e2e", REPORTE_CLAVE:"clave-e2e", DESARROLLOS_JSON:escribirFixture()});
const {crear} = await import("../scripts/servidor.mjs");
const manejar = crear().listeners("request")[0];
const {readFileSync} = await import("node:fs");
http.createServer((req, res) => {
  if(req.url.startsWith("/assets/datos.js")){
    res.writeHead(200, {"Content-Type":"text/javascript; charset=utf-8"});
    return res.end(readFileSync(new URL("../assets/datos.js", import.meta.url), "utf8") +
      `\nwindow.DESARROLLOS.find(d => d.id === "valladolid").esquemas = [${JSON.stringify(ESQUEMA_PRUEBA)}];\n` +
      `window.DESARROLLOS.push(...${JSON.stringify(ANUNCIOS_PRUEBA.map(d => ({...d, opcionesPrecio:preciosDe(d), opcionesFin:financiamientoDe(d)})))});\n`);
  }
  manejar(req, res);
}).listen(3100, () => console.log("pruebas en http://localhost:3100"));
