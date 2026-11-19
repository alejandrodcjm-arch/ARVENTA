/* Datos de PRUEBA: los desarrollos reales + un esquema de pago ficticio en Valladolid (solo existe en las pruebas) */
import {readFileSync, writeFileSync, mkdtempSync} from "node:fs";
import os from "node:os";
import path from "node:path";
export const ESQUEMA_PRUEBA = {nombre:"Esquema de prueba 5-10-85", apartado:50000, enganchePct:5, diferidoPct:10, diferidoMesesMax:18,
  liquidacionPct:85, descuentoPct:0, creditos:["Infonavit", "Banco", "Contado"], confirmado:"2026-11-18", confirmadoPor:"Prueba automática", vigenciaDias:15};
export function datosDePrueba(){
  const lista = JSON.parse(readFileSync(new URL("../data/desarrollos.json", import.meta.url)));
  lista.find(d => d.id === "valladolid").esquemas = [ESQUEMA_PRUEBA];
  return lista;
}
export function escribirFixture(){
  const f = path.join(mkdtempSync(path.join(os.tmpdir(), "arventa-prueba-")), "desarrollos.json");
  writeFileSync(f, JSON.stringify(datosDePrueba()));
  return f;
}
