# BotTelegram

Un starter para un bot de Telegram conectado a GPT con una interfaz de configuración.

## ¿Qué incluye?
- `src/server.js`: Express que expone la UI, endpoints para contexto/documentos y el webhook de Telegram.
- `src/openai.js`: ensambla prompt combinando contexto y documentos antes de llamar a la API de OpenAI.
- `src/documentProcessor.js`: extrae fragmentos legibles desde cada archivo y mantiene el estado/resumen en memoria.
- `public/`: interfaz para editar el prompt/escribir notas, subir documentos y ver la actividad.
- `pdf-parse`: dependencia usada por el backend para convertir automáticamente PDFs a texto antes de resumirlos.

## Variables de entorno
- Define las claves en un archivo `.env` en la raíz (ya existe un ejemplo) y se cargan con `dotenv`.
- `TELEGRAM_BOT_TOKEN` (requerido): token del bot Telegram.
- `OPENAI_API_KEY` (recomendado): clave para la API de OpenAI.
- `OPENAI_MODEL` (opcional): modelo GPT a usar (por defecto `gpt-4o-mini`).
- `PORT` (opcional): puerto donde corre el servidor (por defecto `3000`).
- `WEBHOOK_BASE` (opcional durante pruebas locales): URL pública de tu servidor (por ejemplo ngrok) usada para registrar `/webhook`.

> Ejecuta `npm install` después de clonar o actualizar el repositorio para incluir `pdf-parse`, que el flujo de documentos requiere para procesar PDFs.

## Instalación y ejecución
```bash
npm install
npm run dev # para desarrollo con recarga
npm start   # producción
```

## Configurar el webhook de Telegram
1. Asegura que tu servidor esté accesible (puedes usar una URL pública o ngrok).
2. Guarda la URL pública en el `.env` (por ejemplo `WEBHOOK_BASE=https://4236d35b5c75.ngrok-free.app`).
3. Ejecuta `npm run set:webhook` (o `npm run set:webhook https://otra-url.com` para sobrescribir el valor del env). Se usará `TELEGRAM_BOT_TOKEN` del `.env` y se confirmará el webhook apuntando a `POST /webhook`.

## UI de control
Abre [http://localhost:3000](http://localhost:3000) y:
1. Define el prompt base y notas adicionales para que GPT entienda el contexto.
2. Sube documentos para fortalecer la base de conocimiento; cada archivo crea una tarjeta en la UI.
3. Observa el panel de actividad para seguir cambios y cargas.
4. Cada documento recorre estados (`Subido`, `Procesando`, `Extrayendo texto`, `Listo`, `Error`) que ayudan a comprender si aún se está generando texto desde un PDF y muestran el resumen generado automáticamente para que sepas qué verá GPT. Si el extractor no logra recuperar contenido legible, puedes agregar un resumen manual adicional.

### Extracción automática de PDFs

Las cargas de archivos con extensión `.pdf` pasan por `pdf-parse`, que convierte el PDF a texto completo antes de generar el resumen. El backend actualiza el estado a `Extrayendo texto` mientras ocurre esa transformación, y la UI lo refleja con una etiqueta y una nota debajo del nombre del archivo. Si el contenido resulta en texto legible, se muestra automáticamente; de lo contrario, puedes seguir anexando un resumen manual para complementar la tarjeta.

El backend procesa cada archivo luego de subirlo con `documentProcessor`, que intenta extraer un fragmento legible desde `uploads/`, marca el estado y lo usa como resumen principal antes de incluirlo en las solicitudes a GPT.

El backend expone `/api/config` y `/api/documents` para que el frontend sincronice el estado. Los documentos se guardan en `uploads/`.
