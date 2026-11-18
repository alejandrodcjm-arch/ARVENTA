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
| `convenio` | `true` solo con convenio de asesor externo firmado. |
| `fotos`, `permisoFotos` | `["fotos/<id>/1.webp"]` o `{"archivo":"…","render":true}` para renders. Solo con permiso por escrito: anota en `permisoFotos` de quién y cuándo. WebP de ~1200 px y menos de 300 KB. |

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

**3. Aviso inmediato de cada solicitud** (al menos uno)
- Correo: cuenta en [resend.com](https://resend.com), verifica `arventa.mx` y pon `RESEND_API_KEY`, `AVISO_CORREO_PARA` y `AVISO_CORREO_DE`.
- WhatsApp: en [callmebot.com](https://www.callmebot.com/blog/free-api-whatsapp-messages/) registra tu número y pon `CALLMEBOT_TELEFONO` y `CALLMEBOT_APIKEY`.

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
- Razón social, domicilio, correo y licencia en `assets/config.js` (salen en el pie, el aviso y los términos).
- Licencia de asesor inmobiliario de Durango **antes de cobrar comisiones**, contrato con cada desarrolladora y registro en el SAT como actividad vulnerable antes de la primera venta.

## Operación diaria

- **Solicitudes**: Supabase → Table Editor → `solicitudes` (o la vista `pendientes`). Cambia `estado` conforme avanza: nueva → contactada → visita agendada → visita hecha → apartado → vendida / perdida.
- **Registro con la desarrolladora**: al presentar al cliente, llena `registrado_con_desarrolladora` con la fecha y hora. Es tu prueba para cobrar la comisión.
- **Reporte para una desarrolladora**: `https://arventa.mx/reporte.html`, con la clave `REPORTE_CLAVE`. Elige solo su desarrollo antes de enseñarlo.
- **Si alguien pide borrar sus datos**: busca su folio o teléfono en `solicitudes` y borra la fila. Sin compra, se borran solas a los 12 meses.
