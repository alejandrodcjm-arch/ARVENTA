/* Generador de PDF mínimo, sin librerías: texto (Helvetica y Helvetica-Bold, con acentos y ñ),
   líneas y rectángulos en hojas tamaño carta. Coordenadas en puntos desde la esquina superior izquierda. */
const ALTO = 792, ANCHO = 612;
// Anchos de Helvetica (1/1000 em) para ASCII 32–126; las letras con acento usan el de su letra base
const W = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,
  1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,
  333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const BASE = {"á":"a","é":"e","í":"i","ó":"o","ú":"u","ü":"u","ñ":"n","Á":"A","É":"E","Í":"I","Ó":"O","Ú":"U","Ñ":"N","¿":"?","¡":"!"};
// Caracteres fuera de Latin-1 que WinAnsi sí tiene
const WINANSI = {"“":0x93, "”":0x94, "‘":0x91, "’":0x92, "–":0x96, "—":0x97, "•":0x95, "…":0x85, "€":0x80};

export function anchoTexto(t, tam, negrita = false){
  let w = 0;
  for(const c of String(t)){
    const b = BASE[c] || c, k = b.charCodeAt(0);
    w += (k >= 32 && k <= 126 ? W[k - 32] : 556) * (negrita && !/[\d $,.:]/.test(b) ? 1.06 : 1);
  }
  return w * tam / 1000;
}
function cadena(t){
  let s = "";
  for(const c of String(t)){
    let k = WINANSI[c] ?? c.charCodeAt(0);
    if(k > 255) k = 63; // "?" para lo que no existe en la fuente
    const ch = String.fromCharCode(k);
    s += ch === "(" || ch === ")" || ch === "\\" ? "\\" + ch : ch;
  }
  return s;
}
const rgb = ([r, g, b]) => `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
export const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

export function crearPDF({titulo = "Documento", autor = "ARVENTA"} = {}){
  const paginas = []; let actual = null;
  const doc = {
    ANCHO, ALTO,
    pagina(){ actual = []; paginas.push(actual); return doc; },
    texto(x, y, t, {tam = 10, negrita = false, color = [0.11, 0.17, 0.23], alinear = "izq"} = {}){
      const w = anchoTexto(t, tam, negrita), xx = alinear === "der" ? x - w : alinear === "centro" ? x - w / 2 : x;
      actual.push(`BT /${negrita ? "F2" : "F1"} ${tam} Tf ${rgb(color)} rg ${xx.toFixed(2)} ${(ALTO - y).toFixed(2)} Td (${cadena(t)}) Tj ET`);
      return doc;
    },
    // Texto en varias líneas dentro de un ancho; devuelve la y donde terminó
    parrafo(x, y, t, ancho, opciones = {}){
      const tam = opciones.tam || 10, alto = opciones.interlineado || tam * 1.35;
      let linea = "";
      for(const palabra of String(t).split(/\s+/)){
        const prueba = linea ? linea + " " + palabra : palabra;
        if(anchoTexto(prueba, tam, opciones.negrita) > ancho && linea){ doc.texto(x, y, linea, opciones); y += alto; linea = palabra; }
        else linea = prueba;
      }
      if(linea){ doc.texto(x, y, linea, opciones); y += alto; }
      return y;
    },
    linea(x1, y1, x2, y2, {grosor = 0.6, color = [0.85, 0.88, 0.9]} = {}){
      actual.push(`${rgb(color)} RG ${grosor} w ${x1.toFixed(2)} ${(ALTO - y1).toFixed(2)} m ${x2.toFixed(2)} ${(ALTO - y2).toFixed(2)} l S`);
      return doc;
    },
    rect(x, y, w, h, color){ actual.push(`${rgb(color)} rg ${x.toFixed(2)} ${(ALTO - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`); return doc; },
    bytes(){
      const objs = [];
      const n = 4 + paginas.length * 2;
      objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
      objs[2] = `<< /Type /Pages /Count ${paginas.length} /Kids [${paginas.map((_, i) => `${5 + i * 2} 0 R`).join(" ")}] >>`;
      objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
      objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
      paginas.forEach((ops, i) => {
        const contenido = ops.join("\n");
        objs[5 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO} ${ALTO}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`;
        objs[6 + i * 2] = `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`;
      });
      objs[n + 1] = `<< /Title (${cadena(titulo)}) /Author (${cadena(autor)}) /Producer (ARVENTA) >>`;
      let s = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
      const offsets = [];
      for(let i = 1; i <= n + 1; i++){ offsets[i] = s.length; s += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
      const xref = s.length;
      s += `xref\n0 ${n + 2}\n0000000000 65535 f \n` + offsets.slice(1).map(o => String(o).padStart(10, "0") + " 00000 n \n").join("");
      s += `trailer\n<< /Size ${n + 2} /Root 1 0 R /Info ${n + 1} 0 R >>\nstartxref\n${xref}\n%%EOF`;
      return Uint8Array.from(s, c => c.charCodeAt(0) & 255);
    },
    descargar(nombre){
      const url = URL.createObjectURL(new Blob([doc.bytes()], {type:"application/pdf"}));
      const a = Object.assign(document.createElement("a"), {href:url, download:nombre});
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  };
  return doc;
}
