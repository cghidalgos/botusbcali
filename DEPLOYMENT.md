# Deployment a Producción

## Importante: Admin UI en Docker

A partir de ahora, el Dockerfile compila admin-ui automáticamente durante el build. Esto significa:

1. **No es necesario** compilar admin-ui localmente
2. **Es necesario** reconstruir la imagen Docker en el servidor de producción
3. La interfaz nueva estará disponible en: `https://lidis.usbcali.edu.co/botusbcali/`

## Pasos para Deploying

### 1. En Mi Máquina Local (Desarrollo)

```bash
# Actualizar código
git add .
git commit -m "Update admin-ui routing"
git push origin main
```

### 2. En el Servidor de Producción (https://lidis.usbcali.edu.co)

```bash
# 1. Navegar al directorio del proyecto
cd /home/fac.ingenieria/botusbcali

# 2. Actualizar código desde Git
git pull origin main

# 3. Reconstruir la imagen Docker (IMPORTANTE - esto compila admin-ui)
docker-compose up -d --build

# 4. Verificar logs para asegurar que admin-ui se compiló
docker-compose logs botusbcali | head -50

# 5. Verificar acceso
curl https://lidis.usbcali.edu.co/botusbcali/
```

## Qué Cambió en el Dockerfile

```dockerfile
# Build admin-ui before starting the server
RUN cd admin-ui && \
    npm install --legacy-peer-deps && \
    npm run build && \
    cd ..
```

Esto asegura que:
- Se instalan dependencias de admin-ui
- Se compila admin-ui con base URL `/botusbcali/` (set en vite.config.ts)
- Se genera `admin-ui/dist/` con todos los archivos necesarios
- El servidor Express sirve desde `/botusbcali/`

## Verificación

### En Navegador
```
https://lidis.usbcali.edu.co/botusbcali/
```

Deberías ver:
- Dashboard de admin-ui ✓
- Interfaz moderna con Tailwind CSS ✓
- Menú lateral con navegación ✓

### En Terminal
```bash
# Verificar que los archivos están en el contenedor
docker exec botusbcali ls -la /app/admin-ui/dist/

# Output esperado:
# total 44
# drwxrwxr-x 3 root root 4096 ... .
# -rw-r--r-- 1 root root 1049 ... index.html
# drwxrwxr-x 2 root root 4096 ... assets
# ...
```

## Troubleshooting

### Sigue apareciendo la interfaz antigua

**Problema**: El cache del navegador aún muestra la interfaz vieja

**Solución**:
```bash
# 1. Limpiar cache en navegador (Ctrl+Shift+Delete)
# 2. O hacer hard refresh (Ctrl+F5)

# 3. En el servidor, verificar que el build se completó
docker-compose logs botusbcali | grep -i "admin-ui\|build"

# 4. Si no ve líneas de build, reconstruir explícitamente
docker-compose down
docker-compose up -d --build
```

### Docker build tarda más tiempo

**Razón**: Ahora compila admin-ui como parte del build

**Esperado**: 
- Primera vez: ~3-5 minutos (instala 400+ paquetes de React)
- Próximas veces: ~1-2 minutos (con cache)

### Error: "Cannot find module" en admin-ui build

**Solución**:
```bash
# Verificar que admin-ui/package.json existe
ls -la admin-ui/package.json

# Verificar que package-lock.json es válido
npm audit --audit-level=moderate admin-ui/

# Limpiar y reintentar
docker-compose down -v
docker-compose up -d --build
```

## Estructura en Producción

```
Container botusbcali:
├── app/
│   ├── src/
│   │   ├── server.js          ← Sirve desde /botusbcali/
│   │   ├── config/
│   │   └── ...
│   ├── admin-ui/
│   │   ├── dist/              ← Compilado con base /botusbcali/
│   │   │   ├── index.html
│   │   │   ├── assets/
│   │   │   └── ...
│   │   ├── src/
│   │   ├── vite.config.ts     ← base = "/botusbcali/" (producción)
│   │   └── ...
│   ├── data/                  ← Volumen montado
│   ├── uploads/               ← Volumen montado
│   └── ...
```

## URLs

| Servicio | URL | Notas |
|----------|-----|-------|
| Admin UI | https://lidis.usbcali.edu.co/botusbcali/ | ← Nueva interfaz |
| API | https://lidis.usbcali.edu.co/api/ | Mismas rutas |
| Webhook | https://lidis.usbcali.edu.co/webhook | Para Telegram |

## Pasos Completados

✅ Dockerfile compila admin-ui
✅ server.js sirve desde /botusbcali/
✅ vite.config.ts base URL = /botusbcali/ en producción
✅ docker-compose.yml configura todo

## Next Steps

### Para que funcione inmediatamente:

```bash
# En el servidor
cd /home/fac.ingenieria/botusbcali
git pull
docker-compose down
docker-compose up -d --build

# Esperar 3-5 minutos para que compile
docker-compose logs -f botusbcali

# Cuando veas "Server listening on port 3000", está listo
# Abre: https://lidis.usbcali.edu.co/botusbcali/
```

---

**Importante**: Los cambios de admin-ui ahora requieren reconstruir la imagen Docker. No se pueden aplicar cambios sin ejecutar `docker-compose up -d --build`.
