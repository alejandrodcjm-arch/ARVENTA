# ARVENTA: requisitos para salir a producción

Este documento dice qué debe tener el sistema para lanzarse como algo **fiable**: que no se caiga, que no pierda una solicitud de visita, que sus datos sean ciertos y que cumpla la ley.

Cada punto es **Esencial** (sin esto no se lanza) o **Después** (en los primeros 3 meses).

## Estado (18 de noviembre de 2026)

✅ hecho en el código · 🔧 hecho, falta configurarlo (cuenta o llave; pasos en el README) · ⏳ depende de ARVENTA

| Sección | Estado |
|---|---|
| 1. Arquitectura y carpetas | ✅ Estructura, `scripts/`, `api/`, `tests/`, GitHub Actions y `vercel.json`. 🔧 Proyecto en Vercel. |
| 2. Datos | ✅ `data/desarrollos.json`, `validar.mjs` bloquea el despliegue, `verificado` con aviso a 60 días, `aprox`, permiso de fotos obligatorio y renders marcados. ⏳ Verificar precios (hoy todos con fecha del 17 nov) y confirmar ubicaciones. |
| 3. Solicitudes | ✅ `/api/visita` guarda antes de abrir WhatsApp, valida en el servidor, honeypot, 5 por hora por IP, aviso inmediato, 7 estados, fecha de registro con la desarrolladora, cola en el teléfono si falla, respaldo semanal cifrado. 🔧 Supabase, aviso (Resend o CallMeBot) y secretos del respaldo. |
| 4. Rendimiento | ✅ LCP 0.9 s y CLS 0 en 4G lenta, 106 KB de JS propio, Leaflet solo al abrir el mapa, fotos con tamaño fijo y carga diferida, caché larga con versión. ⏳ Correr Lighthouse en el dominio real. |
| 5. Que no se caiga | ✅ Plan B de cada servicio, lugares precalculados, `/api/salud` para el monitoreo, registro de errores del navegador, pruebas antes de publicar. 🔧 Llave de MapTiler, UptimeRobot, Sentry y proteger `main`. |
| 6. Seguridad | ✅ Sin llaves en el código, encabezados (CSP, HSTS, etc.), RLS sin acceso público, todo texto escapado. 🔧 Autenticación en dos pasos en GitHub, Vercel y Supabase. |
| 7. Encontrable | ✅ Página real por desarrollo, Open Graph con imagen, sitemap, robots y schema.org. 🔧 Search Console y Google Business. |
| 8. Medición | ✅ `/api/evento` anónimo (búsquedas, filtros, presupuesto, vistas, clics, zona a ~1 km) y reporte por desarrollo. 🔧 Umami. |
| 9. Legal | ✅ NOM-247 en cada ficha, aviso de privacidad, consentimiento, términos, borrado a 12 meses. ⏳ Razón social, domicilio, licencia, contratos y registro en el SAT. |
| 10. Accesibilidad | ✅ Etiquetas en campos, textos alternativos, foco visible, `prefers-reduced-motion`. ⏳ Probar en Safari y Samsung Internet. |
| 11. Pruebas | ✅ Las 7 de la lista, más mapa diferido y reporte (19 pruebas). |

---

## 1. Cómo está armado

El sitio sigue siendo **estático**, porque es rápido, barato y casi no falla. Se le agregan solo tres piezas: unas pocas funciones de servidor, una base de datos y un paso de construcción.

```
Visitante ──► Vercel (CDN) ──► páginas HTML ya construidas
                     │
                     ├──► /api/visita    ──► Base de datos (Supabase) ──► aviso a ARVENTA (WhatsApp/correo)
                     ├──► /api/evento    ──► Base de datos (búsquedas y vistas, sin datos personales)
                     └──► /api/buscar-ia ──► IA (Después)

GitHub Actions (automático):
  - en cada cambio: validar datos, construir páginas, correr pruebas
  - cada semana: actualizar lugares cercanos desde OpenStreetMap
```

**Por qué un paso de construcción:** hoy cada desarrollo vive en `#id`, y Google no indexa eso. Cada desarrollo necesita su propia página real (`arventa.mx/desarrollos/cienega-2/`) para aparecer en Google y para verse bien al compartirla por WhatsApp. Un script de Node arma esas páginas a partir de los datos; no hace falta un framework.

**Por qué precalcular los lugares cercanos:** si Overpass (OpenStreetMap) se cae, hoy el sitio se queda sin escuelas ni OXXOs. Se calculan una vez por semana en GitHub Actions y se guardan en un archivo. Así cargan al instante y no dependen de un servicio externo.

### Estructura de carpetas

