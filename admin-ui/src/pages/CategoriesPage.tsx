import CategoriesPanel from "@/components/CategoriesPanel";

const CategoriesPage = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Gestión de categorías</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Revisa las categorías detectadas automáticamente desde las preguntas de usuarios,
        aprueba o rechaza según sea necesario para evitar spam.
      </p>
    </div>
    <CategoriesPanel />
  </div>
);

export default CategoriesPage;
