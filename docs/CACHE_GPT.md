# Cache GPT - Sistema de Optimización de Costos

## 📌 Descripción

El **Cache GPT** es un sistema que guarda respuestas de OpenAI y las reutiliza automáticamente cuando detecta preguntas similares. Esto reduce drásticamente los costos de API al evitar llamadas duplicadas.

## 🎯 Beneficios

- **60-80% de reducción** en llamadas a GPT
- **Respuestas instantáneas** para preguntas frecuentes
- **Sin pérdida de calidad** - respuestas reales de GPT guardadas
- **Inteligente** - usa embeddings para detectar similitud semántica
- **Auto-limpieza** - mantiene el cache optimizado

## 🔧 Funcionamiento

### 1. Flujo de Respuesta con Cache

```
┌─────────────────┐
│ Pregunta Usuario│
└────────┬────────┘
         │
         ▼
┌─────────────────┐       ┌──────────────┐
│ Buscar en Cache │──NO──▶│ Llamar a GPT │
│ (similarity>90%)│       │ + Guardar    │
└────────┬────────┘       └──────┬───────┘
         │ SÍ                    │
         │◀──────────────────────┘
         ▼
┌─────────────────┐
│ Retornar Respuesta│
└─────────────────┘
```

### 2. Detección de Similitud

El sistema calcula embeddings de cada pregunta y compara usando similitud coseno:

- **≥ 0.90**: Cache HIT → Retorna respuesta guardada
- **< 0.90**: Cache MISS → Llama a GPT

### 3. Invalidación Inteligente

El cache invalida automáticamente respuestas cuando:
- Los documentos del contexto cambian
- Han pasado más de 30 días sin uso
- Se alcanza el límite de 500 entradas (mantiene las más usadas)

## 📊 Estadísticas en Tiempo Real

### Ver Stats por Terminal

```bash
npm run cache:stats
```

Muestra:
- Total de respuestas cacheadas
- Hits totales (reutilizaciones)
- Top 10 preguntas más reutilizadas
- Ahorro estimado en USD
- Actividad reciente (24h, 7d, 30d)

### API Endpoints

```javascript
// Obtener estadísticas
GET /api/cache/stats

// Limpiar cache antiguo (>30 días)
POST /api/cache/clean?days=30

// Limpiar todo el cache
POST /api/cache/clear
```

## 🔑 Configuración

### Variables de Entorno (.env)

```bash
# Habilitar/deshabilitar cache
GPT_CACHE_ENABLED=true

# Umbral de similitud (0-1, default: 0.90)
# Valores más altos = más estricto
CACHE_SIMILARITY_THRESHOLD=0.90
```

### Configuración Avanzada (gptCache.js)

```javascript
const SIMILARITY_THRESHOLD = 0.90;  // Similitud mínima
const MAX_CACHE_ENTRIES = 500;      // Máximo de respuestas
const CACHE_TTL_DAYS = 30;          // Días antes de expirar
const MIN_QUESTION_LENGTH = 10;     // No cachear preguntas cortas
```

## 💾 Persistencia

Las respuestas se guardan en:

```
data/gpt-cache.json
```

**Estructura de cada entrada:**

```json
{
  "id": "uuid",
  "question": "¿Cuáles son los requisitos para la beca?",
  "questionEmbedding": [0.123, -0.456, ...],
  "answer": "Los requisitos son...",
  "documentsHash": "md5-hash",
  "documentsCount": 3,
  "createdAt": "2026-02-15T10:30:00Z",
  "lastUsed": "2026-02-15T14:20:00Z",
  "hits": 12
}
```

## 📈 Métricas de Éxito

### Ejemplo de Ahorro Real

Si el bot recibe **100 preguntas/día**:

| Escenario | Sin Cache | Con Cache (70% hit rate) |
|-----------|-----------|--------------------------|
| Llamadas API/día | 100 | 30 |
| Llamadas API/mes | 3,000 | 900 |
| Costo estimado/mes* | $6.00 | $1.80 |
| **Ahorro** | - | **$4.20/mes (70%)** |