```
/
├─ index.html                     buscador y tarjetas
├─ desarrollos/<id>/index.html    ficha de cada desarrollo (GENERADA, no se edita a mano)
├─ assets/
│  ├─ estilos.css
│  └─ app.js
├─ data/
│  ├─ desarrollos.json            fuente de verdad de los desarrollos
│  └─ lugares.json                GENERADO: lugares cercanos por desarrollo
├─ fotos/<id>/                    fotos optimizadas (WebP, ~1200 px, <300 KB)
├─ api/
│  ├─ visita.js                   recibe solicitudes de visita
│  └─ evento.js                   registra búsquedas y vistas anónimas
├─ scripts/
│  ├─ validar.mjs                 revisa que los datos estén completos
│  ├─ lugares.mjs                 consulta Overpass y genera data/lugares.json
│  └─ construir.mjs               genera fichas, sitemap.xml y vistas previas
├─ tests/                         pruebas automáticas (Playwright)
├─ .github/workflows/
│  ├─ ci.yml                      validar + construir + probar en cada cambio
│  └─ lugares.yml                 actualizar lugares cada semana
├─ vercel.json                    encabezados de seguridad y caché
└─ docs/REQUISITOS.md             este archivo
```

---

## 2. Datos de los desarrollos

| | Requisito |
|---|---|
| Esencial | Los datos viven en `data/desarrollos.json`, versionados en Git: cada cambio queda registrado con quién y cuándo. |
| Esencial | `scripts/validar.mjs` bloquea el despliegue si un desarrollo no tiene `id` único, `tipo` válido, `desde` numérico, al menos una fuente y `verificado` (fecha). |
| Esencial | Cada desarrollo lleva `verificado: "2026-11-18"`. Si pasan más de 60 días, la ficha dice "precio por confirmar" y el script avisa. |
| Esencial | Ubicación con `aprox: true/false`. Ninguno sale como "confirmado" sin visita o dato de la desarrolladora. |
| Esencial | Fotos solo con permiso por escrito de la desarrolladora (un correo o WhatsApp guardado basta). Renders marcados como "imagen ilustrativa". |
| Después | Panel de administración (Supabase) para que ARVENTA edite sin tocar código, y lector de listas de precios con IA. |

---

## 3. Solicitudes de visita (lo que genera dinero)

Esto es lo más importante: **una solicitud perdida es una comisión perdida.**

| | Requisito |
|---|---|
| Esencial | El formulario manda a `/api/visita`, que guarda en la base de datos **antes** de abrir WhatsApp. Si la persona cierra WhatsApp, la solicitud ya quedó guardada. |
| Esencial | Validación en el servidor: nombre, teléfono de 10 dígitos, desarrollo existente y consentimiento marcado. No confiar solo en el navegador. |
| Esencial | Protección contra spam: campo oculto (honeypot) y límite de 5 solicitudes por hora por IP. |
| Esencial | Aviso inmediato a ARVENTA por WhatsApp o correo con cada solicitud nueva. |
| Esencial | Cada solicitud tiene estado: nueva, contactada, visita agendada, visita hecha, apartado, vendida, perdida. Con eso se cobra la comisión y se arma el reporte. |
| Esencial | Fecha y hora de registro del cliente con la desarrolladora. Es la prueba de que ARVENTA lo llevó y protege la comisión. |
| Esencial | Respaldo: Supabase guarda copias diarias; además, exportación semanal a CSV. |
| Después | Responder en menos de 1 hora en horario laboral, medido. |

---

## 4. Rendimiento (celular con 4G)

| | Requisito |
|---|---|
| Esencial | Primera imagen visible (LCP) en menos de 2.5 s en un celular con 4G. |
| Esencial | Menos de 150 KB de JavaScript propio. Leaflet se carga solo al abrir el mapa. |
| Esencial | Imágenes en WebP, con tamaño fijo para que la página no brinque, y carga diferida (`loading="lazy"`) salvo la primera. |
| Esencial | Lighthouse de 90 o más en rendimiento, accesibilidad, buenas prácticas y SEO. |
| Esencial | Caché larga para CSS, JS y fotos, y nombres de archivo con versión para que los cambios se vean al momento. |

---

## 5. Que no se caiga

| | Requisito |
|---|---|
| Esencial | Cada servicio externo tiene un plan B: sin mapa, se ven las tarjetas; sin rutas (OSRM), minutos estimados por distancia; sin búsqueda de direcciones, "márcalo en el mapa". |
| Esencial | Lugares cercanos precalculados (ver sección 1). |
| Esencial | Mapa con llave propia (MapTiler o el plan de CARTO) en lugar de usar el servicio gratuito sin límite. |
| Esencial | Monitoreo cada 5 minutos (UptimeRobot o Better Stack) que avise si el sitio o `/api/visita` no responden. |
| Esencial | Registro de errores (Sentry, plan gratis) en el navegador y en las funciones. |
| Esencial | Cada cambio se prueba primero en una vista previa de Vercel y solo pasa a producción si las pruebas automáticas salen bien. |
| Después | OSRM y Nominatim propios o de pago (OpenRouteService, MapTiler) cuando pasen 1,000 búsquedas al día. |

---

## 6. Seguridad

