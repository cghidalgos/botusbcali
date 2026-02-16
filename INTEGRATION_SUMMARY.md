# Admin UI Integration Summary

Se ha integrado exitosamente la interfaz de administración (admin-ui) a la aplicación botusbcali.

## Cambios Realizados

### 1. **Nueva Carpeta admin-ui**
- Copié toda la estructura del proyecto admin-ui React/Vite/TypeScript
- Ubicación: `/admin-ui/`
- Build de producción: `/admin-ui/dist/` (generado automáticamente)

### 2. **Nuevos Stores de Datos**
Se crearon tres nuevos stores de datos en `src/config/`:

- **learningStore.js**: Gestiona patrones de aprendizaje y preguntas frecuentes
- **categoriesStore.js**: Gestiona categorías de respuestas y sugerencias
- **cacheStore.js**: Rastrear estadísticas de caché y ahorros de API

### 3. **Nuevos Endpoints de API**
Se agregaron 30+ nuevos endpoints para soportar todas las funcionalidades de admin-ui:

#### Caché
- `GET /api/cache/stats` - Estadísticas de caché

#### Learning Patterns
- `GET /api/learning/stats` - Estadísticas de aprendizaje
- `GET /api/learning/patterns` - Listar patrones de aprendizaje
- `PUT /api/learning/patterns/:id` - Actualizar patrón
- `DELETE /api/learning/patterns/:id` - Eliminar patrón

#### Perfiles
- `GET /api/profiles/stats` - Estadísticas de perfiles de usuarios

#### Usuarios
- `GET /api/users/:userId/history` - Historial del usuario
- `POST /api/users/:userId/history/clear` - Limpiar historial del usuario
- `POST /api/users/:userId/block` - Bloquear/desbloquear usuario

#### Categorías
- `GET /api/categories` - Listar categorías
- `DELETE /api/categories/:name` - Eliminar categoría

#### Categorías Sugeridas
- `GET /api/suggested-categories` - Listar todas las sugerencias
- `GET /api/suggested-categories/pending` - Sugerencias pendientes
- `POST /api/suggested-categories/:id/approve` - Aprobar sugerencia
- `POST /api/suggested-categories/:id/reject` - Rechazar sugerencia
- `PUT /api/suggested-categories/:id` - Actualizar sugerencia

### 4. **Actualización de package.json**
Nuevos scripts:
- `npm start` - Buildea admin-ui y inicia el servidor
- `npm run dev` - Inicia desarrollo con hot reload del servidor
- `npm run dev:admin` - Inicia desarrollo de admin-ui en puerto 8080
- `npm run build:admin` - Buildea admin-ui sin iniciar servidor

### 5. **Integración del Servidor**
- El servidor Express ahora sirve los archivos de `admin-ui/dist/` como estáticos
- La interfaz está disponible en la raíz del servidor (`/`)
- Los endpoints de API se proxyman correctamente

## Estructura Generada

```
botusbcali/
├── admin-ui/                    # Nueva carpeta
│   ├── src/
│   │   ├── pages/              # Páginas (Dashboard, Context, Documents, etc.)
│   │   ├── components/         # Componentes UI reutilizables
│   │   ├── lib/
│   │   │   ├── api.ts          # Todas las llamadas de API
│   │   │   └── utils.ts
│   │   └── App.tsx
│   ├── dist/                   # Build de producción (generado)
│   ├── node_modules/           # Dependencias (generadas)
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   └── tsconfig.json
├── src/
│   ├── server.js               # Actualizado para servir admin-ui
│   ├── config/
│   │   ├── learningStore.js    # Nuevo
│   │   ├── categoriesStore.js  # Nuevo  
│   │   ├── cacheStore.js       # Nuevo
│   │   └── ... (otros stores)
│   └── ... (otros archivos)
├── package.json                # Actualizado con nuevos scripts
└── ADMIN_UI_SETUP.md           # Documentación de admin-ui

```

## Cómo Usar

### Desarrollo
```bash
# Terminal 1: Servidor principal (con hot reload)
npm run dev

# Terminal 2: Interfaz admin-ui (con hot reload)
npm run dev:admin
```

- Servidor: http://localhost:3000
- Admin UI Dev: http://localhost:8080

### Producción
```bash
# Instalar dependencias
npm install

# Iniciar (buildea admin-ui automáticamente)
npm start
```

- Todo disponible en: http://localhost:3000

## Características de Admin UI

### 📊 Dashboard
- Vista general del estado del bot
- Estadísticas de usuarios y actividad

### 📝 Contexto
- Editar prompt base del bot
- Agregar notas adicionales
- Gestionar template de respuestas

### 📄 Documentos
- Subir archivos (PDF, Word, Excel, etc.)
- Subir desde URLs
- Extraer contenido de sitios web
- Ver estado de procesamiento
- Resúmenes automáticos y manuales

### 👥 Usuarios
- Listar usuarios de Telegram
- Ver historial de conversaciones
- Bloquear/desbloquear usuarios
- Ver preferencias de conversación

### 📚 Historial
- Ver todas las preguntas y respuestas
- Buscar en el historial
- Limpiar historial

### 🏷️ Categorías
- Gestionar categorías de respuestas
- Ver sugerencias de nuevas categorías
- Aprobar/rechazar categorías sugeridas

### 🧠 Aprendizaje
- Ver patrones de aprendizaje
- Rastrear preguntas frecuentes
- Estadísticas de categorías

### ⚡ Caché
- Ver estadísticas de ahorros de API
- Rastrear hits de caché
- Estimaciones de costos ahorrados

### 📊 Actividad
- Monitor en tiempo real
- Log de eventos del sistema

## Notas Importantes

1. **Build automático**: Al ejecutar `npm start`, se compila admin-ui automáticamente antes de iniciar el servidor.

2. **Datos persistentes**: Todos los datos se guardan en archivos JSON en la carpeta `data/`.

3. **Puertos**:
   - Servidor: `3000`
   - Admin UI (desarrollo): `8080`

4. **Variables de entorno**: Ver el archivo de raíz `.env` y `admin-ui/.env` para configuración.

5. **Hot reload**: En modo desarrollo, ambas terminales soportan recarga automática.

## Próximas Mejoras Sugeridas

- [ ] Agregar autenticación a admin-ui
- [ ] Implementar base de datos persistente
- [ ] Agregar más gráficos y estadísticas
- [ ] Integración con webhooks para actualizaciones en tiempo real
- [ ] Exportar datos a CSV/Excel
- [ ] Sistema de respaldos automáticos
