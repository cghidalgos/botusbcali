# Guía de Despliegue Local vs Producción

## Configuración Local (localhost:9011 directo)

Para trabajar localmente accediendo directamente a `http://localhost:9011/`:

```bash
docker-compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

Esto:
- Usa `Dockerfile.local` que compila admin-ui con `base="/"`
- No configura `WEBHOOK_BASE`, por lo que Express sirve desde la raíz
- Los assets se sirven en `/assets/` en lugar de `/botusbcali/assets/`

**Acceso:** `http://localhost:9011/`

## Configuración de Producción (con Nginx)

Para desplegar en producción detrás de Nginx en `/botusbcali/`:

```bash
docker-compose up -d --build
```

Esto:
- Usa `Dockerfile` estándar que compila admin-ui con `base="/botusbcali/"`
- Configura `WEBHOOK_BASE=https://lidis.usbcali.edu.co/botusbcali`
- Express elimina el prefijo `/botusbcali/` antes de procesar las rutas
- Los assets se sirven en `/botusbcali/assets/`

**Acceso:** `https://lidis.usbcali.edu.co/botusbcali/`

## Diferencias Clave

| Aspecto | Local | Producción |
|---------|-------|------------|
| Dockerfile | `Dockerfile.local` | `Dockerfile` |
| VITE_BASE_URL | `/` | `/botusbcali/` |
| VITE_API_BASE | `` (vacío) | `/botusbcali` |
| WEBHOOK_BASE | `` (vacío) | `https://lidis.usbcali.edu.co/botusbcali` |
| Acceso | `http://localhost:9011/` | `https://lidis.usbcali.edu.co/botusbcali/` |

## Cambio entre Configuraciones

### Local → Producción
```bash
docker-compose down
docker-compose up -d --build
```

### Producción → Local
```bash
docker-compose down
docker-compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```
