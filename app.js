const DESARROLLOS = window.DESARROLLOS;
/* ===== Configuración ===== */
// Pon aquí tu número de WhatsApp con lada de país, sin espacios. Ej. "5216181234567".
const WHATSAPP = "";
const CENTRO = [24.0248, -104.6705]; // Catedral de Durango
const CAJA = {s:23.95, w:-104.77, n:24.10, e:-104.56}; // área de la ciudad para buscar lugares cercanos

/* ===== Lugares cercanos ===== */
const CATS = {
  escuela:{ico:"🎒", nombre:"Escuela", plural:"escuelas", f:1},
  oxxo:{ico:"🏪", nombre:"OXXO", plural:"OXXOs"},
  super:{ico:"🛒", nombre:"Supermercado", plural:"supermercados"},
  farmacia:{ico:"💊", nombre:"Farmacia", plural:"farmacias", f:1},
  salud:{ico:"🏥", nombre:"Hospital o clínica", plural:"hospitales y clínicas"},
  parque:{ico:"🌳", nombre:"Parque", plural:"parques"},
  uni:{ico:"🎓", nombre:"Universidad", plural:"universidades", f:1}
};
let LUGARES = null; // [{cat,nombre,lat,lng}]

function consultaOverpass(){
  const b = `${CAJA.s},${CAJA.w},${CAJA.n},${CAJA.e}`;
  return `[out:json][timeout:60];(
    nwr["amenity"~"^(school|kindergarten)$"](${b});
    nwr["shop"]["brand"~"oxxo",i](${b});
    nwr["shop"]["name"~"^oxxo",i](${b});
    nwr["shop"="supermarket"](${b});
    nwr["amenity"="pharmacy"](${b});
    nwr["amenity"~"^(hospital|clinic)$"](${b});
    nwr["leisure"="park"](${b});
    nwr["amenity"="university"](${b});
  );out center tags;`;
}
function categoria(t){
  if(/oxxo/i.test(t.brand||"")||/^oxxo/i.test(t.name||"")) return "oxxo";
  if(t.amenity==="school"||t.amenity==="kindergarten") return "escuela";
  if(t.shop==="supermarket") return "super";
  if(t.amenity==="pharmacy") return "farmacia";
  if(t.amenity==="hospital"||t.amenity==="clinic") return "salud";
  if(t.leisure==="park") return "parque";
  if(t.amenity==="university") return "uni";
  return null;
}
async function cargarLugares(){
  try{
    const g = localStorage.getItem("lugares-v1");
    if(g){ const o = JSON.parse(g); if(Date.now()-o.t < 7*864e5){ LUGARES=o.d; return; } }
  }catch(e){}
  estado("Buscando escuelas, OXXOs y hospitales cerca de cada desarrollo…");
  const servidores = ["https://overpass-api.de/api/interpreter","https://overpass.kumi.systems/api/interpreter"];
  for(const url of servidores){
    try{
      const r = await fetch(url,{method:"POST",body:"data="+encodeURIComponent(consultaOverpass()),headers:{"Content-Type":"application/x-www-form-urlencoded"}});
      if(!r.ok) continue;
      const j = await r.json();
      LUGARES = j.elements.map(e=>{
        const t=e.tags||{}; const c=categoria(t); const lat=e.lat??e.center?.lat; const lng=e.lon??e.center?.lon;
        if(!c||lat==null) return null;
        return {cat:c, nombre:t.name||CATS[c].nombre, lat, lng};
      }).filter(Boolean);
      try{ localStorage.setItem("lugares-v1", JSON.stringify({t:Date.now(), d:LUGARES})); }catch(e){}
      estado("");
      return;
    }catch(e){}
  }
  estado("No se pudieron cargar los lugares cercanos. Revisa tu conexión y recarga la página.");
}

