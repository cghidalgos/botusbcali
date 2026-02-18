import ActivityPanel from "@/components/ActivityPanel";
import EmbeddingStatsPanel from "@/components/EmbeddingStatsPanel";
import OptimizationStatsPanel from "@/components/OptimizationStatsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ActivityPage = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Actividad del sistema</h1>
      <p className="text-sm text-muted-foreground mt-1">Monitorea los eventos y optimizaciones en tiempo real.</p>
    </div>
    
    <Tabs defaultValue="activity" className="w-full">
      <TabsList className="grid w-full max-w-2xl grid-cols-3">
        <TabsTrigger value="activity">Eventos</TabsTrigger>
        <TabsTrigger value="embeddings">Cache Embeddings</TabsTrigger>
        <TabsTrigger value="optimizations">Optimizaciones</TabsTrigger>
      </TabsList>
      
      <TabsContent value="activity" className="mt-6">
        <ActivityPanel />
      </TabsContent>
      
      <TabsContent value="embeddings" className="mt-6">
        <EmbeddingStatsPanel />
      </TabsContent>
      
      <TabsContent value="optimizations" className="mt-6">
        <OptimizationStatsPanel />
      </TabsContent>
    </Tabs>
  </div>
);

export default ActivityPage;
