/* Reporte de cita inválida (POST /api/reclamo). El asesor solo reporta con motivo; ARVENTA decide. */
(function(){
  const $ = s => document.querySelector(s);
  $("#r-motivo").addEventListener("change", e => { $("#r-prueba").hidden = e.target.value !== "cliente_previo"; });
  $("#form-reclamo").addEventListener("submit", async e => {
    e.preventDefault();
    const err = $("#r-error"); err.hidden = true;
    const b = $("#r-enviar"); b.disabled = true; b.textContent = "Enviando…";
    try{
      const r = await fetch("/api/reclamo", {method:"POST", headers:{"Content-Type":"application/json", "x-clave":$("#r-clave").value.trim()},
        body:JSON.stringify({folio:$("#r-folio").value.trim().toUpperCase(), motivo:$("#r-motivo").value, detalle:$("#r-detalle").value, pruebaFecha:$("#r-prueba-fecha").value})});
      const j = await r.json().catch(() => ({mensaje:"El servidor no respondió."}));
      if(!r.ok || !j.ok) throw new Error(j.mensaje || "No se pudo enviar.");
      $("#form-reclamo").hidden = true;
      Object.assign($("#r-ok"), {hidden:false, textContent:j.mensaje}); $("#r-ok").focus();
    }catch(x){ err.textContent = x.message; err.hidden = false; }
    finally{ b.disabled = false; b.textContent = "Enviar reporte"; }
  });
})();
