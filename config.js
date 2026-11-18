/* ===== Configuración de ARVENTA (la usan todas las páginas) ===== */
window.ARVENTA = {
  // Número que recibe solicitudes por WhatsApp: lada de país (52) + 10 dígitos, sin espacios.
  WHATSAPP: "526184463867",

  // Dirección de la "aplicación web" de Google Apps Script que guarda las solicitudes en la hoja
  // y entrega el reporte. Termina en /exec. Cómo obtenerla: apps-script/LEEME.md
  // Vacía = las solicitudes solo se mandan por WhatsApp y no se guardan en la hoja.
  HOJA_URL: "",

  // Umami (medición de visitas sin cookies). El "Website ID" sale de cloud.umami.is →
  // Settings → Websites. Vacío = no se mide nada.
  UMAMI_ID: "",

  // Datos legales: salen en el pie de todas las páginas y en el aviso de privacidad.
  // Mientras estén vacíos, el sitio muestra "pendiente" / "en trámite".
  RAZON_SOCIAL: "",   // Ej. "Inmobiliaria Ejemplo, S.A. de C.V." o el nombre completo de la persona física
  DOMICILIO: "",      // Calle, número, colonia, código postal, Durango, Dgo.
  CORREO: "",         // Correo para dudas y derechos ARCO
  LICENCIA: "",       // Número de licencia o registro inmobiliario; vacío = "en trámite"
  VERSION_AVISO: "18 de noviembre de 2026" // cámbiala si modificas el aviso de privacidad
};

/* Medición: carga Umami solo si hay ID, respeta "No rastrear" del navegador y no usa cookies.
   Una página puede pedir no medirse con <script src="config.js" data-medir="no">. */
(function(){
  const yo = document.currentScript;
  if(!ARVENTA.UMAMI_ID || (yo && yo.dataset.medir === "no")) return;
  const s = document.createElement("script");
  s.defer = true;
  s.src = "https://cloud.umami.is/script.js";
  s.dataset.websiteId = ARVENTA.UMAMI_ID;
  s.dataset.doNotTrack = "true";
  document.head.appendChild(s);
})();

/* Pie legal y datos del responsable. Cualquier página puede poner:
     <footer data-pie></footer>                 → pie con razón social y licencia
     <span data-config="RAZON_SOCIAL"></span>   → el dato, o un aviso amarillo de "pendiente" */
window.pintarDatosLegales = function(){
  const c = ARVENTA, e = s => String(s).replace(/[&<>"]/g, x => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[x]));
  const pendiente = t => `<mark class="pendiente">${t}</mark>`;
  const textos = {
    RAZON_SOCIAL: c.RAZON_SOCIAL ? e(c.RAZON_SOCIAL) : "en trámite",
    RESPONSABLE: c.RAZON_SOCIAL ? e(c.RAZON_SOCIAL) : "ARVENTA (razón social en trámite)",
    DOMICILIO: c.DOMICILIO ? e(c.DOMICILIO) : pendiente("Domicilio pendiente"),
    CORREO: c.CORREO ? `<a href="mailto:${e(c.CORREO)}">${e(c.CORREO)}</a>` : pendiente("Correo pendiente"),
    LICENCIA: c.LICENCIA ? e(c.LICENCIA) : "en trámite",
    VERSION_AVISO: e(c.VERSION_AVISO)
  };
  document.querySelectorAll("[data-config]").forEach(el => { el.innerHTML = textos[el.dataset.config] ?? ""; });
  document.querySelectorAll("[data-pie]").forEach(el => {
    el.innerHTML = `<p>ARVENTA · Razón social: ${textos.RAZON_SOCIAL} · Licencia de asesor inmobiliario del Estado de Durango: ${textos.LICENCIA}</p>
      <p>Los precios y datos vienen de anuncios públicos y de las desarrolladoras; pueden cambiar sin aviso y se confirman en la visita.
      <a href="aviso-privacidad.html">Aviso de privacidad</a> · <a href="anuncia.html">Anuncia tu desarrollo</a></p>`;
  });
};
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", pintarDatosLegales);
else pintarDatosLegales();

// Registra un evento ("ver-desarrollo", "solicitar-visita"…). Nunca manda nombres, teléfonos ni sueldos.
window.medir = function(evento, datos){
  try{ if(window.umami) window.umami.track(evento, datos); }catch(e){}
};

// Folio corto y legible para cruzar la hoja con la conversación de WhatsApp. Ej. "V-7K3QHM"
window.nuevoFolio = function(prefijo){
  const letras = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I/L para que no se confundan
  const n = new Uint8Array(6);
  (window.crypto || {getRandomValues:a=>a.map(()=>Math.random()*256)}).getRandomValues(n);
  return prefijo + "-" + Array.from(n, x => letras[x % letras.length]).join("");
};

// Manda un registro a la hoja. Las solicitudes de visita usan sendBeacon para que lleguen
// aunque la página se vaya a WhatsApp en ese momento.
window.enviarAHoja = function(registro, {esperar=false}={}){
  if(!ARVENTA.HOJA_URL) return Promise.resolve({ok:false, error:"sin-hoja"});
  const cuerpo = JSON.stringify(registro);
  if(!esperar && navigator.sendBeacon){
    const ok = navigator.sendBeacon(ARVENTA.HOJA_URL, new Blob([cuerpo], {type:"text/plain;charset=utf-8"}));
    if(ok) return Promise.resolve({ok:true});
  }
  // text/plain evita la consulta previa CORS que Apps Script no contesta
  return fetch(ARVENTA.HOJA_URL, {method:"POST", body:cuerpo, headers:{"Content-Type":"text/plain;charset=utf-8"}})
    .then(r => r.json())
    .catch(() => fetch(ARVENTA.HOJA_URL, {method:"POST", mode:"no-cors", body:cuerpo, headers:{"Content-Type":"text/plain;charset=utf-8"}})
      .then(() => ({ok:true, sinConfirmar:true})));
};
