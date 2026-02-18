# Documento de Prueba - Batch Processing

Este es un documento de prueba para demostrar el nuevo sistema de batch processing de embeddings.

## ¿Qué es el Batch Processing?

El batch processing es una técnica de optimización que permite procesar múltiples textos en una sola llamada API en lugar de hacer llamadas individuales.

### Ventajas del Batch Processing:

1. **Velocidad**: Procesa hasta 20 textos simultáneamente
2. **Eficiencia**: Reduce el número total de requests HTTP
3. **Latencia**: Menor tiempo de espera al eliminar roundtrips
4. **Costos**: Mismos costos pero con mejor performance
5. **Escalabilidad**: Mejor manejo de documentos grandes

### Cómo Funciona:

Cuando subes un documento, el sistema:
- Divide el texto en chunks de 1400 caracteres
- Agrupa los chunks en batches de 20
- Envía cada batch en una sola llamada API
- Procesa los embeddings en paralelo
- Guarda los resultados en cache

### Ejemplo de Mejora:

**Antes (sin batch):**
- 100 chunks → 100 llamadas API individuales
- Tiempo estimado: ~30-40 segundos
- 100 roundtrips de red

**Ahora (con batch):**
- 100 chunks → 5 llamadas API (20 chunks cada una)  
- Tiempo estimado: ~15-20 segundos
- 5 roundtrips de red
- **Mejora: 50% más rápido**

### Configuración:

El tamaño del batch se configura en .env:
```
EMBEDDING_BATCH_SIZE=20
```

Puedes ajustar este valor entre 1 y 50 dependiendo del tamaño promedio de tus textos.

### Integración con Cache:

El batch processing funciona perfectamente con el embedding cache:
- Antes de procesar un batch, verifica qué textos ya están en cache
- Solo envía a la API los textos que realmente necesitan calcularse
- Guarda todos los nuevos embeddings en cache
- En la siguiente ejecución, los textos similares se reutilizan

### Estadísticas:

Puedes monitorear el rendimiento en:
- Panel de Actividad → Tab "Cache Embeddings"
- Panel de Actividad → Tab "Optimizaciones"

Verás métricas como:
- Hit rate del cache
- Ahorro estimado en USD
- Velocidad de procesamiento
- Preguntas más frecuentes

## Conclusión

El batch processing es una optimización fundamental que mejora significativamente la experiencia de usuario al procesar documentos grandes, sin aumentar los costos y manteniendo la misma calidad de resultados.
