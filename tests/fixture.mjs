/* Datos de PRUEBA: los desarrollos reales + un esquema de pago ficticio en Valladolid (solo existe en las pruebas) */
import {readFileSync, writeFileSync, mkdtempSync} from "node:fs";
import os from "node:os";
import path from "node:path";
export const ESQUEMA_PRUEBA = {nombre:"Esquema de prueba 5-10-85", apartado:50000, enganchePct:5, diferidoPct:10, diferidoMesesMax:18,
  liquidacionPct:85, descuentoPct:0, creditos:["Infonavit", "Banco", "Contado"], confirmado:"2026-11-18", confirmadoPor:"Prueba automática", vigenciaDias:15};
// Una casa usada de un particular y un departamento en renta de una inmobiliaria (ficticios; solo existen en las pruebas)
export const ANUNCIOS_PRUEBA = [
  {id:"prueba-casa-usada", operacion:"reventa", nombre:"Casa usada de prueba", tipo:"casa", desde:1350000, zona:"Fracc. de prueba, Durango",
    lat:24.06, lng:-104.62, aprox:true, recamaras:"3", m2:"160 m² de terreno", creditos:["Infonavit", "Banco", "Contado"], incluye:"Cocina integral y boiler",
    convenio:true, fotos:[], ventajas:[], verificado:"2026-11-18", anunciante:{tipo:"particular", verificado:"2026-11-18"},
    banos:"2", estacionamientos:"2", niveles:"2", mantenimiento:0, video:"https://www.youtube.com/watch?v=prueba", amenidades:["asador"],
    descripcion:"Casa de dos plantas con patio y cochera techada. Texto de prueba.",
    reventa:{construida:2012, escrituras:true, gravamen:"2026-11-10", alCorriente:true}},
  {id:"prueba-depa-renta", operacion:"renta", nombre:"Departamento en renta de prueba", tipo:"departamento", desde:8500, zona:"Zona de prueba, Durango",
    lat:24.03, lng:-104.66, aprox:true, recamaras:"2", m2:"75 m²", creditos:[], incluye:null, convenio:true, fotos:[], ventajas:["Estacionamiento techado"],
    verificado:"2026-11-18", anunciante:{tipo:"inmobiliaria", nombre:"Inmobiliaria de Prueba", verificado:"2026-11-18"},
    renta:{deposito:1, garantia:["Depósito", "Aval"], plazoMeses:12, mantenimiento:"Incluido", servicios:"Agua", amueblado:false, mascotas:true,
      requisitos:"Identificación y 3 recibos de nómina", disponible:"Inmediata"}}
];
export function datosDePrueba(){
  const lista = JSON.parse(readFileSync(new URL("../data/desarrollos.json", import.meta.url)));
  lista.find(d => d.id === "valladolid").esquemas = [ESQUEMA_PRUEBA];
  return [...lista, ...structuredClone(ANUNCIOS_PRUEBA)];
}
export function escribirFixture(){
  const f = path.join(mkdtempSync(path.join(os.tmpdir(), "arventa-prueba-")), "desarrollos.json");
  writeFileSync(f, JSON.stringify(datosDePrueba()));
  return f;
}
