# ARVENTA: instrucciones para Claude

## Qué es
ARVENTA es una inmobiliaria de Durango, Dgo. Este repositorio es su sitio web: muestra en un mapa toda la vivienda nueva de la ciudad (fraccionamientos, torres de departamentos y lotes) con precios, lo que hay cerca y cuánto tardas a tu trabajo.

**Cómo gana dinero:** ARVENTA es asesor externo de las desarrolladoras. La gente agenda una visita desde el sitio, ARVENTA la acompaña y, si compra, la desarrolladora le paga una comisión (normalmente del 3% al 4%). Al comprador no le cuesta nada.

**El sitio tiene dos trabajos:**
1. Que una familia de Durango encuentre su casa sin ir de oficina en oficina, y agende una visita.
2. Que ARVENTA llegue con las desarrolladoras y agencias con datos: cuántas personas vieron su desarrollo, cuántas pidieron visita y de qué zona trabajan.

## Para quién
- Familias de Durango que compran con Infonavit, Fovissste, banco o Cofinavit. Casi todos entran desde el celular.
- Personas que llegan de otros estados (sobre todo Sinaloa) y no conocen la ciudad.
- Desarrolladoras y agencias, que ven los reportes.

## Reglas
- **Sencillo y rápido.** Es un sitio estático (HTML, CSS y JS sin framework). No agregues librerías ni pasos de compilación sin una razón clara; si los propones, explica qué ganamos. La página debe cargar rápido en un celular con 4G.
- **Datos honestos.** Cada precio lleva su fuente y su fecha. No inventes plusvalía, rendimientos ni promesas. Si un dato no se conoce, se muestra como "por confirmar". Las ubicaciones aproximadas se marcan con `aprox:true`.
- **Solo cosas buenas, pero ciertas.** Resalta lo positivo de cada desarrollo (lo que hay cerca, precio por m² abajo del promedio, amenidades), siempre con datos reales.
- **Primero el celular.** Prueba cada cambio en 390 px de ancho y en escritorio.
- **Español de México**, claro y directo, como le hablarías a un cliente.
- **Accesible:** contraste suficiente, foco visible con teclado y respeto a `prefers-reduced-motion`.
- **Privacidad:** los datos de quien agenda una visita no se publican ni se guardan en el navegador de otros. Cualquier formulario que guarde datos necesita aviso de privacidad.

## Estructura
| Archivo | Qué tiene |
|---|---|
| `index.html` | Estructura de la página |
| `estilos.css` | Diseño. Paleta: tinta `#1D2B3A`, cal `#FBFBF8`, agave `#2F6B5E`, sol `#F0A202`, cantera `#B5654F`. Letras: Bricolage Grotesque (títulos) y Atkinson Hyperlegible (texto) |
| `datos.js` | Lista de desarrollos (`window.DESARROLLOS`). Es la fuente de verdad |
| `app.js` | Mapa (Leaflet), lugares cercanos (Overpass/OpenStreetMap), tiempos en auto (OSRM), búsqueda de direcciones (Nominatim), calculadora y formulario de visita |

Servicios externos gratuitos: CARTO para el mapa, Overpass para lugares, OSRM para rutas y Nominatim para direcciones. Respeta sus límites: una sola consulta a Overpass por carga, guardada 7 días en `localStorage`.

## Antes de terminar cualquier cambio
1. Abre el sitio (Live Server) y revisa la lista, el mapa, el detalle de un desarrollo y el formulario de visita.
2. Revisa la consola del navegador: no debe haber errores.
3. Si cambiaste `datos.js`, cada desarrollo debe tener `id` único, `tipo` (`casa`, `departamento` o `terreno`), `desde` numérico y al menos una fuente.
4. Haz commit con un mensaje en español que diga qué cambió y por qué.
