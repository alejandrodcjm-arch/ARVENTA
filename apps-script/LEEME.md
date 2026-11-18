# Guardar solicitudes en Google Sheets (sin servidor propio)

Este script vive dentro de una hoja de Google. Recibe las solicitudes de visita y los contactos de desarrolladoras que manda el sitio, y le entrega a `reporte.html` los números ya agregados, sin nombres ni teléfonos.

## 1. Crear la hoja y pegar el código (10 minutos)

1. En Google Drive crea una hoja nueva, por ejemplo **ARVENTA · Solicitudes**.
2. Menú **Extensiones → Apps Script**.
3. Borra lo que trae `Código.gs` y pega todo el contenido de [`Codigo.gs`](Codigo.gs). Guarda (Ctrl+S).
4. En **⚙ Configuración del proyecto**, pon la zona horaria **(GMT-06:00) Hora central - Monterrey**.
5. Arriba elige la función **`configurar`** y presiona **▶ Ejecutar**. Google te pedirá permisos. Es tu propia cuenta: entra en "Avanzado → Ir a … (no seguro)" y acepta.
   - Se crean las pestañas **Solicitudes** y **Desarrolladoras**.
   - En el **Registro de ejecución** aparece la **clave del reporte**. Guárdala; la vas a necesitar en `reporte.html`.

## 2. Publicarlo como aplicación web

1. **Implementar → Nueva implementación → ⚙ → Aplicación web**.
2. **Ejecutar como:** Yo. **Quién tiene acceso:** Cualquier usuario.
   (Hace falta para que el sitio pueda escribir sin pedirle a cada persona una cuenta de Google. El script solo acepta solicitudes con el formato correcto, y el reporte pide la clave.)
3. **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).
4. Pégala en `config.js`, en `HOJA_URL: "https://script.google.com/macros/s/…/exec"`.

Cada vez que cambies el código: **Implementar → Administrar implementaciones → ✏ → Versión: nueva → Implementar**. La URL no cambia.

## 3. Conectar Umami (para las vistas del reporte)

1. Crea una cuenta en [cloud.umami.is](https://cloud.umami.is) (el plan Hobby es gratis) y agrega tu sitio.
2. Copia el **Website ID** y pégalo en `config.js`, en `UMAMI_ID`.
3. En Umami: **Settings → API keys → Create key**. Copia la llave.
4. En Apps Script: **⚙ Configuración del proyecto → Propiedades de la secuencia de comandos → Agregar propiedad**:
   - `UMAMI_API_KEY` = la llave de Umami
   - `UMAMI_WEBSITE_ID` = el Website ID

La llave de Umami se queda en Google; nunca se publica en el sitio. Sin estas propiedades el reporte funciona, pero las vistas salen como "—".

## 4. Ver el reporte

Abre `reporte.html`, escribe la clave y elige el desarrollo.

- Para enseñárselo a una desarrolladora, **elige solo su desarrollo**. La vista "Todos" muestra los números de todos y es solo para uso interno.
- **Imprimir o guardar PDF** genera una versión limpia, sin los controles.
- `reporte.html#demo` muestra datos inventados, marcados como EJEMPLO, para ver cómo queda.

## Qué se guarda

**Solicitudes:** fecha, folio, desarrollo, nombre, WhatsApp, cuándo, cómo pagaría, el lugar de trabajo si lo escribió, la zona de trabajo redondeada a ~1 km, los minutos en auto y la columna "Estado" para tu seguimiento. El folio también va en el mensaje de WhatsApp, para cruzar la conversación con la fila.

**Desarrolladoras:** lo que llenan en `anuncia.html`, con su folio.

Protecciones del script:
- No duplica un folio que ya llegó.
- Neutraliza textos que empiezan con `=`, `+`, `-` o `@`, para que nadie meta fórmulas en tu hoja.
- Descarta lo que llenan los robots en el campo oculto.
- Descarta coordenadas fuera de Durango.

Si alguien pide que borres sus datos (aviso de privacidad), busca su folio o su nombre y borra la fila.
