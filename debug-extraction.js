#!/usr/bin/env node

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:9014';

async function diagnoseExtraction() {
  try {
    console.log('🔍 Diagnosticando extracción de documentos...\n');
    
    // 1. Obtener lista de documentos
    console.log('📋 Obteniendo lista de documentos...');
    const docsRes = await fetch(`${API_BASE}/api/documents`);
    const documents = await docsRes.json();
    
    console.log(`✓ Se encontraron ${documents.length} documentos\n`);
    
    if (documents.length === 0) {
      console.log('⚠️  No hay documentos cargados. Carga un PDF primero.\n');
      return;
    }
    
    // 2. Analizar cada documento
    documents.forEach((doc, i) => {
      console.log(`📄 Documento ${i+1}: ${doc.name}`);
      console.log(`   Status: ${doc.status}`);
      console.log(`   Tipo: ${doc.type}`);
      console.log(`   Resumen: ${doc.summary || '(vacío)'}`);
      
      if (doc.extractedText) {
        const textLen = doc.extractedText.length;
        const preview = doc.extractedText.substring(0, 100).replace(/\n/g, ' ');
        console.log(`   ✅ Texto extraído: ${textLen} caracteres`);
        console.log(`      Preview: "${preview}..."\n`);
      } else {
        console.log(`   ❌ NO hay texto extraído`);
        console.log(`   Usado OCR: ${doc.usedOcr || 'no'}`);
        console.log(`   Error: ${doc.error || 'ninguno'}\n`);
      }
      
      if (doc.chunks && doc.chunks.length > 0) {
        console.log(`   ✅ Chunks: ${doc.chunks.length} chunks creados`);
        console.log(`      Tipos: ${doc.chunks.map(c => c.type).join(', ')}\n`);
      } else {
        console.log(`   ❌ NO hay chunks (el documento no fue dividido)\n`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

diagnoseExtraction();
