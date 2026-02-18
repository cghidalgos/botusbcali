// Vector Index - Índice optimizado para búsqueda de vectores similares
// Implementa una versión simplificada de HNSW (Hierarchical Navigable Small World)
// para búsquedas rápidas en grandes colecciones de embeddings

/**
 * Calcula distancia euclidiana entre dos vectores
 */
function euclideanDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Calcula similitud coseno entre dos vectores
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    mag1 += a[i] * a[i];
    mag2 += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * VectorIndex - Índice optimizado para búsqueda de similitud
 */
export class VectorIndex {
  constructor(options = {}) {
    this.vectors = []; // Lista de vectores con metadata
    this.dimension = null;
    this.metric = options.metric || 'cosine'; // 'cosine' o 'euclidean'
    this.efConstruction = options.efConstruction || 200; // Parámetro HNSW
    this.M = options.M || 16; // Número de conexiones por nodo
    this.graph = []; // Grafo HNSW simplificado
    this.useIndex = options.useIndex !== false; // Si false, usa búsqueda lineal
    this.indexBuilt = false;
  }

  /**
   * Agrega un vector al índice
   */
  add(vector, metadata = {}) {
    if (!vector || !Array.isArray(vector)) {
      throw new Error('Vector debe ser un array');
    }

    if (this.dimension === null) {
      this.dimension = vector.length;
    } else if (vector.length !== this.dimension) {
      throw new Error(`Vector dimension mismatch: expected ${this.dimension}, got ${vector.length}`);
    }

    const id = this.vectors.length;
    this.vectors.push({ id, vector, metadata });
    
    // Si estamos usando el índice, agregar al grafo
    if (this.useIndex) {
      this._addToGraph(id);
    }

    return id;
  }

  /**
   * Agrega un vector al grafo HNSW
   */
  _addToGraph(newId) {
    const newVector = this.vectors[newId].vector;

    // Si es el primer nodo, no hay conexiones
    if (this.graph.length === 0) {
      this.graph.push([]);
      return;
    }

    // Encontrar los M vecinos más cercanos
    const neighbors = this._findKNearest(newVector, Math.min(this.M * 2, this.vectors.length - 1));
    
    const connections = [];
    for (let i = 0; i < Math.min(this.M, neighbors.length); i++) {
      const neighborId = neighbors[i].id;
      connections.push(neighborId);
      
      // Agregar conexión bidireccional
      if (!this.graph[neighborId]) {
        this.graph[neighborId] = [];
      }
      if (!this.graph[neighborId].includes(newId)) {
        this.graph[neighborId].push(newId);
      }
      
      // Limitar conexiones del vecino si excede M
      if (this.graph[neighborId].length > this.M) {
        this._pruneConnections(neighborId);
      }
    }
    
    this.graph.push(connections);
  }

  /**
   * Poda conexiones de un nodo para mantener solo las M mejores
   */
  _pruneConnections(nodeId) {
    const nodeVector = this.vectors[nodeId].vector;
    const connections = this.graph[nodeId];
    
    // Calcular distancias a todos los vecinos
    const scored = connections.map(connId => ({
      id: connId,
      distance: this._distance(nodeVector, this.vectors[connId].vector),
    }));
    
    // Ordenar por distancia y mantener solo los M mejores
    scored.sort((a, b) => a.distance - b.distance);
    this.graph[nodeId] = scored.slice(0, this.M).map(item => item.id);
  }

  /**
   * Calcula distancia según la métrica configurada
   */
  _distance(a, b) {
    if (this.metric === 'euclidean') {
      return euclideanDistance(a, b);
    }
    // Para cosine, convertir similitud a distancia
    return 1 - cosineSimilarity(a, b);
  }

  /**
   * Búsqueda de los K vecinos más cercanos (lineal)
   */
  _findKNearest(query, k) {
    const results = [];
    
    for (let i = 0; i < this.vectors.length; i++) {
      const distance = this._distance(query, this.vectors[i].vector);
      results.push({ id: i, distance });
    }
    
    results.sort((a, b) => a.distance - b.distance);
    return results.slice(0, k);
  }

