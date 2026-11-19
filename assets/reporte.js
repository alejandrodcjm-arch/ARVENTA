/* Reporte de interés (GET /api/reporte con la clave en el encabezado x-clave) */
(function(){
  const $ = s => document.querySelector(s);
  const D = window.DESARROLLOS || [];
  const porId = id => D.find(d => d.id === id);
  const nombreDe = id => (porId(id) || {nombre:id}).nombre;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const num = n => Number(n || 0).toLocaleString("es-MX");
  const dinero = n => "$" + Math.round(n).toLocaleString("es-MX");
  const fecha = (iso, conAño) => { const [a, m, d] = iso.split("-").map(Number); return new Date(a, m - 1, d).toLocaleDateString("es-MX", conAño ? {day:"numeric", month:"long", year:"numeric"} : {day:"numeric", month:"short"}); };
  const pct = (a, b) => b ? (a / b * 100).toLocaleString("es-MX", {maximumFractionDigits:1}) : null;
  const leer = k => { try{ return sessionStorage.getItem(k); }catch(e){ return null; } };
  const guardar = (k, v) => { try{ v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); }catch(e){} };

  /* ===== Estado en la dirección: reporte.html?d=<id>&dias=90 (se puede guardar como favorito) ===== */
  const q = new URLSearchParams(location.search);
  const estado = {d:porId(q.get("d")) ? q.get("d") : "", dias:["30","90","365"].includes(q.get("dias")) ? q.get("dias") : "30"};
  let demo = location.hash === "#demo";
  const m = /clave=([^&]+)/.exec(location.hash); // la clave puede venir en #clave=… (no llega a ningún servidor)
  if(m){ guardar("arventa-clave", decodeURIComponent(m[1])); history.replaceState(null, "", location.pathname + location.search); }

  $("#sel-desarrollo").innerHTML = `<option value="">Todos los desarrollos (uso interno)</option>` +
    [...D].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map(d => `<option value="${esc(d.id)}">${esc(d.nombre)}</option>`).join("");
  $("#sel-desarrollo").value = estado.d;
  $("#sel-dias").value = estado.dias;

  function actualizarDireccion(){
    const p = new URLSearchParams();
    if(estado.d) p.set("d", estado.d);
    if(estado.dias !== "30") p.set("dias", estado.dias);
    history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : "") + (demo ? "#demo" : ""));
  }

  /* ===== Datos ===== */
  async function traer(){
    if(demo) return datosDemo(estado.d, +estado.dias);
    const clave = leer("arventa-clave");
    const r = await fetch(`/api/reporte?${new URLSearchParams({dias:estado.dias, d:estado.d})}`, {headers:{"x-clave":clave || ""}});
    const j = await r.json().catch(() => ({ok:false, mensaje:"El servidor no respondió."}));
    if(!j.ok){ const e = new Error(j.mensaje || "No se pudo cargar."); e.clave = r.status === 401; throw e; }
    return j;
  }

  // Datos inventados para ver cómo se ve el reporte. Siempre llevan el letrero "EJEMPLO".
  function datosDemo(id, dias){
    let s = 11 + (id ? id.length * 7 : 0) + dias;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const repartir = (total, pesos) => { const suma = pesos.reduce((a, p) => a + p[1], 0); const out = pesos.map(p => ({k:p[0], n:Math.floor(total * p[1] / suma)})); let resto = total - out.reduce((a, x) => a + x.n, 0); for(let i = 0; resto > 0; i++, resto--) out[i % out.length].n++; return out.filter(x => x.n).sort((a, b) => b.n - a.n); };
    const f = dias / 30;
    const desarrollos = (id ? [id] : D.map(d => d.id)).map(k => { const v = Math.round((90 + r() * 380) * f); return {id:k, vistas:v, solicitudes:Math.round(v * (0.015 + r() * 0.05)), compartidos:Math.round(v * r() * 0.06)}; })
      .sort((a, b) => b.solicitudes - a.solicitudes || b.vistas - a.vistas);
    const tot = k => desarrollos.reduce((a, d) => a + d[k], 0);
    const sol = tot("solicitudes");
    const hasta = new Date(), desde = new Date(hasta - dias * 864e5);
    const lunes = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() - ((desde.getDay() + 6) % 7));
    const semanas = [];
    for(let x = lunes; x <= hasta; x = new Date(x.getFullYear(), x.getMonth(), x.getDate() + 7)) semanas.push({inicio:x.toISOString().slice(0, 10), n:0});
    for(let i = 0; i < sol; i++) semanas[Math.min(semanas.length - 1, Math.floor(Math.pow(r(), .8) * semanas.length))].n++;
    const conTrabajo = Math.round(sol * .62);
    const zonasBase = [[24.02, -104.67], [24.03, -104.66], [24.06, -104.62], [24.04, -104.65], [24.01, -104.64], [24.05, -104.68]];
    const zonas = repartir(Math.round(conTrabajo * .8), zonasBase.map((z, i) => [i, 6 - i])).filter(z => z.n >= 2).map(z => ({lat:zonasBase[z.k][0], lng:zonasBase[z.k][1], n:z.n}));
    return {ok:true, demo:true, desde:desde.toISOString().slice(0, 10), hasta:hasta.toISOString().slice(0, 10), desarrollo:id || null,
      medicion:{ok:true, motivo:""}, totales:{vistas:tot("vistas"), solicitudes:sol, compartidos:tot("compartidos")}, desarrollos, semanas,
      pago:repartir(sol, [["Infonavit", 45], ["Crédito bancario", 22], ["Cofinavit (Infonavit + banco)", 12], ["Fovissste", 9], ["Aún no sé", 7], ["Contado", 5]]),
      cuando:repartir(sol, [["Este fin de semana", 52], ["Entre semana por la tarde", 26], ["Entre semana por la mañana", 10], ["Primero quiero más información", 12]]),
      zonas, zonasOtras:Math.max(0, conTrabajo - zonas.reduce((a, z) => a + z.n, 0)),
      lugares:repartir(Math.round(conTrabajo * .7), [["UJED", 5], ["Ciudad Industrial", 4], ["Hospital General 450", 3], ["Centro", 2]]).filter(l => l.n >= 2).map(l => ({texto:l.k, n:l.n})),
      conTrabajo, minutosMediana:14, minGrupo:2};
  }

  /* ===== Gráficas (una sola serie, un solo color; los números siempre visibles o en tabla) ===== */
  function columnasPorSemana(semanas){
    const total = semanas.reduce((a, s) => a + s.n, 0);
    if(!total) return `<p class="vacio-graf">Todavía no hay solicitudes en este periodo.</p>`;
    const max = Math.max(...semanas.map(s => s.n));
    const tope = max <= 5 ? max : Math.ceil(max / 5) * 5;
    const iMax = semanas.findIndex(s => s.n === max), iUlt = semanas.length - 1;
    const cadaCuanto = Math.ceil(semanas.length / 8); // no más de ~8 fechas en el eje
    const cols = semanas.map((s, i) => `<div class="col" tabindex="0" data-tip="Semana del ${fecha(s.inicio)}: ${s.n} ${s.n === 1 ? "solicitud" : "solicitudes"}" aria-label="Semana del ${fecha(s.inicio)}: ${s.n}">
        <span class="c" style="height:${s.n / tope * 100}%"></span>${(i === iMax || i === iUlt) && s.n ? `<span class="etq" style="bottom:${s.n / tope * 100}%">${s.n}</span>` : ""}</div>`).join("");
    const eje = semanas.map((s, i) => `<span>${i % cadaCuanto === 0 ? fecha(s.inicio) : ""}</span>`).join("");
    return `<div class="graf"><div class="eje-y"><span style="top:0">${tope}</span><span style="top:100%">0</span></div><div class="cols">${cols}</div><div class="eje-x">${eje}</div></div>
      <details class="no-imprimir"><summary class="nota" style="cursor:pointer">Ver como tabla</summary><table class="tabla"><tr><th>Semana del</th><th class="n">Solicitudes</th></tr>${semanas.map(s => `<tr><td>${fecha(s.inicio, true)}</td><td class="n">${s.n}</td></tr>`).join("")}</table></details>`;
  }
  function barras(items){
    const total = items.reduce((a, i) => a + i.n, 0);
    if(!total) return `<p class="vacio-graf">Sin datos en este periodo.</p>`;
    const max = Math.max(...items.map(i => i.n));
    return `<ul class="barras">${items.map(i => `<li><span class="et">${esc(i.k)}</span><span class="val">${i.n} <small>${pct(i.n, total)}%</small></span><span class="riel"><span class="barra" style="width:${i.n / max * 100}%"></span></span></li>`).join("")}</ul>`;
  }
  function tablaDesarrollos(lista){
    if(!lista.length) return `<p class="vacio-graf">Sin datos en este periodo.</p>`;
    const max = Math.max(1, ...lista.map(d => d.solicitudes));
    return `<div class="tabla-envoltura"><table class="tabla"><thead><tr><th>Desarrollo</th><th>Solicitudes</th><th class="n">Vistas</th><th class="n">Solicitudes por cada 100 vistas</th><th class="n">Compartido</th></tr></thead><tbody>
      ${lista.map(d => `<tr><td>${esc(nombreDe(d.id))}</td><td><span class="mini" style="width:${d.solicitudes / max * 120}px"></span>${d.solicitudes}</td><td class="n">${num(d.vistas)}</td><td class="n">${pct(d.solicitudes, d.vistas) ?? "—"}</td><td class="n">${num(d.compartidos)}</td></tr>`).join("")}
    </tbody></table></div>`;
  }

  /* ===== Pintar ===== */
  let mapa = null;
  function pintar(r){
    const des = r.desarrollo ? porId(r.desarrollo) : null;
    const t = r.totales, conversion = pct(t.solicitudes, t.vistas);
    let h = r.demo ? `<p class="demo">EJEMPLO · Estos números son inventados para mostrar cómo se ve el reporte. No los enseñes como reales.</p>` : "";
    if(!r.medicion.ok) h += `<p class="alerta">Las vistas y los compartidos no están disponibles: ${esc(r.medicion.motivo)}</p>`;
    h += `<h1>${des ? esc(des.nombre) : "Todos los desarrollos"}</h1>
      <p class="subtitulo">Interés en ARVENTA del ${fecha(r.desde, true)} al ${fecha(r.hasta, true)}${des ? ` · ${{casa:"Casas", departamento:"Departamentos", terreno:"Terrenos"}[des.tipo]} desde ${dinero(des.desde)}` : ""}</p>
      <div class="tiles">
        <div class="tile hero"><span class="et">Solicitudes de visita</span><span class="v">${num(t.solicitudes)}</span><span class="nota">personas que pidieron visitar</span></div>
        <div class="tile"><span class="et">Vistas de la ficha</span><span class="v">${r.medicion.ok ? num(t.vistas) : "—"}</span><span class="nota">veces que se abrió${des ? "" : " cada desarrollo"}</span></div>
        <div class="tile"><span class="et">Piden visita</span><span class="v">${r.medicion.ok && conversion != null ? conversion : "—"}</span><span class="nota">de cada 100 vistas</span></div>
        <div class="tile"><span class="et">Compartido por WhatsApp</span><span class="v">${r.medicion.ok ? num(t.compartidos) : "—"}</span><span class="nota">veces</span></div>
      </div>`;
    if(t.confirmadas != null) h += `<p class="nota" style="margin-top:12px">Verificadas por el cliente: <b>${num(t.confirmadas)}</b> · Enviadas a la desarrolladora: <b>${num(t.enviadas || 0)}</b> · Llegada verificada: <b>${num(t.llegadas || 0)}</b> · Cotizaciones: <b>${num(t.cotizaciones || 0)}</b></p>`;
    h += `<section class="seccion"><h2>Solicitudes por semana</h2><p class="nota">Pasa el dedo o el cursor por una columna para ver la semana.</p>${columnasPorSemana(r.semanas)}</section>`;
    if(!des) h += `<section class="seccion"><h2>Por desarrollo</h2><p class="nota">Ordenado por solicitudes.</p>${tablaDesarrollos(r.desarrollos)}</section>`;
    h += `<div class="dos-col">
      <section class="seccion"><h2>Cómo pagarían</h2><p class="nota">Lo que eligieron al pedir la visita.</p>${barras(r.pago)}</section>
      <section class="seccion"><h2>Cuándo quieren visitar</h2><p class="nota">&nbsp;</p>${barras(r.cuando)}</section>
    </div>`;
    if(!des && (r.presupuestos?.length || r.busquedas?.length)) h += `<div class="dos-col">
      <section class="seccion"><h2>Presupuesto que buscan</h2><p class="nota">Lo que eligieron en “¿Hasta cuánto quieres pagar?”.</p>${barras(r.presupuestos || [])}</section>
      <section class="seccion"><h2>Lo que más buscan</h2><p class="nota">Búsquedas que se repiten (${r.minGrupo}+ veces).</p>${barras((r.busquedas || []).map(b => ({k:b.texto, n:b.n})))}</section>
    </div>`;
    if(r.estados?.length) h += `<section class="seccion"><h2>En qué van las solicitudes</h2>${barras(r.estados.map(e => ({k:e.k.replace(/_/g, " "), n:e.n})))}</section>`;
    const conZonas = r.zonas.length > 0;
    h += `<section class="seccion"><h2>Dónde trabajan los interesados</h2>
      <p class="nota">${r.conTrabajo ? `${r.conTrabajo} de ${t.solicitudes} dijeron dónde trabajan${r.minutosMediana != null ? `; la mitad tarda ${r.minutosMediana} minutos o menos en auto hasta ${des ? "aquí" : "el desarrollo que eligió"}` : ""}.` : "Nadie ha dicho dónde trabaja en este periodo."}</p>
      ${conZonas ? `<div id="mapa-zonas" role="img" aria-label="Mapa de zonas de trabajo de los interesados"></div>` : ""}
      ${r.lugares.length ? `<h3>Lugares que más se repiten</h3><ul class="lugares">${r.lugares.map(l => `<li><span>${esc(l.texto)}</span><b>${l.n}</b></li>`).join("")}</ul>` : ""}
      ${r.zonasOtras ? `<p class="nota">${r.zonasOtras} ${r.zonasOtras === 1 ? "persona trabaja" : "personas trabajan"} en zonas donde no hay nadie más; no se muestran para que nadie sea identificable.</p>` : ""}
    </section>`;
    h += `<section class="metodo"><b>Cómo se cuentan estos números</b><ul>
      <li><b>Solicitudes:</b> cada vez que alguien pide visita en ARVENTA queda registrada con folio y fecha.</li>
      <li><b>Vistas:</b> veces que se abrió la ficha del desarrollo, medidas de forma anónima sin cookies. Una misma persona puede abrirla varias veces, y quien tiene activado “No rastrear” no se cuenta.</li>
      <li><b>Zonas de trabajo:</b> redondeadas a cerca de 1 km y mostradas solo cuando las comparten ${r.minGrupo || 2} o más personas. Este reporte no incluye nombres ni teléfonos.</li>
      <li>Generado el ${new Date().toLocaleDateString("es-MX", {day:"numeric", month:"long", year:"numeric"})}.</li>
    </ul></section>`;
    $("#contenido").innerHTML = h;
    document.title = `${des ? des.nombre : "Todos los desarrollos"} · Reporte ARVENTA`;
    if(conZonas) pintarMapa(r, des);
  }
  function pintarMapa(r, des){
    if(mapa){ mapa.remove(); mapa = null; }
    mapa = L.map("mapa-zonas", {scrollWheelZoom:false});
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom:18, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(mapa);
    const pts = [];
    const max = Math.max(...r.zonas.map(z => z.n));
    r.zonas.forEach(z => {
      L.circleMarker([z.lat, z.lng], {radius:8 + 16 * Math.sqrt(z.n / max), color:"#fff", weight:2, fillColor:"#16806A", fillOpacity:.6})
        .bindTooltip(`${z.n} ${z.n === 1 ? "persona" : "personas"} trabajan en esta zona`).addTo(mapa);
      pts.push([z.lat, z.lng]);
    });
    if(des && des.lat != null){
      L.marker([des.lat, des.lng], {icon:L.divIcon({className:"", html:`<span style="display:inline-block;transform:translate(-50%,-100%);background:#1D2B3A;color:#fff;border-radius:999px;padding:3px 10px;font-weight:700;font-size:13px;white-space:nowrap">${esc(des.nombre)}</span>`, iconSize:[0, 0]})}).addTo(mapa);
      pts.push([des.lat, des.lng]);
    }
    mapa.fitBounds(L.latLngBounds(pts).pad(.3), {maxZoom:14});
  }

  // Globo de ayuda para las columnas (cursor y teclado)
  const tip = $("#tip");
  function mostrarTip(el){ const b = el.getBoundingClientRect(); tip.textContent = el.dataset.tip; tip.hidden = false; tip.style.left = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, b.left + b.width / 2 - tip.offsetWidth / 2)) + "px"; tip.style.top = (b.top - 36) + "px"; }
  document.addEventListener("pointerover", e => { const c = e.target.closest(".col"); c ? mostrarTip(c) : (tip.hidden = true); });
  document.addEventListener("focusin", e => { const c = e.target.closest(".col"); c ? mostrarTip(c) : (tip.hidden = true); });
  addEventListener("scroll", () => tip.hidden = true, {passive:true});

  /* ===== Flujo ===== */
  async function cargar(){
    actualizarDireccion();
    $("#acceso").hidden = true; $("#reporte").hidden = false;
    $("#contenido").innerHTML = `<p class="vacio-graf">Cargando…</p>`;
    try{ pintar(await traer()); }
    catch(e){
      if(e.clave){ guardar("arventa-clave", null); pedirClave(e.message); return; }
      $("#contenido").innerHTML = `<p class="alerta">No se pudo cargar el reporte. ${esc(e.message || "")}</p>`;
    }
  }
  function pedirClave(error){
    $("#reporte").hidden = true; $("#acceso").hidden = false;
    $("#clave-error").textContent = error || ""; $("#clave-error").hidden = !error;
    $("#clave").focus();
  }
  $("#form-clave").addEventListener("submit", e => { e.preventDefault(); guardar("arventa-clave", $("#clave").value.trim()); demo = false; cargar(); });
  $("#ver-demo").addEventListener("click", e => { e.preventDefault(); demo = true; cargar(); });
  $("#sel-desarrollo").onchange = e => { estado.d = e.target.value; cargar(); };
  $("#sel-dias").onchange = e => { estado.dias = e.target.value; cargar(); };
  $("#imprimir").onclick = () => print();
  $("#salir").onclick = () => { guardar("arventa-clave", null); demo = false; history.replaceState(null, "", location.pathname); pedirClave(); };

  if(demo || leer("arventa-clave")) cargar(); else pedirClave();
})();
