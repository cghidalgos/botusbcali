import FeedbackPanel from "@/components/FeedbackPanel";

const FeedbackPage = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Feedback y mejora de respuestas</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Revisa las respuestas marcadas con 👎, genera una solución con IA y guárdala como respuesta
        confiable. El bot la usará automáticamente para preguntas similares.
      </p>
    </div>
    <FeedbackPanel />
  </div>
);

export default FeedbackPage;
