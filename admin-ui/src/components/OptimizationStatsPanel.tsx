import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Zap, TrendingUp, DollarSign, Clock, CheckCircle2, Database, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { getVectorIndexStats, rebuildVectorIndex } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function OptimizationStatsPanel() {
  const [vectorStats, setVectorStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const { toast } = useToast();

  const loadVectorStats = async () => {
    try {
      setLoading(true);
      const stats = await getVectorIndexStats();
      setVectorStats(stats);
    } catch (error) {
      console.error("Error loading vector index stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRebuild = async () => {
    try {
      setRebuilding(true);
      await rebuildVectorIndex();
      toast({
        title: "Índice reconstruido",
        description: "El índice de vectores se reconstruyó exitosamente",
      });
      loadVectorStats();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo reconstruir el índice",
        variant: "destructive",
      });
    } finally {
      setRebuilding(false);
    }
  };

  useEffect(() => {
    loadVectorStats();
  }, []);

  const optimizations = [
    {
      name: "Embedding Cache",
      status: "active",
      description: "Reutiliza embeddings para preguntas similares (≥95% similitud)",
      impact: "~30-40% menos llamadas API",
      savings: "$0.00002 por hit",
      icon: Zap,
      color: "text-blue-600",
    },
    {
      name: "FAQ Cache",
      status: "active",
      description: "Respuestas instantáneas para preguntas frecuentes (≥85% similitud)",
      impact: "~50-70% menos llamadas GPT",
      savings: "~$0.0002 por hit",
      icon: TrendingUp,
      color: "text-green-600",
    },
    {
      name: "Batch Processing",
      status: "active",
      description: "Procesa múltiples embeddings juntos (20 textos/request)",
      impact: "50% más rápido al procesar documentos",
      savings: "Reduce latencia API",
      icon: Clock,
      color: "text-purple-600",
    },
    {
      name: "Document Chunking",
      status: "active",
      description: "Divide documentos inteligentemente (1400 chars, overlap 200)",
      impact: "Mejor precisión en respuestas",
      savings: "Balancea costo/calidad",
      icon: CheckCircle2,
      color: "text-orange-600",
    },
    {
      name: "Vector Index (HNSW)",
      status: vectorStats?.useIndex ? "active" : "inactive",
      description: "Búsqueda optimizada con Hierarchical Navigable Small World",
      impact: vectorStats?.useIndex ? "100-1000x más rápido" : "Deshabilitado",
      savings: "Reduce latencia en búsquedas",
      icon: Database,
      color: vectorStats?.useIndex ? "text-indigo-600" : "text-gray-400",
    },
  ];

  const metrics = [
    {
      label: "Reducción de Costos",
      value: "~60-70%",
      description: "Ahorro estimado vs sin optimizaciones",
      color: "text-green-600",
    },
    {
      label: "Mejora de Velocidad",
      value: "~40-50%",
      description: "Respuestas más rápidas en promedio",
      color: "text-blue-600",
    },
    {
      label: "Hit Rate Target",
      value: "≥30%",
      description: "Objetivo para cache de embeddings",
      color: "text-purple-600",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metrics.map((metric, index) => (
          <Card key={index}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${metric.color}`}>
                {metric.value}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {metric.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Optimizations List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Optimizaciones Activas</CardTitle>
              <CardDescription>
                Sistema configurado para máxima eficiencia y mínimo costo
              </CardDescription>
            </div>
            {vectorStats?.useIndex && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRebuild}
                disabled={rebuilding}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${rebuilding ? 'animate-spin' : ''}`} />
                Reconstruir Índice
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {optimizations.map((opt, index) => {
              const Icon = opt.icon;
              return (
                <div
                  key={index}
                  className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className={`p-2 rounded-lg bg-background ${opt.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">{opt.name}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {opt.status === "active" ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-2">
                      {opt.description}
                    </p>
                    
                    <div className="flex flex-wrap gap-3 text-xs">
                      <div className="flex items-center gap-1 text-blue-600">
                        <TrendingUp className="w-3 h-3" />
                        <span className="font-medium">{opt.impact}</span>
                      </div>
                      <div className="flex items-center gap-1 text-green-600">
                        <DollarSign className="w-3 h-3" />
                        <span className="font-medium">{opt.savings}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Vector Index Stats */}
      {vectorStats?.useIndex && (
        <Card className="border-indigo-200 bg-indigo-50/50">
          <CardHeader>
            <CardTitle className="text-indigo-900 flex items-center gap-2">
              <Database className="w-5 h-5" />
              Estadísticas del Índice HNSW
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-indigo-800">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="font-semibold">Chunks Indexados</div>
                <div className="text-2xl font-bold">{vectorStats.totalChunks.toLocaleString()}</div>
              </div>
              <div>
                <div className="font-semibold">Documentos Únicos</div>
                <div className="text-2xl font-bold">{vectorStats.uniqueDocuments}</div>
              </div>
              <div>
                <div className="font-semibold">Dimensiones</div>
                <div className="text-2xl font-bold">{vectorStats.dimension}</div>
              </div>
              <div>
                <div className="font-semibold">Tamaño del Índice</div>
                <div className="text-2xl font-bold">{vectorStats.indexSize}</div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-indigo-200 space-y-2">
              <div><strong>Métrica:</strong> {vectorStats.metric}</div>
              <div><strong>Conexiones promedio:</strong> {vectorStats.avgConnectionsPerNode} (target: {vectorStats.M})</div>
              <div><strong>Estado:</strong> {vectorStats.indexBuilt ? "✓ Construido" : "En construcción"}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Tips */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-blue-900 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Configuración Actual
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 space-y-3">
          <div>
            <strong>Embedding Cache:</strong>
            <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
              <li>Umbral de similitud: 95% (editable en código)</li>
              <li>Límite de entradas: 5000 (mantiene top 4000 más populares)</li>
              <li>Limpieza automática: entradas no usadas en 90 días</li>
            </ul>
          </div>
          
          <div>
            <strong>FAQ Cache:</strong>
            <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
              <li>Umbral de similitud: 85% (más permisivo para respuestas completas)</li>
              <li>Auto-categorización en 11 categorías temáticas</li>
              <li>Contador de hits para análisis de popularidad</li>
            </ul>
          </div>
          
          <div>
            <strong>Batch Processing:</strong>
            <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
              <li>Tamaño de batch: 20 textos por request (configurable en .env)</li>
              <li>Fallback automático a procesamiento individual si falla batch</li>
              <li>Compatible con cache (solo procesa textos no cacheados)</li>
            </ul>
          </div>
          
          <div className="pt-3 border-t border-blue-200">
            <strong>Variables de entorno (.env):</strong>
            <ul className="list-disc list-inside ml-2 mt-1 space-y-1 font-mono text-xs">
              <li>EMBEDDING_BATCH_SIZE=20</li>
              <li>OPENAI_EMBEDDING_MODEL=text-embedding-3-small</li>
              <li>EMBEDDING_CHUNK_SIZE=1400</li>
              <li>EMBEDDING_CHUNK_OVERLAP=200</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
