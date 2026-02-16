import ContextPanel from "@/components/ContextPanel";

const ContextPage = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Contexto de conversación</h1>
      <p className="text-sm text-muted-foreground mt-1">Define cómo responde el bot a los usuarios.</p>
    </div>
    <ContextPanel />
  </div>
);

export default ContextPage;