| | Requisito |
|---|---|
| Esencial | HTTPS en todo el sitio (Vercel lo da). |
| Esencial | Ninguna llave o contraseña en el código: todo en variables de entorno de Vercel. |
| Esencial | Encabezados de seguridad en `vercel.json`: Content-Security-Policy, X-Content-Type-Options, Referrer-Policy y Permissions-Policy (solo geolocalización). |
| Esencial | La base de datos con reglas de acceso (RLS): el público solo puede **crear** solicitudes, nunca leerlas. |
| Esencial | Todo texto que viene de datos o del usuario se escapa antes de pintarlo, para evitar inyección de código. |
| Esencial | Autenticación en dos pasos en GitHub, Vercel y Supabase. |

---

## 7. Encontrable y compartible

| | Requisito |
|---|---|
| Esencial | Una página real por desarrollo, con título y descripción propios. |
| Esencial | Vista previa al compartir por WhatsApp o Facebook: imagen, nombre y precio (etiquetas Open Graph). |
| Esencial | `sitemap.xml` y `robots.txt`, y el sitio dado de alta en Google Search Console. |
| Esencial | Datos estructurados (schema.org) en cada ficha para que Google entienda que es vivienda en venta con precio y ubicación. |
| Esencial | Perfil de Google Business para ARVENTA en Durango. |
| Después | Páginas por zona: "Casas nuevas en el sur de Durango", "Departamentos cerca de la UJED". |

---

## 8. Medición (para los reportes a desarrolladoras)

| | Requisito |
|---|---|
| Esencial | Analítica que respete la privacidad (Umami o Plausible): visitas por página y de dónde llegan. Sin cookies de rastreo, así no necesitas banner de cookies. |
| Esencial | `/api/evento` registra de forma anónima: búsquedas, filtros usados, presupuesto elegido, vistas de ficha y clics en "Agendar visita". Nunca nombre, teléfono ni ubicación exacta: la zona de trabajo se guarda redondeada a ~1 km. |
| Esencial | Con eso se puede contestar: ¿cuántos vieron cada desarrollo?, ¿cuántos pidieron visita?, ¿qué presupuesto y zona buscan? |
| Después | Reporte mensual por desarrolladora, generado automáticamente. |

---

## 9. Legal

Detalle en la sección "Requisitos obligatorios" de `CLAUDE.md`. Para lanzar:

| | Requisito |
|---|---|
| Esencial | Cada ficha cumple la NOM-247: precio con leyenda de variación, fuente y fecha, créditos confirmados, entrega, qué incluye, ubicación aproximada marcada e imagen ilustrativa marcada. |
| Esencial | Aviso de privacidad completo (con razón social y domicilio reales) y casilla de consentimiento. |
| Esencial | Términos de uso: el sitio informa, no es oferta vinculante, y los precios los define la desarrolladora. |
| Esencial | Plazo de guardado de solicitudes: se borran a los 12 meses si no hubo compra. Cualquier persona puede pedir que se borren sus datos. |
| Esencial | Licencia de asesor inmobiliario de Durango tramitada **antes de cobrar comisiones**, y contrato firmado con cada desarrolladora. |
| Esencial | Registro en el SAT como actividad vulnerable (antilavado) antes de la primera venta. |

---

## 10. Accesibilidad

| | Requisito |
|---|---|
| Esencial | Cumple WCAG 2.1 nivel AA: contraste, foco visible, todo usable con teclado, textos alternativos en imágenes y etiquetas en todos los campos. |
| Esencial | Respeta `prefers-reduced-motion`. |
| Esencial | Probado en celular de 390 px, tableta y escritorio, en Chrome, Safari y Samsung Internet. |

---

## 11. Pruebas automáticas

Corren en GitHub Actions en cada cambio; si fallan, no se publica.

- [x] Validación de datos (`scripts/validar.mjs`).
- [x] La página principal carga y muestra tarjetas.
- [x] Buscar, filtrar y ordenar cambian los resultados.
- [x] La ficha de cada desarrollo abre y tiene las secciones de la NOM-247.
- [x] Enviar una solicitud de visita la guarda en la base de pruebas.
- [x] Sin conexión a servicios externos (mapa, rutas, lugares), el sitio sigue funcionando.
- [x] Sin errores en la consola.

---

## 12. Lista para lanzar

Se lanza cuando **todo** esto está marcado:

- [ ] Dominio `arventa.mx` en Vercel con HTTPS.
- [ ] Al menos 10 desarrollos con precio verificado en los últimos 30 días y ubicación confirmada.
- [ ] Solicitudes de visita guardándose en Supabase, con aviso a WhatsApp, probado de punta a punta.
- [ ] Monitoreo y registro de errores activos.
- [ ] Analítica y eventos anónimos funcionando.
- [ ] Lighthouse de 90 o más en celular.
- [ ] Aviso de privacidad y términos con datos reales de la empresa.
- [ ] Sitemap enviado a Google Search Console.
- [x] Pruebas automáticas en verde.
- [ ] Prueba con 5 personas reales (familia o amigos) buscando casa desde su celular, y corrección de lo que no entendieron.
