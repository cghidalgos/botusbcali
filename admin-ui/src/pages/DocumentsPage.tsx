import DocumentsPanel from "@/components/DocumentsPanel";

const DocumentsPage = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Documentos de referencia</h1>
      <p className="text-sm text-muted-foreground mt-1">Gestiona la base de conocimiento del bot.</p>
    </div>
    <DocumentsPanel />
  </div>
);

export default DocumentsPage;
