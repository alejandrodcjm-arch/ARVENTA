/* ===== Configuración pública de ARVENTA (la usan todas las páginas) =====
   Aquí no va ninguna llave secreta: las de Supabase, avisos y reporte viven en las
   variables de entorno de Vercel (ver .env.example). */
window.ARVENTA = {
  SITIO: "https://arventa.mx",
  // WhatsApp que recibe a los clientes: lada 52 + 10 dígitos, sin espacios
  WHATSAPP: "526184463867",
  // Mapa. Para producción usa una llave propia (docs/REQUISITOS.md §5), por ejemplo MapTiler:
  //   url: "https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=TU_LLAVE",
  //   atribucion: '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  // La llave de MapTiler es pública por diseño: restríngela a arventa.mx en su panel.
  MAPA: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    atribucion: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  },
  // Analítica sin cookies (visitas por página y de dónde llegan). Website ID de cloud.umami.is; vacío = apagada
  UMAMI_ID: "",
  // Registro de errores con Sentry: "Loader Script" de tu proyecto (https://js.sentry-cdn.com/….min.js); vacío = apagado.
  // Aunque esté vacío, los errores del navegador se guardan de forma anónima en /api/evento.
  SENTRY_LOADER: "",
  // Datos legales: salen en el pie y en el aviso de privacidad. Vacíos = "en trámite" / "pendiente".
  RAZON_SOCIAL: "",
  DOMICILIO: "",
  CORREO: "",
  LICENCIA: "",
  VERSION_AVISO: "18 de noviembre de 2026"
};

(function(){
  const c = ARVENTA, yo = document.currentScript;
  const cargar = (src, attrs = {}) => { const s = document.createElement("script"); s.src = src; s.defer = true; Object.assign(s.dataset, attrs); document.head.appendChild(s); };
  if(c.UMAMI_ID && yo?.dataset.medir !== "no") cargar("https://cloud.umami.is/script.js", {websiteId:c.UMAMI_ID, doNotTrack:"true"});
  if(c.SENTRY_LOADER) cargar(c.SENTRY_LOADER);

  /* Eventos anónimos para los reportes: nunca nombre, teléfono, sueldo ni ubicación exacta */
  window.medir = function(tipo, datos = {}){
    if(yo?.dataset.medir === "no") return;
    try{ window.umami?.track(tipo, datos); }catch(e){}
    try{
      const cuerpo = JSON.stringify({tipo, datos, pagina:location.pathname});
      if(!navigator.sendBeacon?.("/api/evento", new Blob([cuerpo], {type:"application/json"})))
        fetch("/api/evento", {method:"POST", body:cuerpo, headers:{"Content-Type":"application/json"}, keepalive:true}).catch(() => {});
    }catch(e){}
  };
  // Errores del navegador (máximo 5 por visita)
  let errores = 0;
  const reportar = (mensaje, archivo, linea) => { if(errores++ < 5) medir("error", {mensaje:String(mensaje).slice(0, 200), archivo:String(archivo || "").slice(-80), linea:linea || 0}); };
  addEventListener("error", e => reportar(e.message, e.filename, e.lineno));
  addEventListener("unhandledrejection", e => reportar(e.reason?.message || e.reason, "promesa", 0));

  // Folio legible (sin 0/O ni 1/I/L). El servidor lo respeta si es válido y nuevo.
  window.nuevoFolio = function(prefijo){
    const letras = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", n = new Uint8Array(6);
    crypto.getRandomValues(n);
    return prefijo + "-" + Array.from(n, x => letras[x % letras.length]).join("");
  };

  /* Pie legal y datos del responsable:
     <footer data-pie></footer>  ·  <span data-config="RAZON_SOCIAL"></span> */
  window.pintarDatosLegales = function(){
    const e = s => String(s).replace(/[&<>"]/g, x => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[x]));
    const pendiente = t => `<mark class="pendiente">${t}</mark>`;
    const t = {
      RAZON_SOCIAL: c.RAZON_SOCIAL ? e(c.RAZON_SOCIAL) : "en trámite",
      RESPONSABLE: c.RAZON_SOCIAL ? e(c.RAZON_SOCIAL) : "ARVENTA (razón social en trámite)",
      DOMICILIO: c.DOMICILIO ? e(c.DOMICILIO) : pendiente("Domicilio pendiente"),
      CORREO: c.CORREO ? `<a href="mailto:${e(c.CORREO)}">${e(c.CORREO)}</a>` : pendiente("Correo pendiente"),
      LICENCIA: c.LICENCIA ? e(c.LICENCIA) : "en trámite",
      VERSION_AVISO: e(c.VERSION_AVISO)
    };
    document.querySelectorAll("[data-config]").forEach(el => { el.innerHTML = t[el.dataset.config] ?? ""; });
    document.querySelectorAll("[data-pie]").forEach(el => {
      el.innerHTML = `<p>ARVENTA · Razón social: ${t.RAZON_SOCIAL} · Licencia de asesor inmobiliario del Estado de Durango: ${t.LICENCIA}</p>
        <p>Los precios y datos vienen de anuncios públicos y de las desarrolladoras; pueden variar al cerrar la operación y se confirman en la visita.
        <a href="/aviso-privacidad.html">Aviso de privacidad</a> · <a href="/terminos.html">Términos de uso</a> · <a href="/anuncia.html">Anuncia tu desarrollo</a></p>`;
    });
  };
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", pintarDatosLegales); else pintarDatosLegales();
})();
