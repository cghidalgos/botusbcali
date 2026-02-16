# Integración Admin UI

La interfaz de administración (admin-ui) ha sido integrada al proyecto. Esta proporciona un dashboard completo para gestionar:

- **Contexto**: Editar el prompt base y notas adicionales
- **Documentos**: Subir y gestionar documentos de referencia
- **Historial**: Ver el historial de preguntas y respuestas
- **Usuarios**: Gestionar usuarios de Telegram
- **Categorías**: Gestionar categorías de respuestas
- **Aprendizaje**: Rastrear y gestionar patrones de aprendizaje
- **Actividad**: Monitorear la actividad del bot

## Instalación y Uso

### Desarrollo

Para desarrollar la interfaz mientras se ejecuta el servidor:

```bash
# Terminal 1: Iniciar el servidor (con hot reload)
npm run dev

# Terminal 2: Desarrollar admin-ui (con hot reload)
npm run dev:admin
```

El servidor se ejecutará en `http://localhost:3000` y la interfaz de desarrollo en `http://localhost:8080`.

### Producción

Para construir la interfaz completa:

```bash
# Instalar dependencias del servidor
npm install

# Iniciar el servidor (incluye build de admin-ui automáticamente)
npm start
```

La interfaz estará disponible en `http://localhost:3000/` (servidor raíz).

## Estructura del Proyecto

```
.
├── admin-ui/                 # Interfaz React + TypeScript + Vite
│   ├── src/
│   │   ├── pages/           # Páginas principales
│   │   ├── components/      # Componentes UI
│   │   ├── lib/            # Utilidades y llamadas API
│   │   └── App.tsx         # Componente principal
│   ├── dist/               # Build de producción (generado)
│   └── package.json
├── src/
│   ├── server.js           # Servidor Express
│   ├── config/             # Stores de datos
│   │   ├── contextStore.js
│   │   ├── documentStore.js
│   │   ├── historyStore.js
│   │   ├── userStore.js
│   │   ├── learningStore.js    # Nuevo
│   │   ├── categoriesStore.js  # Nuevo
│   │   └── cacheStore.js       # Nuevo
│   └── ...
└── package.json
```

## API Endpoints

La interfaz se conecta con los siguientes endpoints:

### Configuración
- `GET /api/config` - Obtener configuración actual
- `POST /api/config/context` - Actualizar contexto del bot

### Documentos
- `GET /api/documents` - Listar documentos
- `POST /api/documents` - Subir archivo
- `POST /api/documents/url` - Subir desde URL
- `POST /api/documents/web` - Extraer desde web
- `POST /api/documents/html` - Subir HTML
- `DELETE /api/documents/:id` - Eliminar documento

### Historial
- `GET /api/history` - Obtener historial
- `POST /api/history/clear` - Limpiar historial

### Usuarios
- `GET /api/users` - Listar usuarios
- `POST /api/users/:userId/message` - Enviar mensaje
- `POST /api/users/:userId/block` - Bloquear usuario
- `GET /api/users/:userId/history` - Historial del usuario

### Estadísticas
- `GET /api/cache/stats` - Estadísticas de caché
- `GET /api/profiles/stats` - Estadísticas de perfiles

### Aprendizaje
- `GET /api/learning/stats` - Estadísticas de aprendizaje
- `GET /api/learning/patterns` - Listar patrones
- `PUT /api/learning/patterns/:id` - Actualizar patrón
- `DELETE /api/learning/patterns/:id` - Eliminar patrón

### Categorías
- `GET /api/categories` - Listar categorías
- `DELETE /api/categories/:name` - Eliminar categoría
- `GET /api/suggested-categories` - Categorías sugeridas
- `GET /api/suggested-categories/pending` - Sugerencias pendientes
- `POST /api/suggested-categories/:id/approve` - Aprobar sugerencia
- `POST /api/suggested-categories/:id/reject` - Rechazar sugerencia

## Variables de Entorno

### admin-ui/.env (Desarrollo)
```env
VITE_API_BASE=        # Base URL para la API (vacío para mismo origen)
VITE_API_TARGET=http://localhost:3000  # Target para proxy en dev
```

### .env (Raíz del proyecto)
Las variables del servidor principal (TELEGRAM_BOT_TOKEN, OPENAI_API_KEY, etc.)

## Notas Importantes

- El build de admin-ui ocurre automáticamente al ejecutar `npm start`
- Durante desarrollo, puedes ejecutar `npm run dev:admin` para el hot reload de la UI
- Los datos se persisten en archivos JSON en la carpeta `data/`
- La interfaz se sirve como archivos estáticos desde el servidor Express
