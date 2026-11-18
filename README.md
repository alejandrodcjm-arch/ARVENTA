# ARVENTA

Inmobiliaria de Durango. Su sitio reúne toda la vivienda nueva de la ciudad en un mapa con precios, qué tienes cerca (escuelas, OXXO, súper, farmacias, hospitales, parques) y cuánto tardas a tu trabajo desde cada fraccionamiento o edificio.

## Cómo abrirlo

No necesita instalar nada.

- **Rápido:** abre `index.html` con doble clic.
- **En VS Code:** instala la extensión *Live Server*, clic derecho en `index.html` → *Open with Live Server*. Se recarga solo cada vez que guardas.

Necesita internet: el mapa (CARTO/OpenStreetMap), los lugares cercanos (Overpass) y los tiempos en auto (OSRM) se cargan en vivo.

## Archivos

| Archivo | Qué tiene |
|---|---|
| `index.html` | La estructura de la página |
| `estilos.css` | Colores, letras y diseño |
| `datos.js` | **Los desarrollos**: nombre, precios, ubicación, ventajas y fuentes. Aquí se agregan o corrigen |
| `app.js` | Buscador, tarjetas con galería, filtros, mapa, ficha de cada desarrollo, calculadora y formulario de visita |

## Agregar o corregir un desarrollo

Edita `datos.js`. Cada desarrollo es un bloque así:

```js
{id:"mi-fracc", nombre:"Fracc. Ejemplo", tipo:"casa", desde:1500000, hasta:1900000,
 recamaras:"3", m2:"95 a 110 m²", zona:"Salida a Mazatlán",
 lat:24.0135, lng:-104.7045, aprox:false,
 ventajas:["Alberca","Caseta de vigilancia"],
 fuentes:[["Visita a la oficina de ventas","https://..."]]}
```

- `tipo`: `casa`, `departamento` o `terreno`.
- `lat` y `lng`: en Google Maps, clic derecho sobre el lugar y copia las coordenadas. Si aún no se sabe, pon `null` y sale en la lista como “Ubicación por confirmar”.
- `aprox:true` muestra “ubicación aproximada”. Cámbialo a `false` cuando confirmes el punto exacto.

## Agregar fotos reales

Mientras no haya fotos, cada desarrollo muestra una ilustración marcada como "Imagen ilustrativa".
Cuando la desarrolladora te dé fotos o renders (con permiso para usarlos):

1. Crea la carpeta `fotos/<id-del-desarrollo>/` (ej. `fotos/cienega-2/`).
2. Guarda las imágenes en JPG o WebP, de unos 1200 px de ancho y menos de 300 KB cada una.
3. En `datos.js`, agrega al desarrollo: `fotos:["fotos/cienega-2/1.jpg","fotos/cienega-2/2.jpg"]`. La primera es la portada.

Si son renders (no fotos de la obra), la NOM-247 pide marcarlos como imagen ilustrativa.

## Configurar WhatsApp

En `app.js`, pon tu número en `const WHATSAPP = ""` con lada de país y sin espacios (ej. `"5216181234567"`). Si está vacío, el botón de agendar solo arma el mensaje para copiarlo.

## Datos

Precios tomados de anuncios públicos en noviembre de 2026 (Mercado Libre, Inmuebles24, Vivanuncios, Pincali, Nestoria, Nuroa y sitios de inmobiliarias). Pueden cambiar sin aviso. Las ubicaciones marcadas como aproximadas son por zona y se deben confirmar en visita.

Mapa © OpenStreetMap y CARTO.
