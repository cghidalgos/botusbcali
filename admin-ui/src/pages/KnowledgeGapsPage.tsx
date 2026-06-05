import KnowledgeGapsPanel from "@/components/KnowledgeGapsPanel";

const KnowledgeGapsPage = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Vacíos de conocimiento</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Lo que tus usuarios preguntan y el bot no sabe responder. Úsalo para saber qué documentos
        subir y mejorar la cobertura.
      </p>
    </div>
    <KnowledgeGapsPanel />
  </div>
);

export default KnowledgeGapsPage;