/* ===== Utilidades ===== */
const $ = s => document.querySelector(s);
function estado(t){ $("#estado").textContent=t; }
function dinero(n){ return "$"+Math.round(n).toLocaleString("es-MX"); }
function corto(n){ return n>=1e6 ? "$"+(n/1e6).toLocaleString("es-MX",{maximumFractionDigits:2})+" M" : "$"+Math.round(n/1e3)+" mil"; }
function metros(a,b){ // distancia en línea recta (m)
  const R=6371000, r=Math.PI/180, dLat=(b.lat-a.lat)*r, dLng=(b.lng-a.lng)*r;
  const x=Math.sin(dLat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(x));
}
function textoDist(m){ return m<1000 ? Math.round(m/10)*10+" m" : (m/1000).toLocaleString("es-MX",{maximumFractionDigits:1})+" km"; }
function minCaminando(m){ return Math.max(1,Math.round(m*1.3/80)); } // calles no son línea recta; 80 m/min
function esc(s){ return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

function cercanos(d){
  if(!LUGARES||d.lat==null) return null;
  const p={lat:d.lat,lng:d.lng}; const res={}; const conteo={};
  for(const l of LUGARES){
    const m=metros(p,l);
    if(m<=1000) conteo[l.cat]=(conteo[l.cat]||0)+1;
    if(!res[l.cat]||m<res[l.cat].m) res[l.cat]={...l,m};
  }
  return {mas:res, conteo};
}

/* ===== Trabajo y tiempos ===== */
let TRABAJO = null; // {lat,lng,nombre}
let MINUTOS = {};   // id -> minutos en auto
async function geocodificar(q){
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.search = new URLSearchParams({q:q+", Durango, Durango, México", format:"json", limit:"1", countrycodes:"mx",
    viewbox:`${CAJA.w},${CAJA.n},${CAJA.e},${CAJA.s}`, bounded:"1"});
  const r = await fetch(u,{headers:{"Accept-Language":"es"}});
  const j = await r.json();
  return j[0] ? {lat:+j[0].lat, lng:+j[0].lon, nombre:q} : null;
}
async function calcularTiempos(){
  MINUTOS={};
  const conUbic = DESARROLLOS.filter(d=>d.lat!=null);
  estado("Calculando cuánto tardas desde cada desarrollo…");
  try{
    const coords=[[TRABAJO.lng,TRABAJO.lat],...conUbic.map(d=>[d.lng,d.lat])].map(c=>c.join(",")).join(";");
    const fuentes=conUbic.map((_,i)=>i+1).join(";");
    const r=await fetch(`https://router.project-osrm.org/table/v1/driving/${coords}?sources=${fuentes}&destinations=0&annotations=duration`);
    const j=await r.json();
    if(j.code!=="Ok") throw new Error(j.code);
    conUbic.forEach((d,i)=>{ const s=j.durations[i][0]; if(s!=null) MINUTOS[d.id]=Math.max(1,Math.round(s/60)); });
    estado("");
  }catch(e){
    // Sin servicio de rutas: estimación por distancia a 28 km/h promedio en ciudad
    conUbic.forEach(d=>{ MINUTOS[d.id]=Math.max(1,Math.round(metros(d,TRABAJO)*1.35/1000/28*60)); });
    estado("Tiempos aproximados por distancia. El servicio de rutas no respondió.");
  }
}
function ponerTrabajo(t){
  TRABAJO=t;
  if(capaTrabajo) capaTrabajo.remove();
  capaTrabajo=L.marker([t.lat,t.lng],{icon:L.divIcon({className:"",html:'<div class="yo"><span>💼</span></div>',iconSize:[0,0]}),keyboard:false,title:"Tu trabajo"}).addTo(mapa);
  $("#ayuda-trabajo").innerHTML = `Ordenado por minutos en auto a <b>${esc(t.nombre)}</b>. <button type="button" id="quitar">Quitar</button>`;
  $("#quitar").onclick=()=>{ TRABAJO=null; MINUTOS={}; capaTrabajo.remove(); capaTrabajo=null; restaurarAyuda(); pintar(); };
  calcularTiempos().then(()=>{ pintar(); if(abierto) abrir(abierto,false); });
}
function restaurarAyuda(){
  $("#ayuda-trabajo").innerHTML='O <button type="button" id="marcar">márcalo en el mapa</button> y ordenamos todo por minutos de camino.';
  $("#marcar").onclick=iniciarMarcar;
}

/* ===== Mapa ===== */
const mapa = L.map("mapa",{zoomControl:false,attributionControl:true}).setView([24.018,-104.655],13);
L.control.zoom({position:"topright"}).addTo(mapa);
L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",{
  maxZoom:19, subdomains:"abcd",
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
}).addTo(mapa);
const capaPines = L.layerGroup().addTo(mapa);
const capaRadar = L.layerGroup().addTo(mapa);
let capaTrabajo=null, abierto=null, marcando=false;

