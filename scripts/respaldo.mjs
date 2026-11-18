/* Exporta solicitudes y contactos de Supabase a CSV. Uso: node scripts/respaldo.mjs [carpeta]
   Necesita SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (en .env o en el entorno). */
import {mkdirSync, writeFileSync, readFileSync, existsSync} from "node:fs";
import path from "node:path";
if(existsSync(".env")) for(const l of readFileSync(".env", "utf8").split(/\r?\n/)){ const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if(m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const {sbTodo, supabaseListo} = await import("../api/_lib/comun.js");
if(!supabaseListo()){ console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }
const carpeta = process.argv[2] || "respaldos", hoy = new Date().toISOString().slice(0, 10);
mkdirSync(carpeta, {recursive:true});
const csv = filas => {
  if(!filas.length) return "";
  const cols = Object.keys(filas[0]), c = v => v == null ? "" : `"${String(typeof v === "object" ? JSON.stringify(v) : v).replace(/"/g, '""')}"`;
  return [cols.join(","), ...filas.map(f => cols.map(k => c(f[k])).join(","))].join("\n") + "\n";
};
for(const tabla of ["solicitudes", "contactos"]){
  const filas = await sbTodo(`${tabla}?select=*&order=creado.asc`);
  writeFileSync(path.join(carpeta, `${tabla}-${hoy}.csv`), "﻿" + csv(filas));
  console.log(`${tabla}: ${filas.length} filas`);
}
