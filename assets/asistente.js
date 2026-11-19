/* Asistente de ARVENTA en la portada: la persona platica y la IA mueve la pantalla por ella
   (como un copiloto): muestra resultados con su razón, ordena por su trabajo, guarda su presupuesto,
   abre fichas, compara y abre el formulario de visita. Cada cambio queda anotado y se puede deshacer.
   Se carga después de assets/app.js y usa sus funciones (estado, pintar, tarjeta, ponerRef, agendar…).
   La plática vive solo en esta pestaña: no se guarda en el navegador ni en el servidor. */
(function(){
  if (!document.getElementById("ia-form")) return;
  const MAX_HISTORIA = 14;
  let historia = [];          // [{rol, texto}]
  let ocupado = false;

  /* ---------- Integración con app.js: selección de la IA ---------- */
  // estado.ia = {ids, razones, titulo} | null. Mientras hay selección, la rejilla muestra solo esos, en ese orden.
  estado.ia = null;
  const pasaOriginal = pasa, ordenarOriginal = ordenar, tarjetaOriginal = tarjeta, pintarOriginal = pintar;
  // Con selección del asistente: solo esos desarrollos; las categorías cuentan dentro de la selección
  pasa = function(d, catId){
    if (!estado.ia) return pasaOriginal(d, catId);
    if (!estado.ia.ids.includes(d.id)) return false;
    if (typeof catId !== "string") catId = estado.cat;
    const cat = CATEGORIAS.find(c => c.id === catId);
    if (!cat) return true;
    return catId === "guardados" ? pasaOriginal(d, catId) : cat.f(d);
  };
  ordenar = function(l){ return estado.ia ? [...l].sort((a, b) => estado.ia.ids.indexOf(a.id) - estado.ia.ids.indexOf(b.id)) : ordenarOriginal(l); };
  tarjeta = function(d){
    const h = tarjetaOriginal(d), r = estado.ia?.razones?.[d.id];
    return r ? h.replace('<div class="info">', `<div class="info"><p class="razon-ia"><span aria-hidden="true">✦</span> ${esc(r)}</p>`) : h;
  };
  pintar = function(){
    pintarOriginal();
    if (!estado.ia) return;
    $("#titulo-res").textContent = estado.ia.titulo || `${estado.ia.ids.length} elegidos para ti`;
    $("#contexto").innerHTML = `Elegidos por el asistente con lo que le contaste. <button type="button" class="enlace" id="ia-ver-todo">Ver todos los desarrollos</button>`;
    $("#ia-ver-todo").onclick = () => { estado.ia = null; pintar(); };
  };

  /* ---------- Fotografía del estado, para deshacer ---------- */
  const foto = () => ({ia:estado.ia, ref:estado.ref, max:estado.max, perfil:PERFIL, comparar:[...COMPARAR]});
  function restaurar(f){
    estado.ia = f.ia; estado.max = f.max; PERFIL = f.perfil; COMPARAR = f.comparar;
    try { f.perfil ? localStorage.setItem("arventa-perfil", JSON.stringify(f.perfil)) : localStorage.removeItem("arventa-perfil"); } catch (e) {}
    if (f.ref !== estado.ref) ponerRef(f.ref); else pintar();
    sincronizarComparar();
  }

  /* ---------- Acciones que manda la IA ---------- */
  const nombre = id => DESARROLLOS.find(d => d.id === id)?.nombre || id;
  function aplicar(a){
    const d = a.id && DESARROLLOS.find(x => x.id === a.id);
    switch (a.tipo){
      case "mostrar_en_pantalla":
        estado.ia = {ids:a.ids, razones:a.razones || {}, titulo:a.titulo};
        if (estado.cat !== "todo") { estado.cat = "todo"; pintarCategorias(); }
        pintar();
        if (window.matchMedia("(min-width:861px)").matches) $("#resultados").scrollIntoView({behavior:"smooth", block:"start"});
        return `Te puse ${a.ids.length} ${a.ids.length === 1 ? "opción" : "opciones"} en pantalla`;
      case "poner_referencia":
        ponerRef({tipo:a.tipo_ref === "trabajo" ? "trabajo" : (a.tipo_ref || "trabajo"), lat:a.lat, lng:a.lng, nombre:a.nombre});
        return `Ordené por cercanía a ${a.nombre}`;
      case "guardar_presupuesto": {
        const p = {sueldo:+a.sueldo || 0, ahorro:+a.ahorro || 0, subcuenta:+a.subcuenta || 0};
        if (!p.sueldo) return null;
        PERFIL = p; try { localStorage.setItem("arventa-perfil", JSON.stringify(p)); } catch (e) {}
        const c = capacidad(p); estado.max = Math.round(Math.max(c.banco.max, c.inf.max) / 10000) * 10000; estado.presEtiqueta = "ingreso";
        pintar();
        return `Guardé tu presupuesto: hasta ${corto(estado.max)}`;
      }
      case "abrir_ficha":
        if (d) setTimeout(() => { location.href = `/desarrollos/${d.id}/`; }, 900);
        return d ? `Abriendo ${d.nombre}` : null;
      case "comparar":
        COMPARAR = a.ids.slice(0, MAX_COMPARAR); sincronizarComparar();
        if (COMPARAR.length >= 2) verComparar();
        return `Comparando ${COMPARAR.map(nombre).join(", ")}`;
      case "agendar_visita":
        if (d) { cerrarPanelMovil(); agendar(d); }
        return d ? `Abrí el formulario para visitar ${d.nombre}` : null;
    }
    return null;
  }

  /* ---------- Pintar la plática ---------- */
  const caja = $("#ia-mensajes");
  function burbuja(rol, html){
    const el = document.createElement("div");
    el.className = "ia-msg " + (rol === "persona" ? "ia-yo" : "ia-ella");
    el.innerHTML = html;
    caja.appendChild(el);
    caja.scrollTop = caja.scrollHeight;
    return el;
  }
  function textoSeguro(t){
    return esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>");
  }
  function miniTarjetas(ids, razones){
    return `<ul class="ia-mini">${ids.slice(0, 4).map(id => {
      const d = DESARROLLOS.find(x => x.id === id); if (!d) return "";
      return `<li><a href="/desarrollos/${d.id}/"><b>${esc(d.nombre)}</b><span>${esc(precioTexto(d))}${razones?.[id] ? " · " + esc(razones[id]) : ""}</span></a>
        <button type="button" class="enlace" data-ia-agendar="${esc(d.id)}">Agendar</button></li>`;
    }).join("")}</ul>`;
  }

  /* ---------- Enviar ---------- */
  async function enviar(t){
    t = String(t || "").trim();
    if (!t || ocupado) return;
    abrirPanel();
    ocupado = true; $("#ia-enviar").disabled = true;
    historia.push({rol:"persona", texto:t}); historia = historia.slice(-MAX_HISTORIA);
    burbuja("persona", textoSeguro(t));
    const espera = burbuja("asistente", `<p class="ia-pensando" aria-label="Buscando">Buscando entre ${DESARROLLOS.length} opciones<span>.</span><span>.</span><span>.</span></p>`);
    const antes = foto();
    try {
      const r = await fetch("/api/asistente", {method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({mensajes:historia, contexto:{ref:estado.ref}})});
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.mensaje || "No pude responder ahorita.");
      const hechos = (j.acciones || []).map(aplicar).filter(Boolean);
      historia.push({rol:"asistente", texto:j.texto});
      const ver = (j.acciones || []).filter(a => a.tipo === "mostrar_en_pantalla").pop();
      espera.innerHTML = `<p>${textoSeguro(j.texto)}</p>` + (ver ? miniTarjetas(ver.ids, ver.razones) : "") +
        (hechos.length ? `<div class="ia-hechos">${hechos.map(h => `<span>✓ ${esc(h)}</span>`).join("")}<button type="button" class="enlace ia-deshacer">Deshacer</button></div>` : "");
      espera.querySelector(".ia-deshacer")?.addEventListener("click", e => { restaurar(antes); e.target.replaceWith(Object.assign(document.createElement("span"), {textContent:"Cambios deshechos", className:"ia-deshecho"})); });
      espera.querySelectorAll("[data-ia-agendar]").forEach(b => b.onclick = () => { const d = DESARROLLOS.find(x => x.id === b.dataset.iaAgendar); if (d) { cerrarPanelMovil(); agendar(d); } });
      $("#ia-modo").hidden = j.modo !== "demo";
      $("#ia-sugerencias").innerHTML = SEGUIMIENTO.map(s => `<button type="button" class="chip-ia">${s}</button>`).join("");
      activarSugerencias();
      if (ver) $("#ia-ver-res").hidden = false;
      medir("asistente", {acciones:(j.acciones || []).length, modo:j.modo});
    } catch (e) {
      espera.innerHTML = `<p>${esc(e.message === "Failed to fetch" ? "Sin conexión. Revisa tu internet y vuelve a intentar." : e.message)}</p>`;
      historia.pop();
    } finally {
      ocupado = false; $("#ia-enviar").disabled = false;
      caja.scrollTop = caja.scrollHeight;
    }
  }

  /* ---------- Panel ---------- */
  const SEGUIMIENTO = ["¿Cuál me conviene más?", "Compara los dos primeros", "¿Cuánto pagaría al mes?", "Quiero agendar una visita"];
  function abrirPanel(){
    document.body.classList.add("ia-abierta");
    $("#ia-panel").hidden = false;
    $("#ia-panel").classList.remove("min");
    medirCabecera?.();
  }
  function cerrarPanel(){ document.body.classList.remove("ia-abierta"); $("#ia-panel").hidden = true; }
  function cerrarPanelMovil(){ if (window.matchMedia("(max-width:860px)").matches) $("#ia-panel").classList.add("min"); }
  function activarSugerencias(){
    $$(".chip-ia").forEach(b => b.onclick = () => enviar(b.textContent));
  }

  $("#ia-form").addEventListener("submit", e => { e.preventDefault(); const t = $("#ia-q").value; $("#ia-q").value = ""; enviar(t); });
  $("#ia-form-panel").addEventListener("submit", e => { e.preventDefault(); const t = $("#ia-q2").value; $("#ia-q2").value = ""; enviar(t); });
  $("#ia-q2").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#ia-form-panel").requestSubmit(); } });
  $("#ia-cerrar").onclick = cerrarPanel;
  $("#ia-minimizar").onclick = () => $("#ia-panel").classList.toggle("min");
  $("#ia-ver-res").onclick = () => { $("#ia-panel").classList.add("min"); $("#resultados").scrollIntoView({behavior:"smooth"}); };
  $("#ia-panel .ia-barra").addEventListener("click", e => { if (e.target.closest("button")) return; $("#ia-panel").classList.remove("min"); });
  activarSugerencias();

  // Ejemplos que cambian en el campo, para que se entienda qué se le puede decir
  const EJEMPLOS = ["Trabajo en Ciudad Industrial, gano 22 mil y quiero 3 recámaras", "Casa con Infonavit, menos de $1.5 millones", "Departamento cerca de una escuela, con alberca", "Tengo 200 mil de enganche, ¿qué me alcanza?"];
  let k = 0;
  if (!window.matchMedia("(prefers-reduced-motion:reduce)").matches)
    setInterval(() => { const q = $("#ia-q"); if (document.activeElement !== q && !q.value) q.placeholder = EJEMPLOS[k = (k + 1) % EJEMPLOS.length]; }, 4000);
})();
