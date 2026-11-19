# ARVENTA: instrucciones para Claude

## Qué es
ARVENTA es una inmobiliaria de Durango, Dgo. Este repositorio es su sitio web: muestra en un mapa toda la vivienda nueva de la ciudad (fraccionamientos, torres de departamentos y lotes) con precios, lo que hay cerca y cuánto tardas a tu trabajo.

**Cómo gana dinero:** ARVENTA es un portal: da información y junta a quien busca casa con quien la vende. **No vende ni acompaña la venta**; eso lo hace el asesor de la desarrolladora o inmobiliaria. Cobra a quien anuncia, nunca a quien busca:
1. **Pago por cita:** publicar es gratis; la desarrolladora paga una cuota fija por cada solicitud de visita verificada que ARVENTA le manda.
2. **Plan destacado:** cuota mensual por aparecer primero en su zona y tener la ficha completa (fotos, precio verificado, reporte).
3. **Reporte de demanda:** qué busca la gente en Durango (presupuesto, zona, recámaras), sin datos personales.

**El sitio tiene dos trabajos:**
1. Que una familia de Durango encuentre su casa sin ir de oficina en oficina, y agende una visita.
2. Que ARVENTA llegue con las desarrolladoras y agencias con datos: cuántas personas vieron su desarrollo, cuántas pidieron visita y de qué zona trabajan.

## Para quién
- Familias de Durango que compran con Infonavit, Fovissste, banco o Cofinavit. Casi todos entran desde el celular.
- Personas que llegan de otros estados (sobre todo Sinaloa) y no conocen la ciudad.
- Desarrolladoras y agencias, que ven los reportes.

## Reglas
- **Sencillo y rápido.** Es un sitio estático (HTML, CSS y JS sin framework). No agregues librerías sin una razón clara; si las propones, explica qué ganamos. Lo único que se agrega es lo que pide `docs/REQUISITOS.md` (páginas generadas, funciones en `/api`, Supabase). La página debe cargar rápido en un celular con 4G.
- **Datos honestos.** Cada precio lleva su fuente y su fecha. No inventes plusvalía, rendimientos ni promesas. Si un dato no se conoce, se muestra como "por confirmar". Las ubicaciones aproximadas se marcan con `aprox:true`.
- **Solo cosas buenas, pero ciertas.** Resalta lo positivo de cada desarrollo (lo que hay cerca, precio por m² abajo del promedio, amenidades), siempre con datos reales.
- **Primero el celular.** Prueba cada cambio en 390 px de ancho y en escritorio.
- **Español de México**, claro y directo, como le hablarías a un cliente.
- **Accesible:** contraste suficiente, foco visible con teclado y respeto a `prefers-reduced-motion`.
- **Privacidad:** los datos de quien agenda una visita no se publican ni se guardan en el navegador de otros. Cualquier formulario que guarde datos necesita aviso de privacidad.

## Requisitos obligatorios (no se negocian)

### 1. Cada ficha de desarrollo (NOM-247-SE-2021, publicidad de vivienda)
La información y publicidad debe ser veraz, comprobable, clara y sin nada que lleve a error. Cada ficha debe mostrar:
- [ ] Precio "desde" y, si aplica, "hasta", con la leyenda de que puede variar al cerrar la operación.
- [ ] Fuente del precio y fecha en que se verificó.
- [ ] Formas de pago y créditos que acepta (Infonavit, Fovissste, banco, Cofinavit, contado), solo si están confirmados.
- [ ] Condiciones de entrega: preventa o entrega inmediata, y fecha estimada si existe.
- [ ] Qué incluye y qué no (cocina, closets, boiler, cisterna), si se sabe.
- [ ] Si la ubicación es aproximada, decirlo.
- [ ] Imágenes de render marcadas como "imagen ilustrativa".
- [ ] Quién vende: la ficha nunca dice que ARVENTA vende. Dice quién comercializa el desarrollo y si es anunciante (pagó o dio sus datos) o información pública de anuncios.

