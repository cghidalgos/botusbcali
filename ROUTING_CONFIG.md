# Admin UI - Configuración de Rutas

## Configuración Actualizada

### Desarrollo (Docker Compose)
- **Admin UI**: http://localhost:8090/admin/
- **API Backend**: http://localhost:9011 (o `:9011/api/`)

### Producción (https://lidis.usbcali.edu.co)
- **Admin UI**: https://lidis.usbcali.edu.co/botusbcali/
- **API Backend**: mismo servidor (relativas a `/api`)

## Cambios Realizados

### 1. `admin-ui/vite.config.ts`
- **Desarrollo**: base URL = `/admin/`
- **Producción**: base URL = `/botusbcali/`
- **Puerto**: 8090 (actualizado de 8080)

### 2. `src/server.js`
```javascript
// Sirve admin-ui desde /botusbcali/ en producción
app.use("/botusbcali/", express.static(adminDistPath));

// SPA fallback para React Router
app.get("/botusbcali/*", (req, res) => {
  res.sendFile(path.join(adminDistPath, "index.html"));
});
```

### 3. `docker-compose.yml`
- Mantiene admin-ui en puerto 8090
- Vite ejecuta con `--host 0.0.0.0 --port 8090`

## Cómo Funciona

### En Desarrollo (Docker)
1. `docker-compose up`
2. Accede a http://localhost:8090/admin/
3. Vite proxy `/api` → `http://botusbcali:3000/api`

### En Producción (localhost sin Docker)
1. `npm start` (buildea admin-ui + inicia servidor)
2. Admin UI se compila con base `/botusbcali/`
3. Servidor Express sirve desde `/botusbcali/`
4. Accede a http://localhost:3000/botusbcali/

### En Producción (https://lidis.usbcali.edu.co)
1. Build: `npm run build:admin` (crea dist/ con base `/botusbcali/`)
2. Servidor Express sirve `/botusbcali/` desde express.static()
3. Reverse Proxy (nginx): `/botusbcali/` apunta a `http://localhost:3000/botusbcali/`
4. Accede a https://lidis.usbcali.edu.co/botusbcali/

## API Routes

El proxy en Vite intercepa solicitudes a `/api`:
- **Dev (8090)**: `/api/...` → proxy → `http://botusbcali:3000/api/...`
- **Prod**: `/botusbcali/api/...` → Express local → `/api/...` (interno)

Las rutas en `lib/api.ts` usan `VITE_API_BASE + path`, que por defecto es relativo:
- Dev: `/api/config`
- Prod: `/api/config` (manejado por prefix expressmount)

## Testing

### Desarrollo
```bash
# Terminal 1: Levantar servicios
docker-compose up

# Terminal 2: Verificar acceso
curl http://localhost:8090/admin/
curl http://localhost:9011/api/config

# Alternativamente, espera soft reload + abre en navegador
# http://localhost:8090/admin/
```

### Producción
```bash
# Build
npm run build:admin

# Start
npm start

# Test
curl http://localhost:3000/botusbcali/
curl http://localhost:3000/api/config
```

## Variables de Entorno

### `admin-ui/.env.production`
```env
VITE_API_TARGET=http://localhost:3000
VITE_API_BASE=
```

### `.env` (backend)
```env
TELEGRAM_BOT_TOKEN=...
OPENAI_API_KEY=...
PORT=3000
```

## Resolución de Problemas

### Admin UI no carga en /admin/
1. Verifica que Vite esté corriendo: `docker-compose logs -f admin-ui`
2. Verifica el puerto: debe ser 8090
3. Limpia caché del navegador (Ctrl+Shift+Delete)

### API retorna 404
1. Verifica que el backend está corriendo: `docker-compose logs -f botusbcali`
2. Verifica que el proxy está configurado en vite.config.ts
3. Revisa que `VITE_API_TARGET=http://botusbcali:3000` en docker-compose

### En producción, rutas devuelven 404
1. Verifica que server.js tiene el SPA fallback: `app.get("/botusbcali/*")`
2. Verifica que admin-ui/dist/ existe: `ls -la admin-ui/dist/`
3. Revisa logs: `npm start 2>&1 | tail -50`

## Estructura de Directorios

```
admin-ui/
├── dist/                 (build - se genera con npm run build)
├── src/
├── vite.config.ts       (base URL: /admin/ dev, /botusbcali/ prod)
└── ...

src/
├── server.js            (sirve /botusbcali/ en prod)
├── config/
└── ...
```

## Notes

- La base URL se configura en **tiempo de build** en vite.config.ts
- Los archivos estáticos no incluyen la base URL en su nombre
- Express.static maneja el prefijo de ruta
- React Router hereda la base URL del index.html
