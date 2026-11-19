# ARVENTA

Inmobiliaria de Durango. El sitio reúne toda la vivienda nueva de la ciudad con precios, lo que tienes cerca, cuánto tardas a tu trabajo y si te alcanza con banco o Infonavit, y convierte cada interés en una **solicitud de visita guardada** (que es de donde sale la comisión).

Arquitectura y requisitos para producción: [docs/REQUISITOS.md](docs/REQUISITOS.md). Reglas de trabajo: [CLAUDE.md](CLAUDE.md).

## Cómo trabajar

Necesitas [Node.js](https://nodejs.org) 20 o más reciente.

```
npm install              # una vez (instala solo la herramienta de pruebas)
npm run dev              # abre el sitio en http://localhost:3000 con /api funcionando
```

Para que `/api` guarde de verdad, copia `.env.example` como `.env` y llena las llaves de Supabase. Sin `.env` el sitio funciona igual: las solicitudes se mandan por WhatsApp y quedan en cola en el teléfono.

### Cambiar un desarrollo

1. Edita `data/desarrollos.json` (es la fuente de verdad; cada cambio queda en Git con quién y cuándo).
2. `npm run validar`: revisa que no falte nada. Si hay errores, no se puede publicar.
3. `npm run construir`: genera las páginas de cada desarrollo, la imagen para WhatsApp, `sitemap.xml` y `assets/datos.js`.
4. `npm test`: pruebas automáticas (las mismas que corre GitHub antes de publicar).
5. Commit y push.

Cada desarrollo lleva:

| Campo | Qué es |
|---|---|
| `id` | Parte de la dirección (`/desarrollos/<id>/`). Minúsculas, números y guiones. No lo cambies una vez publicado. |
| `nombre`, `tipo` (`casa`, `departamento`, `terreno`), `desde`, `hasta` | Lo básico. Precios en número, sin comas. |
| `verificado` | Fecha en que confirmaste el precio (`"2026-11-18"`). A los 60 días la ficha dice "precio por confirmar". |
| `fuentes` | `[["Pincali","https://…"]]`, al menos una. |
| `lat`, `lng`, `aprox` | Ubicación. `aprox:true` hasta confirmarla en visita o con la desarrolladora. `null` si no se sabe. |
| `creditos` | Solo los confirmados: `Infonavit`, `Fovissste`, `Banco`, `Cofinavit`, `Contado`. `[]` = por confirmar. |
| `entrega` | `"Preventa"`, `"Entrega inmediata"` o `null`. Opcional `fechaEntrega`. |
| `incluye` | Texto (cocina, closets, boiler…) o `null`. |
| `convenio` | `true` si es anunciante (firmó los términos de anunciante y confirmó sus datos). Con `false` la ficha dice "Información pública de anuncios". |
| `esquemas` | Esquemas de pago **confirmados por escrito** por la desarrolladora (ver abajo). Sin esto, el desarrollo solo muestra la calculadora general. |
| `precios` | Opcional: precio de cada modelo, `[{"modelo":"San Nicolás","precio":1250000}]`. El más bajo debe ser `desde` y el más alto `hasta`. Sin esto, solo se elige entre "desde" y "hasta". **El precio nunca se escribe a mano en el sitio: solo se elige entre estos.** |
| `financiamiento` | Opcional: opciones que dio el proyecto, `{"tasas":[{"nombre":"Banco X (convenio)","tasa":10.5}],"enganches":[10,20],"plazos":[15,20],"confirmado":"2026-11-19","confirmadoPor":"Nombre, puesto"}`. Sin esto, la tasa queda fija en la de referencia (11.3%) y nadie la puede cambiar. |
| `beneficioArventa` | Opcional: lo que el cliente recibe al registrar su llegada (solo si lo acordaste con la desarrolladora). |
| `logo` | Opcional: logo de la desarrolladora para el cotizador de su oficina (`fotos/<id>/logo.webp`). |
| `fotos`, `permisoFotos` | `["fotos/<id>/1.webp"]` o `{"archivo":"…","render":true}` para renders. Solo con permiso por escrito: anota en `permisoFotos` de quién y cuándo. WebP de ~1200 px y menos de 300 KB. |

### Esquemas de pago (corrida financiera)

Solo con lo que la desarrolladora mande por escrito; inventar la corrida sería publicidad engañosa.

```json
"esquemas": [{
  "nombre": "Preventa 5-10-85", "apartado": 50000,
  "enganchePct": 5, "diferidoPct": 10, "diferidoMesesMax": 18, "liquidacionPct": 85,
  "descuentoPct": 0, "creditos": ["Infonavit", "Banco", "Cofinavit", "Contado"],
  "confirmado": "2026-11-20", "confirmadoPor": "Correo de ventas@desarrolladora.mx", "vigenciaDias": 15
}]
```

Enganche + diferido + liquidación deben sumar 100. Con esto aparecen el botón "Arma tu corrida financiera" en la ficha y el cotizador (`/cotizador.html?d=<id>`), que descarga un PDF a nombre del cliente con la leyenda "cotización informativa, sujeta a disponibilidad y cambio de precio", fecha y vigencia. Para la oficina de ventas: `/cotizador.html?d=<id>&modo=oficina`.

## Estructura

| Ruta | Qué tiene |
|---|---|
| `index.html` | Buscador, tarjetas, mapa y ficha (la app) |
| `desarrollos/<id>/` | **Generado**: página real de cada desarrollo (Google, WhatsApp, sin JavaScript) e imagen `og.png` |
| `assets/` | `app.js`, `estilos.css`, `config.js` (configuración pública), `datos.js` (**generado**) |
| `data/desarrollos.json` | Fuente de verdad de los desarrollos |
| `data/lugares-osm.json` | Escuelas, OXXOs, súper, etc. de OpenStreetMap (se actualiza cada lunes) |
| `data/lugares.json` | **Generado**: lo que hay cerca de cada desarrollo |
| `api/` | Funciones de Vercel: `visita`, `evento`, `contacto`, `reporte`, `salud` |
| `supabase/esquema.sql` | Tablas, reglas de acceso y borrado a los 12 meses |
| `scripts/` | `validar`, `construir`, `lugares`, `servidor` (local), `respaldo` |
| `tests/` | Pruebas de `/api` y del sitio (Playwright) |
| `.github/workflows/` | Pruebas en cada cambio, lugares cada semana, respaldo cifrado cada semana |
| `vercel.json` | Encabezados de seguridad y caché |
| `anuncia.html`, `aviso-privacidad.html`, `terminos.html`, `reporte.html` | Páginas para desarrolladoras, legales y reporte |
| `panel.html` | Tu panel (solo ARVENTA): el camino de cada solicitud por WhatsApp |

## Puesta en marcha (una sola vez)

Todo lo que es código ya está hecho; esto son cuentas y configuración que solo tú puedes crear.

**1. Supabase (base de datos)**
1. Crea el proyecto en [supabase.com](https://supabase.com).
2. Database → Extensions → activa **pg_cron**.
3. SQL Editor → pega [`supabase/esquema.sql`](supabase/esquema.sql) → Run.
4. Project Settings → API: copia la URL y la llave **service_role** (es secreta: solo va en Vercel).
5. Respaldo diario: el plan gratis no guarda copias automáticas; el plan Pro sí. Mientras tanto queda el respaldo semanal cifrado de GitHub (paso 4).

**2. Vercel (el sitio)**
1. En [vercel.com](https://vercel.com) importa este repositorio de GitHub. No necesita comando de construcción.
2. Settings → Environment Variables: copia las de [`.env.example`](.env.example) con sus valores (Production y Preview).
3. Settings → Domains: agrega `arventa.mx` (Vercel da el HTTPS).
4. Cada rama o pull request genera una vista previa; producción sale de `main`.

**3. WhatsApp (todo sale por aquí)**
1. En [Meta for Developers](https://developers.facebook.com) crea una app de tipo Business con **WhatsApp**, registra el número de ARVENTA y genera un token permanente (usuario del sistema). Pon `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID`, y tu número en `ARVENTA_WHATSAPP`.
2. En WhatsApp Manager → Plantillas crea estas tres (categoría **Utilidad**, idioma **Español (MEX)**) y espera a que las aprueben:
   - `arventa_verificar`: "Hola {{1}}, recibimos tu solicitud para visitar {{2}}. Para confirmarla toca aquí: {{3}}"
   - `arventa_cita`: "Nueva cita de ARVENTA {{1}} para {{2}}. {{3}}"
   - `arventa_aviso`: "Aviso de ARVENTA: {{1}}"
3. Mientras eso queda, tus avisos pueden llegar por [CallMeBot](https://www.callmebot.com/blog/free-api-whatsapp-messages/) (`CALLMEBOT_TELEFONO`, `CALLMEBOT_APIKEY`), y en tu panel cada mensaje se abre en WhatsApp ya escrito para que lo mandes tú. Nada se pierde.

**4. GitHub**
1. Activa la autenticación en dos pasos (también en Vercel y Supabase).
2. Settings → Branches → protege `main` y exige que pase **Revisar y probar**: así nada roto llega a producción.
3. Settings → Secrets → Actions: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `RESPALDO_CLAVE` (contraseña para cifrar el respaldo; guárdala aparte).

**5. Que no se caiga**
1. [UptimeRobot](https://uptimerobot.com) o Better Stack: monitorea cada 5 minutos `https://arventa.mx/` y `https://arventa.mx/api/salud`. `/api/salud` falla también si una solicitud lleva 10 minutos sin aviso.
2. [Sentry](https://sentry.io) (plan gratis): proyecto "Browser JavaScript"; pega su *Loader Script* en `SENTRY_LOADER` de `assets/config.js`. Los errores de `/api` se ven en Vercel → Logs.
3. Mapa con llave propia: crea una llave en [MapTiler](https://cloud.maptiler.com), restríngela a `arventa.mx` y ponla en `MAPA` de `assets/config.js`.

**6. Que te encuentren**
1. [Google Search Console](https://search.google.com/search-console): agrega `arventa.mx` y envía `https://arventa.mx/sitemap.xml`.
2. [Perfil de Google Business](https://business.google.com) de ARVENTA en Durango.
3. Analítica: cuenta en [Umami](https://cloud.umami.is) y pon el Website ID en `UMAMI_ID` de `assets/config.js`.

**7. Legal** (detalle en `CLAUDE.md`)
- Razón social, domicilio y correo en `assets/config.js` (salen en el pie, el aviso y los términos).
- Confirmar con un abogado que, como portal que no intermedia, ARVENTA no necesita licencia de asesor ni registro antilavado, y firmar los términos de anunciante con cada desarrolladora (precio por cita, cita válida, reclamos y facturación).

## Operación diaria

Todo pasa por WhatsApp y lo sigues en **tu panel**: `https://arventa.mx/panel.html` con tu clave (`REPORTE_CLAVE`). Nadie más tiene panel.

1. **Nueva**: llega la solicitud y al cliente le sale solo un WhatsApp con su enlace para confirmar. Tú recibes el aviso.
2. **Verificada**: el cliente tocó "Confirmo mi visita". Es la prueba de que la cita es real.
3. **Enviada**: en ese momento sale por WhatsApp la ficha de la cita a quien comercializa el desarrollo (nombre, WhatsApp, cuándo, cómo pagaría, presupuesto, zona de trabajo y lo que también vio: solo lo que el cliente aceptó compartir), con fecha y hora. **Esto es lo que se cobra.**
4. **Visita hecha**: el cliente tocó "Ya llegué" a menos de 300 m (si el desarrollo tiene `aprox:false`), o tú la marcas.
5. **Inválida**: si el asesor te escribe que el teléfono es falso, que es repetida o que ya era su cliente (con prueba de los 60 días anteriores), la marcas en el panel con el motivo. No se cobra.

- **A quién se manda cada cita**: registra a cada desarrolladora y su WhatsApp en Supabase → tabla `desarrolladoras` (ejemplo en `supabase/esquema.sql`). Sin eso, el panel te avisa y la mandas tú con un toque.
- **Lo que se factura**: vista `citas_cobrables` (verificadas y enviadas, sin repetir ni inválidas). El panel muestra el resumen del mes por desarrollo.
- **Reporte para una desarrolladora**: `https://arventa.mx/reporte.html`, con la misma clave. Elige solo su desarrollo antes de enseñarlo.
- **Si alguien pide borrar sus datos**: busca su folio o teléfono en `solicitudes` y borra la fila. Sin envío, se borran solas a los 12 meses.
