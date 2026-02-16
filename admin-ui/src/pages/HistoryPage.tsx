import HistoryPanel from "@/components/HistoryPanel";

const HistoryPage = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Historial de Q&A</h1>
      <p className="text-sm text-muted-foreground mt-1">Revisa las interacciones del bot con los usuarios.</p>
    </div>
    <HistoryPanel />
  </div>
);

export default HistoryPage;
