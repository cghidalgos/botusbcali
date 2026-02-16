import LearningPanel from "@/components/LearningPanel";

const LearningPage = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Aprendizaje del bot</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Revisa las preguntas aprendidas, edita patrones y elimina informacion incorrecta.
      </p>
    </div>
    <LearningPanel />
  </div>
);

export default LearningPage;
