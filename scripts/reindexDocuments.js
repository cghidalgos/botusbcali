import { listDocuments, documentsReady } from '../src/config/documentStore.js';
import { storeSearchIndex } from '../src/config/searchIndexStore.js';
import { createIntelligentChunks, createChunkedIndex } from '../src/chunkedSearchEngine.js';

// Change working directory to /app before running
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { chdir } from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const appRoot = resolve(__dirname, '..');
chdir(appRoot);
console.log(`[REINDEX] Working directory: ${process.cwd()}\n`);

async function reindexAllDocuments() {
  // Wait for documents to load
  await documentsReady;
  
  console.log('[REINDEX] Iniciando reprocesamiento de documentos...\n');
  
  const docs = listDocuments();
  console.log(`[REINDEX] Documentos encontrados: ${docs.length}\n`);

  let indexed = 0;
  for (const doc of docs) {
    if (doc.status === 'ready' && doc.extractedText) {
      console.log(`[REINDEX] Procesando: ${doc.originalName}`);
      
      try {
        // Crear chunks e índice BM25
        const chunks = createIntelligentChunks(doc.extractedText, doc.originalName);
        const searchIndex = createChunkedIndex(chunks, doc.id, doc.originalName);
        
        // Guardar índice
        await storeSearchIndex(doc.id, doc.originalName, searchIndex);
        console.log(`[REINDEX] ✓ Índice guardado: ${searchIndex.totalChunks} chunks\n`);
        indexed++;
      } catch (error) {
        console.error(`[REINDEX] ✗ Error procesando ${doc.originalName}:`, error.message);
      }
    } else {
      console.log(`[REINDEX] ⊘ Saltando ${doc.originalName} (status: ${doc.status}, texto: ${doc.extractedText ? 'sí' : 'no'})\n`);
    }
  }

  console.log(`\n[REINDEX] ✓ Reprocesamiento completado: ${indexed}/${docs.length} documentos indexados`);
}

reindexAllDocuments().catch(console.error);
