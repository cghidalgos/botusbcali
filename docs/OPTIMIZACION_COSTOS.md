# 📚 Sistema de Documentos - Optimización de Costos

## 🎯 Cómo Funciona

### Tu sistema está optimizado para minimizar costos de API:

```
┌─────────────────────────────────────────────────────┐
│  SUBIR DOCUMENTO (Una sola vez)                     │
├─────────────────────────────────────────────────────┤
│  1. Extraer texto          → GRATIS (local)         │
│  2. Dividir en chunks      → GRATIS (local)         │
│  3. Generar embeddings     → PAGO (OpenAI)          │
│  4. Guardar en disco       → GRATIS (persistencia)  │
└─────────────────────────────────────────────────────┘
           ↓ (se guarda en data/documents.json)
┌─────────────────────────────────────────────────────┐
│  REINICIAR SERVIDOR                                  │
├─────────────────────────────────────────────────────┤
│  1. Cargar documents.json  → Embeddings ya están    │
│  2. NO re-generar          → GRATIS ✅              │
└─────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────┐
│  HACER PREGUNTA                                      │
├─────────────────────────────────────────────────────┤
│  1. Embedding pregunta     → PAGO (micro-costo)     │
│  2. Buscar similitud       → GRATIS (local)         │
│  3. GPT respuesta final    → PAGO (principal)       │
└─────────────────────────────────────────────────────┘
```

## 💰 Desglose de Costos

### Costos ÚNICOS (por documento):
- **Embedding del documento**: ~$0.0001 por cada 1000 palabras
  - Ejemplo: Documento de 10 páginas ≈ $0.0005-$0.001

### Costos POR CONSULTA:
- **Embedding de pregunta**: ~$0.00001 (negligible)
- **Respuesta GPT-4o-mini**: ~$0.0003-$0.002
  - Depende de longitud de contexto y respuesta

### GRATIS (0 costo):
- ✅ Almacenamiento de embeddings en disco
- ✅ Carga de documentos al iniciar
- ✅ Búsqueda por similitud (local)
- ✅ Consultas estructuradas (materias, profesores, horarios, becas)
- ✅ Router ML Scoring (80% de queries gratis)

## 📊 Ejemplo Real:

**Escenario:** Bot universitario con 50 documentos

1. **Setup inicial:**
   - 50 documentos × $0.001 = **$0.05 una sola vez**

2. **Uso mensual (1000 preguntas):**
   - 200 estructuradas → $0 (datos locales)
   - 800 con GPT → 800 × $0.001 = **$0.80/mes**

**Total primer mes:** $0.05 + $0.80 = **$0.85**
**Meses siguientes:** **$0.80** (documentos ya tienen embeddings)

## 🔧 Verificar Estado

```bash
# Ver documentos almacenados y sus embeddings
node scripts/verifyDocuments.js
```

Esto te mostrará:
- Cuántos documentos tienes
- Cuántos chunks con embeddings
- Si hay problemas de persistencia
- Estimación de ahorro de costos

## 📁 Archivos Persistentes

Todo se guarda en la carpeta `data/` que está mapeada en Docker:

```
data/
├── documents.json      ← Documentos + embeddings (persiste)
├── materias.json       ← Datos estructurados (gratis)
├── profesores.json     ← Datos estructurados (gratis)
├── horarios.json       ← Datos estructurados (gratis)
├── becas.json          ← Datos estructurados (gratis)
├── coordinadores.json  ← Datos estructurados (gratis)
├── history.json        ← Historial de conversaciones
└── memory.json         ← Memoria del bot
```

## 🗑️ Eliminar Documentos

Cuando eliminas un documento:
1. Se borra de `documents.json`
2. Se elimina de la fuente de conocimiento
3. Liberas espacio en disco
4. El bot ya no usará esa información

## ⚠️ Importante

### NUNCA se re-generan embeddings si ya existen
- Los embeddings se guardan con el documento
- Al reiniciar, se cargan desde disco
- Solo se generan embeddings nuevos para documentos nuevos

### Persistencia garantizada
- Docker volume mapea `./data:/app/data`
- Aunque elimines el contenedor, los datos persisten
- Solo se pierden si borras la carpeta `data/`

## 🚀 Mejores Prácticas

1. **Sube documentos de calidad**
   - Mejor pocos documentos buenos que muchos malos
   - Limpia PDFs escaneados si es posible

2. **Usa datos estructurados cuando puedas**
   - Materias, profesores, horarios → JSON gratis
   - Solo usa documentos para contenido complejo

3. **Monitorea costos**
   - Verifica con `node scripts/verifyDocuments.js`
   - La mayoría de preguntas deberían ir a STRUCTURED

4. **Elimina documentos obsoletos**
   - Reduce espacio y ruido en búsquedas
   - Mantén solo información relevante

## 📈 Optimización Adicional

El sistema híbrido ya optimiza:
- **80% de queries** → ML Scoring (gratis)
- **15% de queries** → Embeddings classifier ($0.00001)
- **5% ambiguas** → GPT completo ($0.001-$0.002)

Esto reduce costos en ~70% comparado con enviar todo a GPT.