function iniciarMarcar(){ marcando=true; $("#app").classList.add("marcando"); }
mapa.on("click",e=>{
  if(!marcando) return;
  marcando=false; $("#app").classList.remove("marcando");
  ponerTrabajo({lat:e.latlng.lat,lng:e.latlng.lng,nombre:"el punto que marcaste"});
});

function pintarPines(lista){
  capaPines.clearLayers();
  for(const d of lista){
    if(d.lat==null) continue;
    const min = MINUTOS[d.id]!=null ? `<span class="min">${MINUTOS[d.id]} min</span>` : "";
    const activo = abierto ? (abierto.id===d.id ? " activo" : " tenue") : "";
    const m=L.marker([d.lat,d.lng],{icon:L.divIcon({className:"",html:`<span class="pin${activo}">${corto(d.desde)}${min}</span>`,iconSize:[0,0]}),title:d.nombre,riseOnHover:true,zIndexOffset:activo===" activo"?1000:0});
    m.on("click",()=>abrir(d));
    capaPines.addLayer(m);
  }
}

/* El radar: al abrir un desarrollo dibuja anillos de 5 y 10 minutos caminando y líneas a lo más cercano */
function pintarRadar(d,c){
  capaRadar.clearLayers();
  if(d.lat==null) return;
  const p=[d.lat,d.lng];
  L.circle(p,{radius:310,color:"#2F6B5E",weight:1.5,dashArray:"4 6",fillColor:"#2F6B5E",fillOpacity:.06,interactive:false}).addTo(capaRadar);
  L.circle(p,{radius:615,color:"#2F6B5E",weight:1,dashArray:"2 8",fill:false,interactive:false}).addTo(capaRadar);
  if(!c) return;
  const pts=[p];
  for(const k of ["escuela","oxxo","super","farmacia","salud","parque"]){
    const l=c.mas[k]; if(!l||l.m>3000) continue;
    L.polyline([p,[l.lat,l.lng]],{color:"#F0A202",weight:3,opacity:.9,interactive:false}).addTo(capaRadar);
    L.marker([l.lat,l.lng],{icon:L.divIcon({className:"",html:`<div class="poi" title="${esc(l.nombre)}">${CATS[k].ico}</div><span class="poi-etq">${textoDist(l.m)}</span>`,iconSize:[0,0]}),keyboard:false,title:l.nombre}).addTo(capaRadar);
    pts.push([l.lat,l.lng]);
  }
  if(TRABAJO) pts.push([TRABAJO.lat,TRABAJO.lng]);
  mapa.flyToBounds(L.latLngBounds(pts).pad(.25),{maxZoom:16,duration:.6});
}

