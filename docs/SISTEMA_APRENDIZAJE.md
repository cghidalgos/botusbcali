# 🧠 Sistema de Aprendizaje Automático

## 🎯 ¿Cómo Funciona?

El bot ahora **aprende automáticamente** de las preguntas frecuentes:

```
1. Usuario pregunta: "¿Cuál es el correo del Dr. Rodríguez?"
   → Sistema registra pregunta + respuesta

2. Otro usuario pregunta similar: "Email del profesor Rodríguez?"
   → Sistema detecta similitud con pregunta anterior
   → Incrementa contador de frecuencia

3. Después de 3 repeticiones:
   → Sistema agrega automáticamente al entrenamiento
   → Futuras preguntas similares se optimizan
   → ✅ Respuestas más rápidas y baratas
```

## 💾 Persistencia

Todo se guarda en **`data/learned-patterns.json`**:
- Preguntas frecuentes
- Embeddings de cada pregunta
- Contador de frecuencia
- Respuestas cacheadas
- Fecha primera/última vez preguntada

## 📊 Ver Estadísticas

### Desde la API:
```bash
curl http://localhost:9014/api/learning/stats
```

### Respuesta:
```json
{
  "materias": {
    "total": 15,
    "frequent": 5,
    "inTraining": 3,
    "topQuestions": [
      {
        "question": "¿Qué materias hay?",
        "frequency": 12,
        "inTraining": true
      },
      {
        "question": "Cuántos créditos tiene cálculo?",
        "frequency": 8,
        "inTraining": true
      }
    ]
  },
  "profesores": {
    "total": 10,
    "frequent": 3,
    "inTraining": 2,
    ...
  }
}
```

## ⚙️ Configuración

En [src/learningSystem.js](src/learningSystem.js):

```javascript
const SIMILARITY_THRESHOLD = 0.85;     // Similitud para considerar igual
const FREQUENCY_THRESHOLD = 3;         // Repeticiones para aprender
const MAX_LEARNED_PER_CATEGORY = 50;   // Máximo por categoría
```

## 🔄 Flujo Completo

### Primera Pregunta:
```
Usuario: "¿Quién da cálculo?"
  ↓
1. Router → STRUCTURED (materias)
2. Responde desde /data/materias.json
3. Registra: pregunta + respuesta + embedding
   - Frecuencia: 1
   - Estado: observando
```

### Segunda Pregunta Similar:
```
Usuario: "Qué profesor enseña cálculo?"
  ↓
1. Router → STRUCTURED (materias)
2. Responde desde datos locales
3. Sistema detecta similitud (0.87)
4. Incrementa frecuencia: 2
   - Estado: observando
```

### Tercera Pregunta Similar:
```
Usuario: "Docente de cálculo?"
  ↓
1. Router → STRUCTURED (materias)
2. Responde desde datos locales
3. Sistema detecta similitud (0.89)
4. Incrementa frecuencia: 3 ✨
5. 🎯 APRENDE: Agrega a training examples
   - Estado: en entrenamiento
   - Futuras preguntas usan este patrón
```

### Cuarta Pregunta en Adelante:
```
Usuario: "Profesor que dicta cálculo?"
  ↓
1. Router usa patrón aprendido (más eficiente)
2. Respuesta optimizada
3. Contador sigue incrementando
```

## 💰 Optimización de Costos

### Sin Aprendizaje:
- Cada pregunta nueva → Clasificador → GPT
- 100 preguntas similares → 100 clasificaciones

### Con Aprendizaje:
- Primera vez: Clasificador → GPT
- Siguientes: Patrón aprendido (gratis)
- 100 preguntas similares → 3 clasificaciones + 97 gratis
- **Ahorro: ~97%** en preguntas repetidas

## 📈 Beneficios

1. **Auto-mejora continua**
   - Mientras más se usa, mejor funciona
   - No requiere intervención manual

2. **Reduce costos**
   - Preguntas frecuentes no usan API
   - Solo aprende de lo que ya respondió

3. **Mantiene calidad**
   - Solo aprende de respuestas STRUCTURED (datos verificados)
   - No aprende de respuestas GPT (pueden variar)

4. **Persistente**
   - Sobrevive reinicios
   - Se acumula conocimiento a largo plazo

5. **Configurable**
   - Ajusta umbrales según necesidad
   - Limpia patrones antiguos automáticamente

## 🧹 Mantenimiento

### Limpiar patrones antiguos (>90 días):
```javascript
import { cleanOldPatterns } from "./learningSystem.js";

// Limpiar patrones no usados en 90 días
await cleanOldPatterns(90);
```

### Ver qué se está aprendiendo:
```bash
# En los logs verás:
[LEARNING] ✨ Patrón frecuente detectado (3x): "¿Quién da cálculo?"
[LEARNING] → Agregando a ejemplos de entrenamiento: materias
[ML] ✓ Nuevo ejemplo agregado a materias: "¿Quién da cálculo?"
[LEARNING] ✓ Sistema optimizado para esta pregunta
```

## 🎯 Casos de Uso

### Preguntas sobre profesores:
- "Email del Dr. Rodríguez" → se repite → aprende
- Futuras variantes responden más rápido

### Horarios:
- "¿Cuándo es cálculo?" → se repite → aprende
- "Horario de cálculo" → usa patrón aprendido

### Materias:
- "Créditos de programación" → se repite → aprende
- "Cuántos créditos tiene programación" → optimizado

## ⚠️ Limitaciones Actuales

- Solo aprende de consultas **STRUCTURED** (no de GPT)
- Requiere mínimo 3 repeticiones exactas
- Máximo 50 patrones por categoría (configurable)

## 🚀 Futuras Mejoras Posibles

1. **Cache de respuestas GPT** frecuentes
2. **Aprendizaje de variaciones** de preguntas
3. **Detección automática** de nuevas categorías
4. **Dashboard visual** de estadísticas
5. **Exportar/importar** patrones aprendidos
