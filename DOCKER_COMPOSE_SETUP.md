# Docker Compose - Admin UI Integration

## Configuración

El `docker-compose.yml` ha sido actualizado para ejecutar dos servicios:

### 1. `botusbcali` (Backend)
- Puerto: `9011:3000`
- Ejecuta el servidor Express con el bot de Telegram
- Volumes: `data/` y `uploads/`

### 2. `admin-ui` (Frontend)
- Puerto: `8090:8090`
- Ejecuta la interfaz de sincronización con Vite en modo desarrollo
- Se conecta al backend: `http://botusbcali:3000`
- Hot reload automático en cambios

## Inicio Rápido

```bash
# Levantar ambos servicios
docker-compose up

# Con rebuild (después de cambios en Dockerfile):
docker-compose up --build

# En background:
docker-compose up -d
```

## Acceso

- **Backend API**: http://localhost:9011
- **Admin UI (dev)**: http://localhost:8090

## Desarrollo con Docker

Los cambios en archivos se reflejan automáticamente gracias a:
- Volumen: `.:/app` - todo el proyecto se monta en el contenedor
- Hot reload de Vite en `admin-ui/src/`

Sin necesidad de reconstruir la imagen.

## Logs

```bash
# Ver logs en tiempo real
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f botusbcali
docker-compose logs -f admin-ui
```

## Detener Servicios

```bash
# Detener sin borrar volúmenes
docker-compose stop

# Detener y limpiar
docker-compose down

# Limpiar también volúmenes de Docker
docker-compose down -v
```

## Notas Importantes

1. **Variables de entorno**: Se cargan desde `.env` en el backend
2. **VITE_API_TARGET**: En Docker apunta a `http://botusbcali:3000` (nombre del servicio)
3. **Data Persistente**: 
   - `data/` - guardado en host
   - `uploads/` - guardado en host
4. **Hot reload**: Solo funciona en desarrollo (admin-ui)

## Troubleshooting

### Puerto ya en uso

```bash
# Cambiar puerto en docker-compose.yml
services:
  admin-ui:
    ports:
      - "8090:8090"  # Cambiar el primer número
```

### Admin UI no recarga

```bash
# Revisar logs
docker-compose logs -f admin-ui

# Reiniciar servicio
docker-compose restart admin-ui
```

### Backend no responde desde UI

Verificar que `VITE_API_TARGET` está correcto en docker-compose.yml:
```yaml
environment:
  - VITE_API_TARGET=http://botusbcali:3000
```

El hostname `botusbcali` es el nombre del servicio en Docker.

## Flujo Recomendado

```bash
1. docker-compose up                # Levantar todo
2. Esperar que ambos servicios inicien (30-60s)
3. Abre http://localhost:8090       # Admin UI
4. Conecta tu bot: WEBHOOK_BASE=http://tu-url:9011
5. Prueba en Telegram
```