  /**
   * Búsqueda usando el grafo HNSW
   */
  _searchGraph(query, k, ef) {
    if (this.graph.length === 0) {
      return [];
    }

    const visited = new Set();
    const candidates = [];
    const results = [];

    // Empezar desde un punto aleatorio
    const entryPoint = Math.floor(Math.random() * this.vectors.length);
    const entryDistance = this._distance(query, this.vectors[entryPoint].vector);
    
    candidates.push({ id: entryPoint, distance: entryDistance });
    visited.add(entryPoint);
    results.push({ id: entryPoint, distance: entryDistance });

    // Búsqueda greedy
    while (candidates.length > 0) {
      // Ordenar candidatos por distancia
      candidates.sort((a, b) => a.distance - b.distance);
      
      const current = candidates.shift();
      
      // Si el candidato actual está más lejos que el peor resultado, terminar
      if (results.length >= ef && current.distance > results[results.length - 1].distance) {
        break;
      }

      // Explorar vecinos
      const connections = this.graph[current.id] || [];
      for (const neighborId of connections) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const distance = this._distance(query, this.vectors[neighborId].vector);
        
        candidates.push({ id: neighborId, distance });
        results.push({ id: neighborId, distance });
      }

      // Mantener solo los mejores ef resultados
      if (results.length > ef) {
        results.sort((a, b) => a.distance - b.distance);
        results.splice(ef);
      }
    }

    // Ordenar y retornar los k mejores
    results.sort((a, b) => a.distance - b.distance);
    return results.slice(0, k);
  }

  /**
   * Busca los K vectores más similares al query
   */
  search(queryVector, k = 10, options = {}) {
    if (!queryVector || !Array.isArray(queryVector)) {
      throw new Error('Query vector debe ser un array');
    }

    if (queryVector.length !== this.dimension) {
      throw new Error(`Query vector dimension mismatch: expected ${this.dimension}, got ${queryVector.length}`);
    }

    if (this.vectors.length === 0) {
      return [];
    }

    const actualK = Math.min(k, this.vectors.length);
    const ef = options.ef || Math.max(actualK * 2, 50); // Factor de exploración

    // Si no usamos índice o hay pocos vectores, búsqueda lineal
    if (!this.useIndex || this.vectors.length < 100) {
      const results = this._findKNearest(queryVector, actualK);
      return results.map(item => ({
        id: item.id,
        score: this.metric === 'cosine' ? 1 - item.distance : item.distance,
        metadata: this.vectors[item.id].metadata,
        vector: this.vectors[item.id].vector,
      }));
    }

    // Búsqueda usando el grafo
    const results = this._searchGraph(queryVector, actualK, ef);
    return results.map(item => ({
      id: item.id,
      score: this.metric === 'cosine' ? 1 - item.distance : item.distance,
      metadata: this.vectors[item.id].metadata,
      vector: this.vectors[item.id].vector,
    }));
  }

  /**
   * Reconstruye el índice (útil después de agregar muchos vectores)
   */
  rebuild() {
    if (!this.useIndex) {
      return;
    }

    console.log(`Reconstruyendo índice con ${this.vectors.length} vectores...`);
    const startTime = Date.now();

    this.graph = [];
    for (let i = 0; i < this.vectors.length; i++) {
      this._addToGraph(i);
      
      // Log de progreso cada 1000 vectores
      if ((i + 1) % 1000 === 0) {
        console.log(`  Agregados ${i + 1}/${this.vectors.length} vectores al índice`);
      }
    }

    this.indexBuilt = true;
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✓ Índice reconstruido en ${duration}s`);
  }

  /**
   * Obtiene estadísticas del índice
   */
  getStats() {
    const avgConnections = this.graph.length > 0
      ? this.graph.reduce((sum, conns) => sum + (conns?.length || 0), 0) / this.graph.length
      : 0;

    return {
      vectorCount: this.vectors.length,
      dimension: this.dimension,
      metric: this.metric,
      useIndex: this.useIndex,
      indexBuilt: this.indexBuilt,
      avgConnectionsPerNode: avgConnections.toFixed(2),
      M: this.M,
      efConstruction: this.efConstruction,
    };
  }

  /**
   * Limpia el índice
   */
  clear() {
    this.vectors = [];
    this.graph = [];
    this.dimension = null;
    this.indexBuilt = false;
  }

  /**
   * Serializa el índice a JSON
   */
  toJSON() {
    return {
      vectors: this.vectors,
      dimension: this.dimension,
      metric: this.metric,
      M: this.M,
      efConstruction: this.efConstruction,
      graph: this.graph,
      useIndex: this.useIndex,
    };
  }

  /**
   * Carga el índice desde JSON
   */
  static fromJSON(data) {
    const index = new VectorIndex({
      metric: data.metric,
      M: data.M,
      efConstruction: data.efConstruction,
      useIndex: data.useIndex,
    });

    index.vectors = data.vectors || [];
    index.dimension = data.dimension;
    index.graph = data.graph || [];
    index.indexBuilt = index.graph.length > 0;

    return index;
  }
}

export default VectorIndex;