/* ===== Panel ===== */
const filtro={tipo:"todos", max:null};
function visibles(){
  return DESARROLLOS.filter(d=>(filtro.tipo==="todos"||d.tipo===filtro.tipo)&&(!filtro.max||d.desde<=filtro.max));
}
function ordenar(l){
  return [...l].sort((a,b)=>{
    if(TRABAJO){ const x=MINUTOS[a.id]??1e9, y=MINUTOS[b.id]??1e9; if(x!==y) return x-y; }
    return a.desde-b.desde;
  });
}
function resumenCorto(d){
  const c=cercanos(d); if(!c) return "";
  const e=c.mas.escuela, o=c.mas.oxxo;
  const partes=[];
  if(e) partes.push(`escuela a ${textoDist(e.m)}`);
  if(o) partes.push(`OXXO a ${textoDist(o.m)}`);
  return partes.length? "Tiene "+partes.join(" y ") : "";
}
function fila(d){
  const tipo={casa:"Casas",departamento:"Departamentos",terreno:"Terrenos"}[d.tipo];
  const min = MINUTOS[d.id]!=null ? `<span class="minutos">${MINUTOS[d.id]} min a tu trabajo</span>` : "";
  const extra = resumenCorto(d);
  return `<li class="item" tabindex="0" role="button" data-id="${d.id}" aria-current="${abierto&&abierto.id===d.id}">
    <h3>${esc(d.nombre)}</h3><span class="precio">desde ${corto(d.desde)}</span>
    <span class="datos">${tipo} · ${esc(d.recamaras)} rec. · ${esc(d.zona)}</span>${min}
    ${extra?`<span class="datos" style="grid-column:1/-1;color:var(--agave)">${extra}</span>`:""}
  </li>`;
}
function pintar(){
  const l=ordenar(visibles());
  pintarPines(l);
  if(abierto) return; // el detalle está abierto
  $("#vista-lista").hidden=false;
  const enMapa=l.filter(d=>d.lat!=null), sinMapa=l.filter(d=>d.lat==null);
  let h="";
  if(!l.length) h=`<p class="vacio">No hay desarrollos con esos filtros. Prueba subir el precio máximo o elegir “Todo”.</p>`;
  if(enMapa.length) h+=`<ul class="lista">${enMapa.map(fila).join("")}</ul>`;
  if(sinMapa.length) h+=`<p class="seccion-lista">Ubicación por confirmar (aún no salen en el mapa)</p><ul class="lista">${sinMapa.map(fila).join("")}</ul>`;
  h+=`<p class="aviso">Precios publicados en portales inmobiliarios en noviembre de 2026; pueden cambiar sin aviso. Las ubicaciones en el mapa son aproximadas por zona.</p>`;
  $("#cuerpo").innerHTML=h;
  $("#cuerpo").querySelectorAll(".item").forEach(el=>{
    const d=DESARROLLOS.find(x=>x.id===el.dataset.id);
    el.onclick=()=>abrir(d);
    el.onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); abrir(d); } };
  });
}

/* Precio por m² frente al promedio de los desarrollos del mismo tipo */
function m2Numero(d){ const m=String(d.m2).match(/(\d+)/); return m?+m[1]:null; }