### 2. La empresa (Ley de Servicios de Intermediación Inmobiliaria de Durango, 2026)
- [ ] El pie muestra la razón social de ARVENTA. Como portal de anuncios que no intermedia ni cobra comisión por venta, posiblemente no necesita licencia de asesor; confirmarlo con un abogado antes de lanzar. Si algún día ARVENTA acompaña ventas, sí la necesita.
- [ ] Contrato o términos de anunciante firmados con cada desarrolladora: precio por cita, qué cuenta como cita válida, cómo se reclama una cita inválida y cómo se factura.

### 3. Antilavado (LFPIORPI, fracción V)
- [ ] La intermediación en compraventa de inmuebles es actividad vulnerable. Mientras ARVENTA solo anuncie y no intermedie, la obligación es de quien vende; confirmarlo con un abogado o contador.
- [ ] El sitio **no** pide ni guarda INE, comprobantes ni datos financieros. Eso se integra en persona, en el expediente del cliente, fuera del sitio.
- [ ] No ofrecer ni aceptar pagos en efectivo por el inmueble a partir de ese umbral.

### 4. Datos personales (Ley Federal de Protección de Datos Personales)
- [ ] Aviso de privacidad visible antes de enviar el formulario de visita: quién recibe los datos, para qué, y cómo pedir que se borren.
- [ ] Pedir solo nombre, WhatsApp, horario y forma de pago. Nada más.
- [ ] Casilla de consentimiento para compartir los datos con la desarrolladora del desarrollo elegido.

### 5. Servicios gratuitos que usa el sitio
- [ ] Mostrar siempre la atribución de OpenStreetMap y CARTO en el mapa.
- [ ] Nominatim y OSRM públicos son para uso ligero; si el sitio crece, cambiar a un plan propio o de pago.

Si un cambio choca con alguno de estos puntos, no lo hagas y explica por qué.

## Cómo se ve
Inspirado en Airbnb: buscador arriba, categorías con íconos, tarjetas con imágenes en cuadrícula y el mapa como vista alterna (botón flotante). Cada tarjeta enseña lo bueno en una línea (escuela cerca, alberca, buen precio por m²). La ficha tiene mosaico de imágenes, caja de precio fija con calculadora y botón de visita.

## Estructura
| Archivo | Qué tiene |
|---|---|
| `index.html` | Estructura de la página |
| `estilos.css` | Diseño. Paleta: tinta `#1D2B3A`, cal `#FBFBF8`, agave `#2F6B5E`, sol `#F0A202`, cantera `#B5654F`. Letras: Bricolage Grotesque (títulos) y Atkinson Hyperlegible (texto) |
| `datos.js` | Lista de desarrollos (`window.DESARROLLOS`). Es la fuente de verdad |
| `app.js` | Buscador (dónde, cerca de, presupuesto), categorías, tarjetas con carrusel, filtros, vista de mapa, ficha `#id`, ilustraciones SVG mientras no hay fotos, lugares cercanos (Overpass), tiempos en auto (OSRM), direcciones (Nominatim), calculadora y formulario de visita |
| `fotos/<id>/` | Fotos reales por desarrollo, listadas en `fotos:[]` de `datos.js` |

Servicios externos gratuitos: CARTO para el mapa, Overpass para lugares, OSRM para rutas y Nominatim para direcciones. Respeta sus límites: una sola consulta a Overpass por carga, guardada 7 días en `localStorage`.

## Requisitos técnicos para producción
Están en `docs/REQUISITOS.md`: arquitectura, estructura de carpetas, solicitudes de visita, rendimiento, fiabilidad, seguridad, SEO, medición, legal, accesibilidad, pruebas y la lista para lanzar. Trabaja hacia esa estructura y marca los puntos que vayas cumpliendo.

## Antes de terminar cualquier cambio
1. Abre el sitio (Live Server) y revisa la lista, el mapa, el detalle de un desarrollo y el formulario de visita.
2. Revisa la consola del navegador: no debe haber errores.
3. Si cambiaste `datos.js`, cada desarrollo debe tener `id` único, `tipo` (`casa`, `departamento` o `terreno`), `desde` numérico y al menos una fuente.
4. Haz commit con un mensaje en español que diga qué cambió y por qué.