*Basado en GPT-4o-mini @ $0.002/llamada

## 🧹 Mantenimiento

### Limpieza Automática

El sistema auto-limpia cuando:
1. Se exceden las 500 entradas → Mantiene las más usadas
2. Entries sin uso por 30 días → Se eliminan
3. Documentos actualizados → Invalida respuestas relacionadas

### Limpieza Manual

```bash
# Ver estadísticas
npm run cache:stats

# Limpiar cache antiguo (API)
curl -X POST http://localhost:3000/api/cache/clean?days=30

# Limpiar todo
curl -X POST http://localhost:3000/api/cache/clear
```

## 🔍 Logs de Operación

El sistema registra todas las operaciones:

```bash
# Cache HIT (respuesta reutilizada)
[CACHE] 🎯 HIT (similarity: 0.95, hits: 8)
[CACHE]    Original: "¿Cuáles son los horarios de atención?"

# Cache MISS (nueva pregunta)
[CACHE] ✗ MISS - No hay respuesta similar en cache

# Guardando nueva respuesta
[CACHE] 💾 Guardada nueva respuesta (total: 42)

# Auto-limpieza
[CACHE] 🧹 Limpiadas 15 entradas antiguas (>30 días)
```

## 🚀 Integración con Otros Sistemas

El Cache GPT trabaja en coordinación con:

1. **Router Híbrido**: Solo cachea consultas que llegan a GPT (no las STRUCTURED)
2. **Learning System**: Complementa aprendizaje - Learning mejora routing, Cache mejora GPT
3. **Token Limits**: Respuestas cacheadas ignoran límite de tokens (ya están generadas)

## ⚠️ Consideraciones

### ¿Cuándo NO usar cache?

Deshabilitar cache (`GPT_CACHE_ENABLED=false`) si:
- Las respuestas cambian constantemente
- Necesitas respuestas únicas cada vez
- Estás en fase de testing/desarrollo del bot

### Hash de Documentos

El sistema genera un hash MD5 de los documentos activos. Si cambias documentos, el cache se invalida automáticamente para esas preguntas.

### Privacidad

Las preguntas y respuestas se guardan en `data/gpt-cache.json`. Si manejas información sensible, considera:
- Encriptar el archivo
- Excluirlo de backups
- Implementar política de borrado periódico

## 📊 Ejemplo de Uso Real

```javascript
// Pregunta 1 (primera vez)
Usuario: "¿Cuáles son los horarios de la biblioteca?"
Sistema: [CACHE] ✗ MISS
         [GPT] Llamando a OpenAI...
         [CACHE] 💾 Guardada nueva respuesta
Tiempo: 2.3s

// Pregunta 2 (similar, horas después)
Usuario: "horarios de biblioteca"
Sistema: [CACHE] 🎯 HIT (similarity: 0.92, hits: 1)
Tiempo: 0.1s ✨ (23x más rápido)

// Pregunta 3 (similar, días después)
Usuario: "cuándo abre la biblioteca?"
Sistema: [CACHE] 🎯 HIT (similarity: 0.91, hits: 2)
Tiempo: 0.1s ✨
```

## 🎓 Mejores Prácticas

1. **Monitorear regularmente**: Usa `npm run cache:stats` semanalmente
2. **Ajustar umbral**: Si hay muchos MISS para preguntas similares, baja `SIMILARITY_THRESHOLD` a 0.85
3. **Limpiar periódicamente**: Ejecuta limpieza manual cada 3 meses
4. **Combinar estrategias**: Usa Cache + Learning System + Router Híbrido para máximo ahorro

## 🔮 Roadmap Futuro

- [ ] Cache con diferentes contextos (por usuario, por horario)
- [ ] Análisis de patrones de uso
- [ ] Exportación de estadísticas a CSV
- [ ] Dashboard web para visualización
- [ ] Cache distribuido (Redis/Memcached)

---

**Resultado Final**: Combinando Router Híbrido (80% free) + Cache GPT (60% adicional en GPT) + Token Limits = **~85-90% reducción total de costos** 🎉
