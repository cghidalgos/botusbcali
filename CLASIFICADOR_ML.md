# GUÍA DE INTEGRACIÓN: Clasificadores ML

## 🎯 Opciones Disponibles

### 1. **ML Scoring** (Recomendado para empezar)
- ✅ No requiere llamadas a API
- ✅ Más preciso que regex
- ✅ Rápido y eficiente
- ✅ Configurable con keywords
- ❌ No entiende sinónimos complejos

### 2. **Embeddings OpenAI** (Máxima precisión)
- ✅ Comprensión semántica profunda
- ✅ Maneja sinónimos y parafraseo
- ✅ Auto-mejora con ejemplos
- ❌ Requiere API de OpenAI
- ❌ Más lento (llamada a API)
- ❌ Costo por cada clasificación

### 3. **Hybrid** (Balance perfecto)
- ✅ Scoring primero (gratis y rápido)
- ✅ Embeddings solo si hay duda
- ✅ Mejor de ambos mundos
- ❌ Mayor complejidad

---

## 🔧 Cómo Integrar

### Paso 1: Elegir estrategia

Edita [src/server.js](src/server.js) y reemplaza el import del router:

**Opción A: Usar ML Scoring (recomendado)**
```javascript
// Cambiar esta línea:
import { detectStructuredIntent } from "./router.js";

// Por esta:
import { classifyIntent as detectStructuredIntent } from "./mlClassifier.js";
```

**Opción B: Usar Embeddings**
```javascript
// Cambiar:
import { detectStructuredIntent } from "./router.js";

// Por:
import { classifyIntentWithEmbeddings } from "./embeddingsClassifier.js";

// Y modificar el webhook para hacer await:
const intent = await classifyIntentWithEmbeddings(text);
```

**Opción C: Usar intelligentRouter (configurable)**
```javascript
// Cambiar:
import { detectStructuredIntent } from "./router.js";

// Por:
import { detectStructuredIntent } from "./intelligentRouter.js";
```

Luego configura la estrategia en `.env`:
```bash
CLASSIFIER_STRATEGY=scoring    # o "regex", "embeddings", "hybrid"
```

### Paso 2: Si usas Embeddings, inicializar al arranque

En [src/server.js](src/server.js), después de las importaciones:

```javascript
import { initializeEmbeddingsClassifier } from "./embeddingsClassifier.js";

// Después de app.use(...)
(async () => {
  await initializeEmbeddingsClassifier();
  console.log("Clasificador ML inicializado");
})();
```

### Paso 3: Ajustar el webhook para async (solo si usas Embeddings)

En [src/server.js](src/server.js), línea ~289:

```javascript
// ANTES:
const intent = detectStructuredIntent(text);

// DESPUÉS (si usas embeddings):
const intent = await detectStructuredIntent(text);
```

---

## 🧪 Probar Clasificadores

### Comparar las 3 estrategias:
```bash
npm run test:classifiers
```

Esto mostrará cómo cada clasificador interpreta las mismas preguntas.

### Ejemplo de salida:
```
📝 Pregunta: "¿Qué materias hay?"

1️⃣ REGEX:      ✓ materias
2️⃣ SCORING:    ✓ materias (score: 3, conf: 0.85)
3️⃣ EMBEDDINGS:  ✓ materias (sim: 0.92, conf: 0.95)

✅ Consenso: Todos clasifican como "materias"
```

---

## ⚙️ Configuración Avanzada

### ML Scoring: Ajustar threshold

En [src/mlClassifier.js](src/mlClassifier.js):
```javascript
classifyIntent(question, 1.5)  // Más bajo = más sensible
```

### Embeddings: Ajustar threshold

En [src/embeddingsClassifier.js](src/embeddingsClassifier.js):
```javascript
classifyIntentWithEmbeddings(question, 0.65)  // 0-1, más bajo = más sensible
```

### Agregar nuevas keywords (Scoring)

```javascript
import { addKeyword } from "./mlClassifier.js";

addKeyword("becas", "financiación");
addKeyword("profesores", "catedrático");
```

### Agregar ejemplos de entrenamiento (Embeddings)

```javascript
import { addTrainingExample } from "./embeddingsClassifier.js";

await addTrainingExample("materias", "¿Qué clases puedo tomar?");
await addTrainingExample("profesores", "Quién da esta materia?");
```

---

## 📊 Benchmark Estimado

| Estrategia | Precisión | Velocidad | Costo API | Recomendado para |
|-----------|-----------|-----------|-----------|------------------|
| Regex     | 70%       | 1ms       | $0        | MVP rápido       |
| Scoring   | 85%       | 2ms       | $0        | **Producción**   |
| Embeddings| 95%       | 200ms     | $0.0001/q | Alta precisión   |
| Hybrid    | 90%       | 50ms      | $0.00003/q| **Balance ideal**|

---

## 🎯 Recomendación Final

**Para tu caso (Bot USB Cali):**

1. **Empezar con:** `ML Scoring`
   - Gratis, rápido, mejor que regex
   - Cambio mínimo en código

2. **Evolucionar a:** `Hybrid`
   - Cuando tengas más tráfico
   - Usa scoring para 80% de queries
   - Embeddings solo para casos ambiguos

3. **Usar Embeddings puro solo si:**
   - Necesitas máxima precisión
   - El costo API no es problema
   - Latencia de 200ms es aceptable

---

## 🚀 Implementación Paso a Paso

### Opción Rápida (5 minutos)

1. **Cambiar una línea** en [src/server.js](src/server.js):
   ```javascript
   import { classifyIntent as detectStructuredIntent } from "./mlClassifier.js";
   ```

2. **Listo!** Ya tienes ML sin costo ni configuración.

### Opción Robusta (15 minutos)

1. **Usar intelligentRouter:**
   ```javascript
   import { detectStructuredIntent } from "./intelligentRouter.js";
   ```

2. **Configurar en .env:**
   ```bash
   CLASSIFIER_STRATEGY=hybrid
   ```

3. **Inicializar embeddings en server.js:**
   ```javascript
   import { initializeEmbeddingsClassifier } from "./embeddingsClassifier.js";
   
   // Después de app.use(...)
   (async () => {
     await initializeEmbeddingsClassifier();
   })();
   ```

4. **Hacer el webhook async:**
   ```javascript
   const intent = await detectStructuredIntent(text);
   ```

5. **Reiniciar servidor.**

---

## 📈 Monitoreo

Agrega estadísticas al endpoint `/api/config`:

```javascript
import { getClassifierStats } from "./embeddingsClassifier.js";

app.get("/api/classifier/stats", (req, res) => {
  res.json(getClassifierStats());
});
```

Respuesta:
```json
{
  "status": "inicializado",
  "categorias": 5,
  "ejemplos_por_categoria": {
    "materias": 5,
    "profesores": 5,
    "horarios": 5,
    "becas": 5,
    "coordinadores": 5
  },
  "total_ejemplos": 25
}
```
