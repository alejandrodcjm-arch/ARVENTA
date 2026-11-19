/* Página de la cita (/cita/?c=FOLIO&t=TOKEN), que el cliente abre desde su WhatsApp.
   "Confirmo mi visita" = la cita vale. "Ya llegué" = llegada con hora, si está a menos de 300 m.
   Lo que diga el asesor no cambia nada de esto. */
(function(){
  const $ = s => document.querySelector(s);
  const q = new URLSearchParams(location.search), c = q.get("c"), t = q.get("t");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, x => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
  const hora = f => new Date(f).toLocaleString("es-MX", {weekday:"long", day:"numeric", month:"long", hour:"numeric", minute:"2-digit"});
  let estado = null;

  async function api(metodo, cuerpo){
    const r = await fetch(metodo === "GET" ? `/api/cita?${new URLSearchParams({c, t})}` : "/api/cita",
      metodo === "GET" ? {} : {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({c, t, ...cuerpo})});
    const j = await r.json().catch(() => ({ok:false, mensaje:"No pudimos conectarnos. Intenta en un momento."}));
    if(!r.ok || !j.ok) throw new Error(j.mensaje || "Algo salió mal.");
    return j;
  }
  function pintar(msg){
    const s = estado, d = s.desarrollo;
    let h = `<p class="marca" style="font-size:14px;margin:8px 0 0">TU VISITA</p>
      <h1>${esc(d.nombre)}</h1><p class="entrada">Hola ${esc(s.nombre)}. ${esc(d.zona || "")}</p>
      <div class="codigo-cita"><small>Tu código ARVENTA</small><b>${esc(s.folio)}</b><small>Muéstralo en la oficina de ventas</small></div>`;
    if(s.cita_fecha) h += `<p>Tu visita: <b>${esc(hora(s.cita_fecha))}</b></p>`;
    if(msg) h += `<p class="${msg.error ? "form-error" : "form-ok"}" role="status">${esc(msg.texto)}</p>`;
    if(!s.confirmada) h += `<section class="caja"><h2 style="margin-top:0">¿Confirmas tu visita?</h2>
        <p>Así apartamos tu lugar y la desarrolladora te espera.</p>
        <button class="btn" type="button" id="confirmar" style="width:100%;padding:15px;font-size:17px">Confirmo mi visita</button></section>`;
    else if(!s.llegada_en) h += `<p class="form-ok">Tu visita está confirmada${s.confirmada_en ? ` desde el ${esc(hora(s.confirmada_en))}` : ""}.</p>
      <section class="caja"><h2 style="margin-top:0">¿Ya estás en el desarrollo?</h2>
        ${d.verificable ? `<p>Cuando estés en la oficina de ventas, toca el botón. Usamos tu ubicación solo para comprobar que estás ahí: no la guardamos.</p>
        <button class="btn" type="button" id="llegue" style="width:100%;padding:15px;font-size:17px">Ya llegué</button>`
        : `<p style="margin:0">Muestra tu código al asesor al llegar.</p>`}</section>`;
    else h += `<section class="caja llegada"><h2 style="margin-top:0">¡Bienvenido!</h2><p>Registramos tu llegada el ${esc(hora(s.llegada_en))}.</p>
        ${s.beneficio ? `<p class="beneficio"><b>Tu beneficio ARVENTA:</b> ${esc(s.beneficio)}</p>` : ""}
        <p style="margin:0">Muestra esta pantalla y tu código al asesor.</p></section>`;
    if(d.tieneCorrida) h += `<p style="margin-top:22px"><a class="btn claro" href="/cotizador.html?d=${encodeURIComponent(d.id)}&folio=${encodeURIComponent(s.folio)}">Arma tu corrida financiera</a></p>`;
    h += `<p class="nota" style="margin-top:22px">¿Dudas o quieres cambiar el día? Escríbenos por <a href="https://wa.me/${window.ARVENTA?.WHATSAPP || "526184463867"}?text=${encodeURIComponent("Hola ARVENTA, sobre mi visita " + s.folio)}">WhatsApp</a>.</p>`;
    $("#cita").innerHTML = h;
    $("#confirmar")?.addEventListener("click", () => accion({accion:"confirmar"}, "¡Listo! Tu visita está confirmada."));
    $("#llegue")?.addEventListener("click", llegue);
  }
  async function accion(cuerpo, ok){
    try{ estado = await api("POST", cuerpo); pintar({texto:ok}); }
    catch(e){ pintar({texto:e.message, error:true}); }
  }
  function llegue(){
    const b = $("#llegue");
    if(!navigator.geolocation) return pintar({texto:"Tu celular no permite usar la ubicación. Muestra tu código al asesor.", error:true});
    b.disabled = true; b.textContent = "Revisando tu ubicación…";
    navigator.geolocation.getCurrentPosition(
      p => accion({accion:"llegue", lat:p.coords.latitude, lng:p.coords.longitude, precision:p.coords.accuracy}, "Registramos tu llegada."),
      () => pintar({texto:"Necesitamos permiso de ubicación para registrar tu llegada. Actívalo en tu navegador y vuelve a intentar.", error:true}),
      {enableHighAccuracy:true, timeout:15000, maximumAge:0});
  }
  if(!c || !t){ $("#cita").innerHTML = `<h1>Enlace incompleto</h1><p>Abre el enlace completo que te mandamos por WhatsApp.</p>`; return; }
  api("GET").then(j => { estado = j; pintar(); }).catch(e => { $("#cita").innerHTML = `<h1>No encontramos tu cita</h1><p>${esc(e.message)}</p>`; });
})();
