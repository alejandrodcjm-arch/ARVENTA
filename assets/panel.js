/* Tu panel (solo ARVENTA): el camino de cada solicitud, todo por WhatsApp. Usa /api/panel con la clave. */
(function(){
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dinero = n => "$" + Math.round(n).toLocaleString("es-MX");
  const cuando = f => f ? new Date(f).toLocaleString("es-MX", {day:"numeric", month:"short", hour:"numeric", minute:"2-digit"}) : "";
  const ESTADOS = {nueva:"Nueva", verificada:"Verificada", enviada:"Enviada", visita_hecha:"Visita hecha", invalida:"Inválida"};
  const MOTIVOS = {telefono_falso:"Teléfono falso", duplicada:"Duplicada", cliente_previo:"Cliente previo", otro:"Otro"};
  const clave = () => { try{ return sessionStorage.getItem("arventa-clave") || ""; }catch(e){ return ""; } };
  const ponerClave = v => { try{ v ? sessionStorage.setItem("arventa-clave", v) : sessionStorage.removeItem("arventa-clave"); }catch(e){} };
  let datos = null;

  async function api(metodo, cuerpo){
    const q = metodo === "GET" ? `?${new URLSearchParams({dias:$("#f-dias").value, estado:$("#f-estado").value})}` : "";
    const r = await fetch("/api/panel" + q, {method:metodo, headers:{"x-clave":clave(), ...(cuerpo ? {"Content-Type":"application/json"} : {})}, body:cuerpo ? JSON.stringify(cuerpo) : undefined});
    const j = await r.json().catch(() => ({ok:false, mensaje:"El servidor no respondió."}));
    if(r.status === 401){ ponerClave(null); entrar("La clave no es correcta."); throw new Error("clave"); }
    if(!j.ok) throw new Error(j.mensaje || "Algo salió mal.");
    return j;
  }

  function paso(hecho, texto, fecha){ return `<li class="${hecho ? "hecho" : ""}"><span aria-hidden="true">${hecho ? "●" : "○"}</span>${texto}${fecha ? ` <small>${esc(cuando(fecha))}</small>` : ""}</li>`; }
  function tarjeta(s){
    const otros = (s.otros || []).map(id => (window.DESARROLLOS || []).find(d => d.id === id)?.nombre || id);
    const datosCliente = [
      `<a href="https://wa.me/52${esc(s.telefono)}" target="_blank" rel="noopener">${esc(s.telefono)}</a>`, esc(s.cuando), `Paga con ${esc(s.pago)}`,
      s.presupuesto ? `Presupuesto ${dinero(s.presupuesto)}` : "", s.mensualidad ? `Mensualidad que vio ${dinero(s.mensualidad)}` : "",
      s.trabajo_texto || s.minutos ? `Trabaja en ${esc(s.trabajo_texto || "zona del mapa")}${s.minutos ? ` (${s.minutos} min)` : ""}` : "",
      otros.length ? `También vio ${esc(otros.join(", "))}` : ""].filter(Boolean).join(" · ");
    const acciones = [];
    if(s.estado === "invalida") acciones.push(`<button class="btn claro" data-a="reactivar">Reactivar</button>`);
    else{
      if(!s.verificada_en) acciones.push(`<button class="btn" data-a="verificar">${s.verificacion_enviada_en ? "Reenviar" : "Mandar"} verificación</button>`);
      if(s.verificada_en && !s.enviada_en) acciones.push(`<button class="btn" data-a="enviar">Enviar a la desarrolladora</button>`);
      if(s.verificada_en && !s.enviada_en) acciones.push(`<button class="btn claro" data-a="marcar_enviada">Ya se la mandé</button>`);
      if(s.estado !== "visita_hecha") acciones.push(`<button class="btn claro" data-a="visita_hecha">Visita hecha</button>`);
      acciones.push(`<button class="btn claro" data-a="fecha">Fecha de cita</button>`, `<button class="btn claro" data-a="invalida">Inválida…</button>`);
    }
    return `<article class="sol" data-folio="${esc(s.folio)}">
      <header><div><b>${esc(s.nombre)}</b> <small>${esc(s.folio)} · ${esc(cuando(s.creado))}</small><br><span class="gris">${esc(s.desarrolloNombre)}</span></div>
        <span class="estado e-${esc(s.estado)}">${ESTADOS[s.estado] || esc(s.estado)}</span></header>
      ${s.duplicada_de ? `<p class="aviso-sol">Repetida de ${esc(s.duplicada_de)}: no se cobra.</p>` : ""}
      ${s.estado === "invalida" ? `<p class="aviso-sol">Inválida: ${esc(MOTIVOS[s.motivo_invalida] || "")}${s.prueba_fecha ? ` (prueba del ${esc(s.prueba_fecha)})` : ""}. ${esc(s.detalle_invalida || "")}</p>` : ""}
      <p class="datos-sol">${datosCliente}</p>
      ${s.cita_fecha ? `<p class="datos-sol"><b>Cita:</b> ${esc(cuando(s.cita_fecha))}</p>` : ""}
      <ol class="camino">
        ${paso(!!s.verificacion_enviada_en, "Verificación enviada", s.verificacion_enviada_en)}
        ${paso(!!s.verificada_en, "Verificada por el cliente", s.verificada_en)}
        ${paso(!!s.enviada_en, `Enviada${s.desarrolladora ? ` a ${esc(s.desarrolladora.nombre)}` : ""}`, s.enviada_en)}
        ${paso(!!s.llegada_en, `Llegó${s.llegada_distancia_m != null ? ` (a ${s.llegada_distancia_m} m)` : ""}`, s.llegada_en)}
      </ol>
      ${s.cobrable ? `<p class="cobrable">Se cobra</p>` : ""}
      <div class="acciones-sol">${acciones.join("")}</div>
      <div class="extra-sol"></div>
    </article>`;
  }
  function pintar(){
    $("#sin-api").hidden = datos.apiWhatsApp;
    $("#resumen").innerHTML = datos.resumenMes.length ? `<h2>Este mes</h2><div class="tabla-envoltura"><table class="tabla-panel"><thead><tr><th>Desarrollo</th><th>Solicitudes</th><th>Verificadas</th><th>Se cobran</th><th>Inválidas</th></tr></thead><tbody>
      ${datos.resumenMes.map(r => `<tr><td>${esc(r.desarrollo)}</td><td>${r.solicitudes}</td><td>${r.verificadas}</td><td><b>${r.cobrables}</b></td><td>${r.invalidas}</td></tr>`).join("")}</tbody></table></div>` : "";
    $("#lista").innerHTML = datos.solicitudes.length ? datos.solicitudes.map(tarjeta).join("") : `<p class="nota">No hay solicitudes en este periodo.</p>`;
  }
  async function cargar(){
    $("#lista").innerHTML = `<p class="nota">Cargando…</p>`;
    try{ datos = await api("GET"); pintar(); }catch(e){ if(e.message !== "clave") $("#lista").innerHTML = `<p class="form-error">${esc(e.message)}</p>`; }
  }
  async function accion(folio, cuerpo, tarjetaEl){
    const extra = tarjetaEl.querySelector(".extra-sol");
    try{
      const r = await api("POST", {folio, ...cuerpo});
      const i = datos.solicitudes.findIndex(s => s.folio === folio);
      if(i >= 0) datos.solicitudes[i] = r.solicitud;
      pintar();
      const nuevo = $(`.sol[data-folio="${folio}"] .extra-sol`);
      // Un toque tuyo abre WhatsApp (los celulares bloquean abrirlo solo después de esperar al servidor)
      if(r.manual) nuevo.innerHTML = `<p style="margin:8px 0 0"><a class="btn" href="${esc(r.manual)}" target="_blank" rel="noopener">Abrir WhatsApp con el mensaje</a></p><p class="nota">${cuerpo.accion === "enviar" ? "Cuando lo mandes, toca “Ya se la mandé”." : "Mándalo desde tu WhatsApp."}</p>`;
      else if(r.motivo) nuevo.innerHTML = `<p class="form-error">${esc(r.motivo)} Regístrala en la tabla desarrolladoras de Supabase.</p>`;
      else if(r.enviado) nuevo.innerHTML = `<p class="form-ok">Enviado por WhatsApp.</p>`;
    }catch(e){ if(e.message !== "clave") extra.innerHTML = `<p class="form-error">${esc(e.message)}</p>`; }
  }
  $("#lista").addEventListener("click", e => {
    const b = e.target.closest("button[data-a]"); if(!b) return;
    const t = b.closest(".sol"), folio = t.dataset.folio, extra = t.querySelector(".extra-sol"), a = b.dataset.a;
    if(a === "invalida"){
      extra.innerHTML = `<form class="form mini-form"><label>Motivo<select name="motivo"><option value="telefono_falso">Teléfono falso</option><option value="duplicada">Duplicada</option><option value="cliente_previo">Cliente previo (prueba de 60 días)</option><option value="otro">Otro</option></select></label>
        <label class="fecha-prueba" hidden>Fecha de la prueba<input type="date" name="prueba"></label>
        <label>Detalle (qué te dijo el asesor y cómo consta)<textarea name="detalle"></textarea></label>
        <button class="btn" type="submit">Marcar inválida</button></form>`;
      const f = extra.querySelector("form");
      f.motivo.onchange = () => { f.querySelector(".fecha-prueba").hidden = f.motivo.value !== "cliente_previo"; };
      f.onsubmit = ev => { ev.preventDefault(); accion(folio, {accion:"invalida", motivo:f.motivo.value, detalle:f.detalle.value, pruebaFecha:f.prueba.value}, t); };
    }else if(a === "fecha"){
      extra.innerHTML = `<form class="form mini-form"><label>Día y hora de la cita<input type="datetime-local" name="fecha" required></label><button class="btn" type="submit">Guardar</button></form>`;
      const f = extra.querySelector("form");
      f.onsubmit = ev => { ev.preventDefault(); accion(folio, {accion:"cita_fecha", fecha:new Date(f.fecha.value).toISOString()}, t); };
    }else accion(folio, {accion:a}, t);
  });
  function entrar(msg){ $("#panel").hidden = true; $("#acceso").hidden = false; $("#salir").hidden = true; $("#clave-error").textContent = msg || ""; $("#clave-error").hidden = !msg; }
  $("#form-clave").addEventListener("submit", e => { e.preventDefault(); ponerClave($("#clave").value.trim()); abrir(); });
  function abrir(){ $("#acceso").hidden = true; $("#panel").hidden = false; $("#salir").hidden = false; cargar(); }
  $("#salir").onclick = () => { ponerClave(null); entrar(); };
  $("#recargar").onclick = cargar; $("#f-estado").onchange = cargar; $("#f-dias").onchange = cargar;
  clave() ? abrir() : entrar();
})();
