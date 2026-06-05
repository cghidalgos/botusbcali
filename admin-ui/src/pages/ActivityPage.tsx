import ActivityPanel from "@/components/ActivityPanel";
import EmbeddingStatsPanel from "@/components/EmbeddingStatsPanel";
import OptimizationStatsPanel from "@/components/OptimizationStatsPanel";
import BotMetricsPanel from "@/components/BotMetricsPanel";
import ErrorLogPanel from "@/components/ErrorLogPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ActivityPage = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Actividad del sistema</h1>
      <p className="text-sm text-muted-foreground mt-1">Monitorea los eventos y optimizaciones en tiempo real.</p>
    </div>
    
    <Tabs defaultValue="activity" className="w-full">
      <TabsList className="grid w-full max-w-4xl grid-cols-2 md:grid-cols-5">
        <TabsTrigger value="activity">Eventos</TabsTrigger>
        <TabsTrigger value="metrics">Métricas</TabsTrigger>
        <TabsTrigger value="embeddings">Cache Embeddings</TabsTrigger>
        <TabsTrigger value="optimizations">Optimizaciones</TabsTrigger>
        <TabsTrigger value="errors">Errores</TabsTrigger>
      </TabsList>
      
      <TabsContent value="activity" className="mt-6">
        <ActivityPanel />
      </TabsContent>

      <TabsContent value="metrics" className="mt-6">
        <BotMetricsPanel />
      </TabsContent>
      
      <TabsContent value="embeddings" className="mt-6">
        <EmbeddingStatsPanel />
      </TabsContent>
      
      <TabsContent value="optimizations" className="mt-6">
        <OptimizationStatsPanel />
      </TabsContent>

      <TabsContent value="errors" className="mt-6">
        <ErrorLogPanel />
      </TabsContent>
    </Tabs>
  </div>
);

export default ActivityPage;
