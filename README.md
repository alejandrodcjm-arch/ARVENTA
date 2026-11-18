# ARVENTA

Inmobiliaria de Durango. Su sitio reúne toda la vivienda nueva de la ciudad en un mapa con precios, qué tienes cerca (escuelas, OXXO, súper, farmacias, hospitales, parques) y cuánto tardas a tu trabajo desde cada fraccionamiento o edificio.

## Cómo abrirlo

No necesita instalar nada.

- **Rápido:** abre `index.html` con doble clic.
- **En VS Code:** instala la extensión *Live Server*, clic derecho en `index.html` → *Open with Live Server*. Se recarga solo cada vez que guardas.

Necesita internet: el mapa (OpenStreetMap), los tiempos en auto (OSRM) y las direcciones (Nominatim) se cargan en vivo. Los lugares cercanos ya vienen en `lugares.js`. Ábrelo con Live Server: con doble clic el mapa puede salir en blanco.

Los scripts (`revisar-datos.js`, `generar-paginas.js`, `actualizar-lugares.js`) necesitan Node.js 18 o más reciente y no instalan paquetes.

## Archivos

| Archivo | Qué tiene |
|---|---|
| `index.html` | La estructura de la página |
| `estilos.css` | Colores, letras y diseño |
| `datos.js` | **Los desarrollos**: nombre, precios, ubicación, ventajas y fuentes. Aquí se agregan o corrigen |
| `app.js` | Buscador, tarjetas con galería, filtros, mapa, ficha de cada desarrollo, ¿qué me alcanza?, comparador, calculadora y formulario de visita |
| `config.js` | **Configuración**: WhatsApp, hoja de Google, medición (Umami) y datos legales |
| `lugares.js` | Lugares cercanos de OpenStreetMap; lo genera `actualizar-lugares.js` |
| `d/` | Una página e imagen por desarrollo para compartir por WhatsApp; las genera `generar-paginas.js` |
| `anuncia.html` | Página para desarrolladoras con formulario de contacto |
| `aviso-privacidad.html` | Aviso de privacidad completo |
| `reporte.html` | Reporte de interés por desarrollo (pide clave; `#demo` muestra un ejemplo) |
| `apps-script/` | Código para guardar solicitudes en Google Sheets e instrucciones (`LEEME.md`) |

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

## Después de cambiar datos.js

```
node revisar-datos.js
node generar-paginas.js https://tu-dominio.com/
```

`revisar-datos.js` marca como error ids repetidos o inválidos, precios que no son número, tipos o créditos que no existen, entregas inválidas, fotos que no están en la carpeta y desarrollos sin fuentes. Avisa qué falta confirmar (créditos, entrega, qué incluye, convenio) y qué desarrollos no tienen ubicación.

`generar-paginas.js` crea `d/<id>.html` con título, precio e imagen para que el enlace se vea bien al pegarlo en WhatsApp (botón **Compartir** de cada ficha). Sin el dominio, WhatsApp no muestra la imagen.

Una vez al mes: `node actualizar-lugares.js` para refrescar los lugares cercanos.

## Configuración (`config.js`)

- `WHATSAPP`: número que recibe las solicitudes (hoy `526184463867`).
- `HOJA_URL`: aplicación web de Google Apps Script que guarda cada solicitud con folio en una hoja de Google. Cómo crearla: [apps-script/LEEME.md](apps-script/LEEME.md).
- `UMAMI_ID`: medición de visitas sin cookies (vistas, solicitudes y compartidos por desarrollo). Nunca se mandan nombres, WhatsApp ni sueldos.
- `RAZON_SOCIAL`, `DOMICILIO`, `CORREO`, `LICENCIA`: salen en el pie y en el aviso de privacidad; vacíos, dicen "en trámite" o "pendiente".

## Datos

Precios tomados de anuncios públicos en noviembre de 2026 (Mercado Libre, Inmuebles24, Vivanuncios, Pincali, Nestoria, Nuroa y sitios de inmobiliarias). Pueden cambiar sin aviso. Las ubicaciones marcadas como aproximadas son por zona y se deben confirmar en visita.

Mapa © OpenStreetMap y CARTO.
