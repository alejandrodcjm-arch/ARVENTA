/* Servidor para las pruebas de Playwright: sitio + /api en :3100 y Supabase de mentiras en :54399 */
import {crearMock} from "./mock-supabase.mjs";
const LLAVE = "llave-e2e";
const mock = crearMock(LLAVE);
mock.servidor.listen(54399);
Object.assign(process.env, {SUPABASE_URL:"http://127.0.0.1:54399", SUPABASE_SERVICE_ROLE_KEY:LLAVE, IP_SALT:"e2e", REPORTE_CLAVE:"clave-e2e"});
const {crear} = await import("../scripts/servidor.mjs");
crear().listen(3100, () => console.log("pruebas en http://localhost:3100"));
