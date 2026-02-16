# Auto-Categorías con Control de Spam - Guía Rápida

## ¿Cómo funciona?

### Flujo Automático
1. **Usuario hace pregunta sin clasificar** (sin matching en categorías existentes)
   - Ejemplo: "¿Cuál es el horario de atención de la biblioteca?"
2. **Sistema auto-genera categoría sugerida**
   - Extrae palabras clave: ["biblioteca", "horario", "atención"]
   - Detecta patrón: "horario"
   - Guarda en `data/suggested-categories.json`
3. **Admin revisa en panel**
   - URL: `http://localhost:9014/admin/categorias`
   - Tab "Pendientes (N)" muestra las nuevas

### Panel de Control Admin

#### Tab: PENDIENTES
- Muestra categorías esperando aprobación
- Estado: **PENDIENTE** (amarillo)
- Acciones:
  - ✅ **Aprobar**: Convierte a categoría real, activa inmediatamente
  - ❌ **Rechazar**: Descarta la sugerencia
  - ✏️ **Editar**: Ajusta nombre y palabras clave
  - 🗑️ **Eliminar**: Quita la sugerencia

#### Tab: TODAS
- Muestra todas las categorías sugeridas (pending, approved, rejected)
- Útil para auditoría histórica

#### Detalles de Categoría Seleccionada
- **Nombre**: Identificador interno (generado)
- **Nombre Visible**: Título mostrado a usuarios
- **Pregunta Original**: La que generó esta categoría
- **Palabras Clave**: Editables, para mejorar detección
- **Patrón de Detección**: Expresión regular que se usa
- **Creada**: Timestamp
- **Veces Sugerida**: Contador si aparece múltiples veces

## Ejemplo Práctico

### Paso 1: Usuario pregunta algo nuevo
```
Usuario: "¿Dónde consigo becas?"
Bot: "No tengo información exacta... [respuesta GPT]"
```

### Paso 2: Sistema crea sugerencia automáticamente
```json
{
  "id": "1708000123456",
  "name": "becas",
  "displayName": "Becas",
  "question": "¿Dónde consigo becas?",
  "keywords": ["becas", "donde", "consigo"],
  "pattern": "lista",
  "userId": "123456789",
  "createdAt": "2026-02-15T10:30:00Z",
  "status": "pending",
  "count": 1
}
```

### Paso 3: Admin aprueba en el panel
- Entra a Categorías → ve "becas" en Pendientes
- **Opción A**: Clic en ✅ Aprobar
  - Sistema crea archivo `data/becas.json` vacío
  - Agrega a `config/categories.json`
  - Ahora preguntas sobre "becas" se clasifican como estructuradas
  
- **Opción B**: Edita antes
  - Cambia Nombre Visible a "Becas Disponibles"
  - Ajusta Palabras Clave: "becas, ayuda económica, financiamiento"
  - Luego ✅ Aprobar con cambios

- **Opción C**: Rechaza ❌
  - Si es spam o poco relevante
  - Se marca como "rejected"

## Prevención de Spam

| Caso | Acción |
|------|--------|
| **Nueva pregunta nueva** | Se crea sugerencia automática → Pendiente |
| **Palabra clave duplicada** | Incrementa `count` en sugerencia existente |
| **Admin aprueba** | Se activa en sistema, comienza clasificación |
| **Admin rechaza** | Se marca rejected, no se activa |
| **Admin elimina** | Se borra por completo |

## Archivos Relacionados

```
data/
  ├── suggested-categories.json   ← Almacena sugerencias pendientes
  ├── profesores.json             ← Datos de categoría activa
  ├── becas.json                  ← Se crea cuando se aprueba
  └── [otros].json                ← Categorías activas

config/
  └── categories.json             ← Define qué categorías están activas

src/
  ├── autoCategoryGenerator.js    ← Lógica de auto-detección
  ├── intelligentRouter.js        ← Enruta preguntas a categorías
  └── server.js                   ← API endpoints
```

## Endpoints API

```bash
# Obtener todas las sugeridas
GET /api/suggested-categories

# Obtener solo pendientes
GET /api/suggested-categories/pending

# Aprobar una sugerencia (convierte a categoría real)
POST /api/suggested-categories/:id/approve
Body: { "approverUserId": "admin" }

# Rechazar una sugerencia
POST /api/suggested-categories/:id/reject

# Editar una sugerencia
PATCH /api/suggested-categories/:id
Body: { "displayName": "Nuevo Nombre", "keywords": ["palabra1", "palabra2"] }

# Eliminar una sugerencia
DELETE /api/suggested-categories/:id
```

## Configuración

En `.env` (opcional):
```bash
CLASSIFIER_STRATEGY=hybrid  # Estrategia para detectar intenciones
```

Umbrales de clasificación en `src/mlClassifier.js`:
- `threshold = 1.0` (predeterminado para "Opción 3")
- `confidence = 0.6+` (mínimo para considerar válido)

## Troubleshooting

### No aparecen categorías pendientes
- Verificar que `data/suggested-categories.json` existe y es readable
- Ver logs del backend: `[AUTO-CATEGORIES] ✓ Categoría sugerida: ID`

### Una categoría no activa después de aprobar
- Verificar que `data/nombreCategoria.json` fue creado
- Verificar que `config/categories.json` contiene la categoría

### Palabras clave no detectan preguntas
- Editar la sugerencia antes de aprobar
- Agregar sinónimos: "becas, ayuda, subvención, crédito"

## Próximos Pasos

- Monitorear preguntas sin clasificación
- Ajustar umbrales si es necesario
- Limpiar categorías rechazadas periódicamente
- Agregar datos a `data/categoriaAprobada.json` una vez activada
