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
- [ ] Estado del convenio con la desarrolladora: si ARVENTA no tiene convenio de asesor externo firmado, la ficha no puede decir "ARVENTA vende este desarrollo"; solo "información pública, agenda una visita".

### 2. La empresa (Ley de Servicios de Intermediación Inmobiliaria de Durango, 2026)
- [ ] El sitio debe mostrar en el pie la razón social de ARVENTA y su número de licencia o registro estatal de asesor inmobiliario. Mientras no exista, el campo queda pendiente y no se cobran comisiones.
- [ ] Se necesita contrato de intermediación por escrito con cada desarrolladora (comisión, plazos, cómo se registra un cliente) antes de llevarle compradores.

### 3. Antilavado (LFPIORPI, fracción V)
- [ ] La intermediación en compraventa de inmuebles es actividad vulnerable: hay que identificar siempre al cliente y presentar aviso al SAT cuando la operación llega a 8,025 UMA ($941,412.75 en 2026). Casi todos los desarrollos de la lista pasan ese monto.
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

## Antes de terminar cualquier cambio
1. Abre el sitio (Live Server) y revisa la lista, el mapa, el detalle de un desarrollo y el formulario de visita.
2. Revisa la consola del navegador: no debe haber errores.
3. Si cambiaste `datos.js`, cada desarrollo debe tener `id` único, `tipo` (`casa`, `departamento` o `terreno`), `desde` numérico y al menos una fuente.
4. Haz commit con un mensaje en español que diga qué cambió y por qué.