function abrir(d, mover=true){
  abierto=d;
  $("#vista-lista").hidden=true;
  const c=cercanos(d);
  const tipo={casa:"Casas",departamento:"Departamentos",terreno:"Terrenos"}[d.tipo];
  let cerca="";
  if(d.lat==null){
    cerca=`<p class="nota">Todavía no tenemos la ubicación exacta de este desarrollo. En cuanto la confirmemos verás aquí qué tiene cerca.</p>`;
  }else if(!c){
    cerca=`<p class="nota">Cargando lugares cercanos…</p>`;
  }else{
    const n=c.conteo, frases=[];
    if(n.escuela) frases.push(`${n.escuela} ${n.escuela===1?"escuela":"escuelas"}`);
    if(n.oxxo) frases.push(`${n.oxxo} ${n.oxxo===1?"OXXO":"OXXOs"}`);
    if(n.farmacia) frases.push(`${n.farmacia} ${n.farmacia===1?"farmacia":"farmacias"}`);
    if(n.super) frases.push(`${n.super} ${n.super===1?"supermercado":"supermercados"}`);
    const filas=Object.keys(CATS).filter(k=>c.mas[k]&&c.mas[k].m<=5000).map(k=>{
      const l=c.mas[k]; const cam=minCaminando(l.m);
      const modo = cam<=20 ? `${cam} min caminando` : `${Math.max(2,Math.round(l.m*1.35/1000/28*60))} min en auto`;
      return `<li><span class="ico" aria-hidden="true">${CATS[k].ico}</span><span class="nombre">${esc(l.nombre)}<small>${CATS[k].nombre} más ${CATS[k].f?"cercana":"cercano"}</small></span><span class="dist">${textoDist(l.m)}<small>${modo}</small></span></li>`;
    }).join("");
    cerca=`${frases.length?`<p class="resumen-cerca">A menos de 1 km tienes <b>${frases.join(", ")}</b>.</p>`:""}<ul class="cerca">${filas}</ul>
      <p class="nota">Distancias en línea recta según OpenStreetMap; el tiempo caminando considera las vueltas de las calles.</p>`;
  }
  const tray = d.lat==null ? "" : TRABAJO && MINUTOS[d.id]!=null
    ? `<div class="trayecto"><b>${MINUTOS[d.id]} min</b><span>en auto a ${esc(TRABAJO.nombre)}</span></div>`
    : `<p class="nota" style="margin:0">Escribe dónde trabajas, arriba en la lista, y te decimos cuántos minutos haces desde aquí.</p>`;
  // precio por m² comparado
  let comp="";
  const m=m2Numero(d);
  if(m && d.tipo!=="terreno"){
    const pares=DESARROLLOS.filter(x=>x.tipo===d.tipo&&m2Numero(x)).map(x=>x.desde/m2Numero(x));
    const prom=pares.reduce((a,b)=>a+b,0)/pares.length, mio=d.desde/m;
    if(mio<prom*0.97) comp=`<li>Su precio por m² (${dinero(mio)}) está <b>${Math.round((1-mio/prom)*100)}% abajo</b> del promedio de los ${d.tipo==="casa"?"fraccionamientos":"edificios"} nuevos de esta lista.</li>`;
  }
  const ventajas=[...(d.ventajas||[])].map(v=>`<li>${esc(v)}</li>`).join("")+comp+(d.entrega?`<li>Entrega: ${esc(d.entrega)}</li>`:"")+(d.modelos?`<li>${esc(d.modelos)}</li>`:"");
  const preventa = `<li>Comprar en preventa suele salir entre 10% y 20% más barato que una vivienda ya terminada.</li>`;

  $("#cuerpo").innerHTML=`<div class="detalle">
    <button class="volver" type="button" id="volver">Ver todos los desarrollos</button>
    <h2>${esc(d.nombre)}</h2>
    <p class="zona">${tipo}. ${esc(d.zona)}${d.aprox?" (ubicación aproximada)":""}</p>
    <p class="precio-grande">desde ${dinero(d.desde)}${d.hasta?`<small>hasta ${dinero(d.hasta)} según modelo</small>`:""}</p>
    <ul class="specs"><li><b>${esc(d.recamaras)}</b> recámaras</li><li><b>${esc(d.m2)}</b></li>${d.desarrolladora?`<li>Por ${esc(d.desarrolladora)}</li>`:""}</ul>
    <section class="bloque"><h3>Qué tienes cerca</h3>${cerca}</section>
    <section class="bloque"><h3>Tu camino al trabajo</h3>${tray}</section>
    <section class="bloque"><h3>Lo mejor de aquí</h3><ul class="ventajas">${ventajas}${d.tipo!=="terreno"?preventa:""}</ul></section>
    <section class="bloque"><h3>¿Cuánto pagarías al mes?</h3>
      <div class="calc">
        <label>Precio<input id="c-precio" type="number" min="0" step="1000" value="${d.desde}"></label>
        <label>Enganche<select id="c-eng"><option value="0.1">10%</option><option value="0.15">15%</option><option value="0.2" selected>20%</option><option value="0.3">30%</option></select></label>
        <label>Tasa anual<input id="c-tasa" type="number" min="1" max="30" step="0.05" value="11"></label>
        <label>Plazo<select id="c-plazo"><option>10</option><option>15</option><option selected>20</option></select></label>
        <div class="mensual" aria-live="polite"><small>Mensualidad estimada con banco</small><b id="c-res"></b><small id="c-eng-txt"></small></div>
      </div>
      <p class="nota">Estimación sin seguros ni comisiones. Las tasas hipotecarias en México van de 9.05% a 13% según el banco. Con Infonavit el monto depende de tu salario y tu ahorro.</p>
    </section>
    <section class="bloque fuentes"><h3 style="font-size:15px">De dónde salen estos datos</h3>
      Visto en ${d.fuentes.map((f,i)=>`<a href="${f[1]}" target="_blank" rel="noopener">${esc(f[0])}${d.fuentes.filter(x=>x[0]===f[0]).length>1?" ("+(d.fuentes.slice(0,i+1).filter(x=>x[0]===f[0]).length)+")":""}</a>`).join(", ")}. Precios de noviembre de 2026, sujetos a cambio.
    </section>
  </div>
  <div class="acciones"><button class="btn" type="button" id="agendar">Agendar visita</button></div>`;
  $("#volver").onclick=cerrar;
  $("#agendar").onclick=()=>agendar(d);
  ["c-precio","c-eng","c-tasa","c-plazo"].forEach(id=>$("#"+id).oninput=calcular);
  calcular();
  $("#cuerpo").scrollTop=0;
  if(matchMedia("(max-width:820px)").matches) window.scrollTo({top:0});
  pintarPines(ordenar(visibles()));
  if(mover) pintarRadar(d,c); else if(d.lat!=null) pintarRadar(d,c);
  if(d.lat==null){ capaRadar.clearLayers(); }
  try{ history.replaceState(null,"","#"+d.id); }catch(e){}
}
function cerrar(){ abierto=null; capaRadar.clearLayers(); try{ history.replaceState(null,"",location.pathname); }catch(e){} pintar(); }

