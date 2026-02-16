import ActivityPanel from "@/components/ActivityPanel";

const ActivityPage = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Actividad del sistema</h1>
      <p className="text-sm text-muted-foreground mt-1">Monitorea los eventos en tiempo real.</p>
    </div>
    <ActivityPanel />
  </div>
);

export default ActivityPage;
