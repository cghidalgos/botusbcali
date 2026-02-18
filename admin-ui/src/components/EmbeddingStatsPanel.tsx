import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { getEmbeddingCacheStats, cleanOldEmbeddingCache } from "@/lib/api";
import { RefreshCw, Trash2, TrendingUp, DollarSign, Database, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EmbeddingCacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: string;
  estimatedSavings: string;
  topQueries: Array<{
    text: string;
    hitCount: number;
  }>;
}

export default function EmbeddingStatsPanel() {
  const [stats, setStats] = useState<EmbeddingCacheStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const { toast } = useToast();

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await getEmbeddingCacheStats();
      setStats(data);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudieron cargar las estadísticas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClean = async () => {
    try {
      setCleaning(true);
      const result = await cleanOldEmbeddingCache(90);
      toast({
        title: "Limpieza completada",
        description: `${result.removed} entradas antiguas eliminadas. ${result.remaining} entradas activas.`,
      });
      loadStats();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo limpiar el cache",
        variant: "destructive",
      });
    } finally {
      setCleaning(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No hay estadísticas disponibles
      </div>
    );
  }

  const hitRateNum = parseFloat(stats.hitRate);
  const hitRateColor = hitRateNum >= 30 ? "text-green-600" : hitRateNum >= 15 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Embedding Cache
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Optimización de llamadas API mediante cache inteligente
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadStats}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClean}
            disabled={cleaning}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Limpiar antiguos
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Entradas en Cache
              </CardTitle>
              <Database className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.totalEntries.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Embeddings cacheados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Hit Rate
              </CardTitle>
              <Target className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${hitRateColor}`}>
              {stats.hitRate}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalHits} hits / {stats.totalMisses} misses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ahorro Estimado
              </CardTitle>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.estimatedSavings}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              USD ahorrados en API
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Eficiencia
              </CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {hitRateNum >= 30 ? "Alta" : hitRateNum >= 15 ? "Media" : "Baja"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {hitRateNum >= 30 ? "Excelente rendimiento" : "Se puede mejorar"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Queries */}
      <Card>
        <CardHeader>
          <CardTitle>Preguntas Más Frecuentes</CardTitle>
          <CardDescription>
            Las preguntas que más veces han reutilizado embeddings cacheados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.topQueries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay consultas registradas aún
            </div>
          ) : (
            <div className="space-y-3">
              {stats.topQueries.map((query, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 pr-4">
                    <p className="text-sm text-foreground line-clamp-2">
                      {query.text}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {query.hitCount} {query.hitCount === 1 ? 'uso' : 'usos'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-blue-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            ¿Cómo funciona?
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 space-y-2">
          <p>
            El <strong>Embedding Cache</strong> evita recalcular embeddings para preguntas similares:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Cada pregunta genera un vector embedding (1536 dimensiones)</li>
            <li>Si una pregunta es 95%+ similar a una anterior, reutiliza su embedding</li>
            <li>Ahorra ~$0.00002 USD por cada hit (~30-40% de reducción en llamadas API)</li>
            <li>Reduce latencia al no esperar respuesta de OpenAI</li>
          </ul>
          <p className="mt-3 pt-3 border-t border-blue-200">
            <strong>Recomendación:</strong> Un hit rate ≥30% indica buena eficiencia. Si es menor,
            considera ajustar el umbral de similitud o las entradas están muy diversificadas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