function calcular(){
  const P=+$("#c-precio").value||0, e=+$("#c-eng").value, t=(+$("#c-tasa").value||0)/100/12, n=+$("#c-plazo").value*12;
  const monto=P*(1-e);
  const pago = t>0 ? monto*t/(1-Math.pow(1+t,-n)) : monto/n;
  $("#c-res").textContent=dinero(pago)+" al mes";
  $("#c-eng-txt").textContent=`Enganche de ${dinero(P*e)} y crédito de ${dinero(monto)} a ${n/12} años`;
}

/* ===== Agendar visita ===== */
let visitaDe=null;
function agendar(d){ visitaDe=d; $("#visita-a").textContent=`${d.nombre}, desde ${dinero(d.desde)}`; $("#dlg-visita").showModal(); }
$("#form-visita").addEventListener("submit",e=>{
  if(e.submitter && e.submitter.value==="cancelar") return;
  e.preventDefault();
  const msg=`Hola, quiero visitar ${visitaDe.nombre} (desde ${dinero(visitaDe.desde)}).\nNombre: ${$("#v-nombre").value}\nWhatsApp: ${$("#v-tel").value}\nCuándo: ${$("#v-cuando").value}\nPago: ${$("#v-credito").value}`;
  $("#dlg-visita").close();
  if(WHATSAPP){ location.href=`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`; }
  else{ $("#txt-copiar").value=msg; $("#dlg-copiar").showModal(); }
});
$("#btn-copiar").onclick=async()=>{ try{ await navigator.clipboard.writeText($("#txt-copiar").value); $("#btn-copiar").textContent="Copiado"; }catch(e){ $("#txt-copiar").select(); } };
$("#cerrar-copiar").onclick=()=>{ $("#dlg-copiar").close(); $("#btn-copiar").textContent="Copiar mensaje"; };

/* ===== Eventos ===== */
document.querySelectorAll(".chip").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".chip").forEach(x=>x.setAttribute("aria-pressed",x===b));
  filtro.tipo=b.dataset.tipo; if(abierto) cerrar(); else pintar();
});
$("#precio-max").onchange=e=>{ filtro.max=e.target.value?+e.target.value:null; if(abierto) cerrar(); else pintar(); };
$("#form-trabajo").addEventListener("submit",async e=>{
  e.preventDefault();
  const q=$("#trabajo").value.trim(); if(!q) return;
  estado("Buscando "+q+"…");
  try{
    const t=await geocodificar(q);
    if(!t){ estado(`No encontramos “${q}” en Durango. Prueba con otra referencia o márcalo en el mapa.`); return; }
    estado(""); ponerTrabajo(t);
  }catch(err){ estado("No se pudo buscar la dirección. Márcala en el mapa."); }
});
$("#marcar").onclick=iniciarMarcar;

/* ===== Inicio ===== */
pintar();
cargarLugares().then(()=>{ if(abierto) abrir(abierto,false); else pintar(); });
const inicial=DESARROLLOS.find(d=>"#"+d.id===location.hash);
if(inicial) abrir(inicial);
