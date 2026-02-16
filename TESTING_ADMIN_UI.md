# Testing the Admin UI Integration

## Pre-requisitos

- Node.js v18+
- npm o yarn
- Variables de entorno configuradas en `.env`

## Quick Start

### 1. Instalar dependencias
```bash
npm install
```

### 2. Buildear admin-ui
```bash
npm run build:admin
```

### 3. Iniciar el servidor
```bash
npm start
```

El servidor iniciará en `http://localhost:3000`

## Verificar la Integración

### Test 1: Acceder a la Interfaz
```bash
# En tu navegador, abre:
# http://localhost:3000
```

Deberías ver el dashboard de admin-ui con todos los menús.

### Test 2: Verificar Endpoints de API

```bash
# Test: GET /api/cache/stats
curl http://localhost:3000/api/cache/stats
# Respuesta esperada: { "totalEntries": 0, "totalHits": 0, ... }

# Test: GET /api/learning/stats
curl http://localhost:3000/api/learning/stats
# Respuesta esperada: { "totalPatterns": 0, "byCategory": {} }

# Test: GET /api/categories
curl http://localhost:3000/api/categories
# Respuesta esperada: { "categories": [], "total": 0 }

# Test: GET /api/profiles/stats
curl http://localhost:3000/api/profiles/stats
# Respuesta esperada: { "totalUsers": 0, "usersWithNames": 0, "activeUsers": 0 }
```

### Test 3: Verificar Documentos
```bash
# Listar documentos
curl http://localhost:3000/api/documents

# Upload un archivo (test.txt)
echo "Test document" > test.txt
curl -F "document=@test.txt" -F "summary=Test document" \
  http://localhost:3000/api/documents

# Limpiar
rm test.txt
```

### Test 4: Verificar Historial
```bash
# Obtener historial
curl http://localhost:3000/api/history

# Limpiar historial
curl -X POST http://localhost:3000/api/history/clear
```

### Test 5: Verificar Usuarios
```bash
# Listar usuarios
curl http://localhost:3000/api/users

# Si tienes un usuario, prueba bloquear (reemplaza 12345 con ID real)
curl -X POST http://localhost:3000/api/users/12345/block \
  -H "Content-Type: application/json" \
  -d '{"blocked": true}'
```

## Desarrollo

### Terminal 1: Servidor con Hot Reload
```bash
npm run dev
```

El servidor recargará automáticamente cuando cambies archivos en `src/`

### Terminal 2: Admin UI con Hot Reload
```bash
npm run dev:admin
```

La interfaz recargará automáticamente cuando cambies archivos en `admin-ui/src/`

- Servidor: http://localhost:3000
- Admin UI: http://localhost:8080

## Estado de los Store

### Data Persistence

Los datos se guardan en archivos JSON:

```
data/
├── learning.json          # Patrones de aprendizaje
├── categories.json        # Categorías y sugerencias
├── context.json           # Contexto del bot
├── documents.json         # Metadata de documentos
├── history.json           # Historial Q&A
├── memory.json            # Memoria del bot
└── telegramUsers.json     # Usuarios de Telegram
```

### Verificar Datos Guardados

```bash
# Ver categorías guardadas
cat data/categories.json

# Ver patrones de aprendizaje
cat data/learning.json

# Ver usuarios
cat data/telegramUsers.json
```

## Troubleshooting

### "Cannot find module" errors

```bash
# Reinstalar node_modules
rm -rf node_modules admin-ui/node_modules
npm install
npm run build:admin
```

### Puerto 3000 ocupado

```bash
# Usar puerto diferente
PORT=3001 npm start
```

### Admin UI no carga

1. Verificar que el build se completó:
   ```bash
   ls -la admin-ui/dist/
   ```

2. Verificar que los archivos se sirven:
   ```bash
   curl http://localhost:3000/ | grep -i admin
   ```

3. Revisar la consola del servidor para errores

### CORS errors

Verificar que CORS está habilitado en `src/server.js`:
```javascript
app.use(cors());
```

## Flujo Completo de Uso

1. **Acceder a Admin UI**: http://localhost:3000
2. **Configurar Contexto**: `/contexto` - Define el prompt base
3. **Subir Documentos**: `/documentos` - Carga tus fuentes de conocimiento
4. **Monitorear Usuarios**: `/usuarios` - Gestiona usuarios de Telegram
5. **Ver Historial**: `/historial` - Revisa preguntas y respuestas
6. **Gestionar Categorías**: `/categorias` - Organiza tipos de respuestas
7. **Análisis**: `/actividad`, `/aprendizaje`, `/caché` - Estadísticas

## Performance

El admin-ui está optimizado para:
- **Carga**: ~1.2MB de HTML/CSS/JS total
- **Desarrollo**: Hot reload instantáneo
- **Producción**: Assets minimizados y gzipeados

## Próximos Pasos

1. Configurar el bot de Telegram con el TELEGRAM_BOT_TOKEN
2. Agregar tu API key de OpenAI
3. Subir los primeros documentos de referencia
4. Configurar el prompt base
5. Ver el bot en acción en Telegram

---

¿Preguntas o problemas? Revisa los logs del servidor para más detalles:

```bash
# Ver logs del servidor
npm start 2>&1 | tee server.log
```
