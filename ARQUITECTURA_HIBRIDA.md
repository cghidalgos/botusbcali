# Arquitectura Híbrida - Bot USB Cali

## 📋 Resumen

El bot ahora implementa una **arquitectura híbrida** que optimiza las respuestas:

- **Consultas estructuradas** → Datos locales JSON (sin OpenAI, sin embeddings)
- **Consultas abiertas/ambiguas** → OpenAI GPT (flujo original)

## 🏗️ Arquitectura

```
Usuario → Telegram → Webhook → Router → Decisión:
                                           ├─→ [STRUCTURED] → JSON local → Respuesta
                                           └─→ [GPT] → OpenAI + Embeddings → Respuesta
```

## 📂 Nuevos Archivos

### 1. `/data/*.json` - Datos Estructurados
Archivos JSON con información estática:
- `materias.json` - Materias, códigos, créditos, semestre
- `profesores.json` - Profesores, contacto, horarios de atención
- `horarios.json` - Horarios de clases por materia
- `becas.json` - Becas disponibles, requisitos, cobertura
- `coordinadores.json` - Coordinadores, cargos, contacto

### 2. `/src/router.js` - Router de Intención
**Función:** `detectStructuredIntent(question)`

Detecta mediante **expresiones regulares** si la pregunta corresponde a:
- Materias
- Profesores
- Horarios
- Becas
- Coordinadores

**Retorna:**
- `{ type: "materias", keywords: [...] }` si detecta intención
- `null` si no detecta intención estructurada

### 3. `/src/structuredService.js` - Servicio Estructurado
**Función:** `handleStructuredQuery(question, intent)`

Consulta los archivos JSON según el tipo de intención y retorna respuesta formateada.

**Retorna:**
- `string` con respuesta formateada si encuentra resultado
- `null` si no encuentra resultado (fallback a GPT)

## 🔄 Flujo de Mensajes

### Webhook en `/src/server.js` (líneas 273-320)

```javascript
1. Router detecta intención:
   const intent = detectStructuredIntent(text);

2. Si hay intención, intenta responder con datos locales:
   if (intent) {
     reply = handleStructuredQuery(text, intent);
   }

3. Si no hay respuesta, usa flujo original con OpenAI:
   if (!reply) {
     reply = await composeResponse(payload);
   }

4. Envía respuesta a Telegram
```

## 📊 Logging

El sistema registra en consola qué ruta fue utilizada:

```
[ROUTER] Intent detectado: materias
[✓ STRUCTURED] Respondiendo desde datos locales (materias)
[STRUCTURED] Enviando respuesta
```

O en caso de fallback:

```
[ROUTER] Intent detectado: profesores
[→ FALLBACK] No se encontró respuesta estructurada, pasando a GPT
[GPT] Procesando con OpenAI
[GPT] Enviando respuesta
```

## ✅ Ventajas

1. **Respuestas Instantáneas:** Datos estructurados no requieren llamadas a OpenAI
2. **Ahorro de Tokens:** Consultas frecuentes no consumen API de OpenAI
3. **Escalable:** Fácil agregar más categorías al router
4. **Fallback Inteligente:** Si no encuentra respuesta, usa GPT automáticamente
5. **Compatibilidad:** No afecta funcionalidades existentes (embeddings, documentos, etc.)

## 🚀 Ejemplo de Uso

### Consulta Estructurada
```
Usuario: "¿Qué profesores hay?"
Ruta: STRUCTURED
Respuesta: Lista de profesores desde profesores.json
```

### Consulta Abierta
```
Usuario: "¿Cuál es la mejor manera de estudiar para cálculo?"
Ruta: GPT
Respuesta: OpenAI con contexto y documentos
```

### Fallback
```
Usuario: "¿Hay profesores que enseñen robótica?"
Ruta: STRUCTURED → no encuentra → GPT
Respuesta: OpenAI busca en documentos indexados
```

## 🔧 Escalabilidad

### Agregar Nueva Categoría

1. **Crear archivo JSON en `/data/`:**
   ```json
   // data/eventos.json
   [{ "nombre": "...", "fecha": "..." }]
   ```

2. **Agregar patrones en `router.js`:**
   ```javascript
   const eventosPatterns = [
     /\b(evento|eventos|actividad)\b/i,
   ];
   ```

3. **Agregar handler en `structuredService.js`:**
   ```javascript
   function handleEventosQuery(question) {
     const eventos = loadDataFile("eventos.json");
     // lógica de búsqueda
   }
   ```

### Mejorar Clasificación

El router actualmente usa **regex simple**. Para mejorar:

1. **Agregar más patrones** a los arrays en `router.js`
2. **Implementar clasificador ML** (futuro):
   ```javascript
   // En router.js
   import { classifyIntent } from "./ml/classifier.js";
   
   export function detectStructuredIntent(question) {
     return classifyIntent(question); // ML-based
   }
   ```

## 🐳 Docker

La arquitectura es compatible con Docker. Los archivos JSON son estáticos y se incluyen en el build.

## ⚠️ Mantenimiento

- **Actualizar datos:** Editar archivos JSON en `/data/`
- **Cache:** El servicio estructurado cachea los JSON en memoria
- **Limpiar cache:** Reiniciar servidor o implementar endpoint de recarga

## 📝 Notas

- ✅ No se eliminó código existente
- ✅ `embeddings.js` y `openai.js` permanecen intactos
- ✅ El flujo GPT sigue funcionando exactamente igual
- ✅ Solo se agregó una capa de decisión antes de GPT
- ✅ Cambios mínimos en `server.js` (solo webhook)
