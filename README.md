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
- `DOCUMENT_UPLOAD_MAX_MB` (opcional): tamaño máximo permitido para subir archivos en `POST /api/documents` (por defecto `60`).

> Ejecuta `npm install` después de clonar o actualizar el repositorio para incluir `pdf-parse`, que el flujo de documentos requiere para procesar PDFs.

## Instalación y ejecución
```bash
npm install
npm run dev # para desarrollo con recarga
npm start   # producción
```

## Docker / Docker Compose

Este repo incluye soporte para correr el backend + UI dentro de un contenedor.

### 1) Variables de entorno

- Copia el archivo de ejemplo y completa tus claves:

```bash
cp .env.example .env
```

- Importante: no subas `.env` al repositorio (está ignorado por git).

### 2) Levantar con Docker Compose (recomendado)

Publica el servicio en `http://localhost:9011` (mapea `9011:3000`) y monta volúmenes para persistir `data/` y `uploads/`.

```bash
docker compose up --build
```

Si tu instalación usa el binario legacy:

```bash
docker-compose up --build
```

### 3) Levantar solo con Docker (alternativa)

```bash
docker build -t botusbcali .
docker run --rm \
	--env-file .env \
	-e PORT=3000 \
	-p 9011:3000 \
	-v "$PWD/data:/app/data" \
	-v "$PWD/uploads:/app/uploads" \
	botusbcali
```

### Persistencia

- `data/`: guarda `context.json`, `documents.json`, `history.json`, `memory.json`.
- `uploads/`: guarda los archivos subidos por la UI.

### Nota sobre OCR

El contenedor por defecto es liviano y no incluye `tesseract`/`pdftoppm` (poppler). Si subes PDFs escaneados sin texto, el backend intentará OCR pero fallará y seguirá con la extracción disponible.

### Error HTTP 413 al subir PDFs

Si al subir un PDF ves `HTTP 413 (Payload Too Large)`, puede deberse a:

- Límite del backend (multer): sube `DOCUMENT_UPLOAD_MAX_MB` en tu `.env`.
- Límite de un proxy/reverse-proxy (nginx, ingress, Cloudflare, etc.) delante del Node: debes aumentar el límite del proxy (por ejemplo en nginx `client_max_body_size`).

## Configurar el webhook de Telegram
1. Asegura que tu servidor esté accesible (puedes usar una URL pública o ngrok).
2. Guarda la URL pública en el `.env` (por ejemplo `WEBHOOK_BASE=https://4236d35b5c75.ngrok-free.app`).
3. Ejecuta `npm run set:webhook` (o `npm run set:webhook https://otra-url.com` para sobrescribir el valor del env). Se usará `TELEGRAM_BOT_TOKEN` del `.env` y se confirmará el webhook apuntando a `POST /webhook`.

Si estás usando Docker Compose, puedes correrlo dentro del contenedor:

```bash
docker compose exec botusbcali npm run set:webhook
```

O con legacy:

```bash
docker-compose exec botusbcali npm run set:webhook
```

## UI de control
Abre [http://localhost:3000](http://localhost:3000) y:
1. Define el prompt base y notas adicionales para que GPT entienda el contexto.
2. Sube documentos para fortalecer la base de conocimiento; cada archivo crea una tarjeta en la UI.
3. Observa el panel de actividad para seguir cambios y cargas.
4. Cada documento recorre estados (`Subido`, `Procesando`, `Extrayendo texto`, `Listo`, `Error`) que ayudan a comprender si aún se está generando texto desde un PDF y muestran el resumen generado automáticamente para que sepas qué verá GPT. Si el extractor no logra recuperar contenido legible, puedes agregar un resumen manual adicional.

## Usar todos los documentos (lo más completo posible)

Si quieres que el bot use **siempre** todos los documentos que subas/pegues, configura estos valores en tu `.env` (recuerda que en Docker se leen desde `env_file: .env`):

- `INCLUDE_ALL_DOCUMENTS=true`
- Sube los límites para incluir más texto:
	- `DOCUMENT_PER_DOC_LIMIT_ALL`
	- `DOCUMENT_TOTAL_LIMIT_ALL`
	- (opcional) `DOCUMENT_FULL_LIMIT`

Nota: incluir documentos completos puede hacer el prompt demasiado largo para la ventana de contexto del modelo y aumentar costos/latencia. Si ves errores de longitud o respuestas raras, baja los límites o pregunta por un documento específico.

## Mensajería masiva (Broadcast)

El backend guarda automáticamente los `chat_id` de usuarios que hayan escrito al bot (webhook). Con esto puedes enviar mensajes masivos **solo a usuarios que ya interactuaron**.

### Variables de entorno

- `BROADCAST_SECRET` (opcional pero recomendado): si está definido, el endpoint requiere el header `x-broadcast-secret`.
- `BROADCAST_DELAY_MS` (opcional): delay entre envíos en milisegundos (default `60`).
- `BROADCAST_ALLOWED_ORIGIN` (opcional): si el navegador envía `Origin`, se valida contra este origen (ej: `https://lidis.usbcali.edu.co`). Si no se define, usa `WEBHOOK_BASE` como referencia.

Los usuarios se persisten en `data/telegramUsers.json`.

### Endpoint

`POST /send-broadcast`

Body JSON:
- `message` (string, requerido)
- `sendToAll` (boolean, opcional) — si `true`, envía a todos los usuarios almacenados que no estén marcados como bloqueados.
- `chatIds` (string[], opcional) — lista específica de `chat_id`. Nota: solo se envía a chat_id existentes en la base (usuarios que ya escribieron al bot).

Respuesta (resumen):
- `sent`: cantidad enviada
- `failed`: cantidad fallida
- `failures`: arreglo con `{ chatId, reason, status, description }`

### Ejemplo desde frontend (fetch)

```js
await fetch('/send-broadcast', {
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
		// 'x-broadcast-secret': 'TU_SECRETO',
	},
	body: JSON.stringify({
		message: 'Hola, este es un aviso.',
		sendToAll: true,
	}),
});
```

### Ejemplo (axios)

```js
import axios from 'axios';

await axios.post(
	'/send-broadcast',
	{ message: 'Hola, este es un aviso.', sendToAll: true },
	{ headers: { /* 'x-broadcast-secret': 'TU_SECRETO' */ } }
);
```

### Extracción automática de PDFs

Las cargas de archivos con extensión `.pdf` pasan por `pdf-parse`, que convierte el PDF a texto completo antes de generar el resumen. El backend actualiza el estado a `Extrayendo texto` mientras ocurre esa transformación, y la UI lo refleja con una etiqueta y una nota debajo del nombre del archivo. Si el contenido resulta en texto legible, se muestra automáticamente; de lo contrario, puedes seguir anexando un resumen manual para complementar la tarjeta.

El backend procesa cada archivo luego de subirlo con `documentProcessor`, que intenta extraer un fragmento legible desde `uploads/`, marca el estado y lo usa como resumen principal antes de incluirlo en las solicitudes a GPT.

El backend expone `/api/config` y `/api/documents` para que el frontend sincronice el estado. Los documentos se guardan en `uploads/`.
