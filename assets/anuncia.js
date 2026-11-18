/* Página para desarrolladoras: cifras reales y formulario de contacto (POST /api/contacto) */
(function(){
  const $ = s => document.querySelector(s);
  // Cifras reales del sitio, salen de datos.js
  const D = window.DESARROLLOS || [];
  if(D.length){
    const conMapa = D.filter(d => d.lat != null).length;
    const tipos = new Set(D.map(d => d.tipo)).size;
    $("#cifras").innerHTML = `<div><b>${D.length}</b>desarrollos publicados</div><div><b>${conMapa}</b>ya ubicados en el mapa</div><div><b>${tipos}</b>tipos: casas, departamentos y terrenos</div>`;
  }

  if(!ARVENTA.LICENCIA) $("#nota-licencia").hidden = false;
  const val = id => $("#" + id).value.trim();
  function mensajeWhatsApp(r){
    return `Hola, quiero anunciar mi desarrollo en ARVENTA.\nNombre: ${r.nombre}${r.empresa ? " (" + r.empresa + ")" : ""}\nDesarrollo: ${r.desarrollo}${r.ubicacion ? ", " + r.ubicacion : ""}\nTipo: ${r.tipoVivienda}${r.unidades ? " · " + r.unidades + " unidades" : ""}${r.precio ? " · desde " + r.precio : ""}${r.mensaje ? "\n" + r.mensaje : ""}\nFolio: ${r.folio}`;
  }
  $("#form-dev").addEventListener("submit", async e => {
    e.preventDefault();
    const err = $("#f-error"); err.hidden = true;
    const r = {tipo:"desarrolladora", folio:nuevoFolio("D"), nombre:val("f-nombre"), empresa:val("f-empresa"), desarrollo:val("f-desarrollo"),
      ubicacion:val("f-ubicacion"), tipoVivienda:val("f-tipo"), unidades:val("f-unidades"), precio:val("f-precio"),
      whatsapp:val("f-whatsapp"), correo:val("f-correo"), mensaje:val("f-mensaje"), sitio:val("f-sitio")};
    const falta = !r.nombre ? "f-nombre" : !r.desarrollo ? "f-desarrollo" : null;
    if(falta){ err.textContent = "Escribe tu nombre y el nombre del desarrollo."; err.hidden = false; $("#" + falta).focus(); return; }
    if(r.whatsapp.replace(/\D/g, "").length < 10 && !/^\S+@\S+\.\S+$/.test(r.correo)){
      err.textContent = "Déjanos un WhatsApp de 10 dígitos o un correo para contactarte."; err.hidden = false; $("#f-whatsapp").focus(); return;
    }
    medir("contacto-desarrolladora");
    const wa = `https://wa.me/${ARVENTA.WHATSAPP}?text=${encodeURIComponent(mensajeWhatsApp(r))}`;
    const boton = $("#f-enviar"); boton.disabled = true; boton.textContent = "Enviando…";
    let res;
    try{
      const resp = await fetch("/api/contacto", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(r)});
      res = await resp.json().catch(() => ({ok:false}));
    }catch(x){ res = {ok:false}; }
    boton.disabled = false; boton.textContent = "Enviar";
    if(res && res.ok){
      $("#form-dev").hidden = true;
      const ok = $("#f-ok");
      ok.innerHTML = `<b>¡Gracias, ${r.nombre.replace(/[<>&]/g, "")}! Recibimos tus datos.</b><br>Tu folio es <b>${res.folio || r.folio}</b>. Te contactamos pronto. Si quieres adelantar, <a href="${wa}">mándanos tu folio por WhatsApp</a>.`;
      ok.hidden = false; ok.focus();
    }else{
      err.innerHTML = `${res && res.mensaje ? res.mensaje.replace(/[<>&]/g, "") + " " : ""}No pudimos enviar el formulario. <a href="${wa}">Mándalo por WhatsApp</a> y te atendemos igual.`;
      err.hidden = false;
    }
  });
})();
