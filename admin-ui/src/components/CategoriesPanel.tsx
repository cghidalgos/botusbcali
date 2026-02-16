import { useEffect, useState } from "react";
import { Tags, CheckCircle, Trash2, RefreshCcw, AlertCircle, Check, X, Edit2 } from "lucide-react";
import {
  getSuggestedCategories,
  getPendingSuggestedCategories,
  approveSuggestedCategory,
  rejectSuggestedCategory,
  deleteSuggestedCategory,
  updateSuggestedCategory,
  deleteCategory,
  getCategories,
  formatDate,
  type SuggestedCategory,
  type CategoryInfo,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const CategoriesPanel = () => {
  const [activeCategories, setActiveCategories] = useState<CategoryInfo[]>([]);
  const [suggestedCategories, setSuggestedCategories] = useState<SuggestedCategory[]>([]);
  const [pendingCategories, setPendingCategories] = useState<SuggestedCategory[]>([]);
  const [activeTab, setActiveTab] = useState<"active" | "pending" | "all">("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SuggestedCategory | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingKeywords, setEditingKeywords] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const activeData = await getCategories();
      setActiveCategories(activeData);
      const suggestedData = await getSuggestedCategories();
      setSuggestedCategories(suggestedData);
      const pendingData = await getPendingSuggestedCategories();
      setPendingCategories(pendingData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las categorías.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleSelectCategory = (category: SuggestedCategory) => {
    setSelectedCategory(category);
    setEditingName(category.displayName || category.name);
    setEditingKeywords(category.keywords?.join(", ") || "");
  };

  const handleApprove = async (id: string) => {
    try {
      await approveSuggestedCategory(id);
      toast.success("Categoría aprobada y agregada al sistema");
      loadCategories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo aprobar la categoría.");
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm("¿Seguro que deseas rechazar esta categoría?")) return;
    try {
      await rejectSuggestedCategory(id);
      toast.success("Categoría rechazada");
      loadCategories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo rechazar la categoría.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar esta categoría?")) return;
    try {
      await deleteSuggestedCategory(id);
      toast.success("Categoría eliminada");
      setSelectedCategory(null);
      loadCategories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar la categoría.");
    }
  };

  const handleDeleteActiveCategory = async (categoryName: string) => {
    if (!confirm(`¿Seguro que deseas eliminar la categoría "${categoryName}" del sistema?`)) return;
    try {
      await deleteCategory(categoryName);
      toast.success("Categoría eliminada del sistema");
      loadCategories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar la categoría.");
    }
  };

  const handleSaveChanges = async () => {
    if (!selectedCategory) return;
    try {
      setIsSaving(true);
      const keywords = editingKeywords.split(",").map((k) => k.trim()).filter((k) => k);
      await updateSuggestedCategory(selectedCategory.id, { displayName: editingName, keywords });
      toast.success("Cambios guardados");
      loadCategories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron guardar los cambios.");
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-1 rounded">PENDIENTE</span>;
      case "approved":
        return <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded">APROBADA</span>;
      case "rejected":
        return <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded">RECHAZADA</span>;
      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 panel">
        <div className="flex items-center justify-between mb-4">
          <h2 className="panel-title mb-0"><Tags className="w-5 h-5 text-primary" />Categorías</h2>
          <button type="button" className="btn-secondary" onClick={loadCategories}>
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2 mb-4 border-b border-border overflow-x-auto">
          <button
            type="button"
            onClick={() => { setActiveTab("active"); setSelectedCategory(null); }}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "active" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Activas ({activeCategories.length})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("pending"); setSelectedCategory(null); }}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "pending" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Pendientes ({pendingCategories.length})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("all"); setSelectedCategory(null); }}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "all" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Sugeridas ({suggestedCategories.length})
          </button>
        </div>

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
        {loading && <p className="text-sm text-muted-foreground">Cargando categorías...</p>}

        {activeTab === "active" && !loading && (
          <>
            {activeCategories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No hay categorías activas</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {activeCategories.map((category) => (
                  <div
                    key={category.name}
                    className="w-full text-left p-3 rounded-lg border border-border bg-green-50 hover:bg-green-100 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{category.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {category.keywordsCount} palabras clave • {category.patternsCount} patrones
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-green-700 bg-green-200 px-2 py-1 rounded whitespace-nowrap">ACTIVA</span>
                        <button
                          onClick={() => handleDeleteActiveCategory(category.name)}
                          className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-colors"
                          title="Eliminar categoría"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {(activeTab === "pending" || activeTab === "all") && !loading && (
          <>
            {(activeTab === "pending" ? pendingCategories : suggestedCategories).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {activeTab === "pending" ? "No hay categorías pendientes" : "No hay categorías sugeridas"}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(activeTab === "pending" ? pendingCategories : suggestedCategories).map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => handleSelectCategory(category)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedCategory?.id === category.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{category.displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">Pregunta: {category.question.substring(0, 40)}...</p>
                        <p className="text-xs text-muted-foreground mt-1">Usuario: {category.userId} • {category.count || 1} veces</p>
                      </div>
                      {getStatusBadge(category.status)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="lg:col-span-2 space-y-6">
        {selectedCategory ? (
          <>
            <div className="panel">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Detalles de la categoría</h3>
                {getStatusBadge(selectedCategory.status)}
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">Nombre</p>
                    <p className="text-sm font-semibold text-foreground">{selectedCategory.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Nombre Visible</p>
                    <p className="text-sm font-semibold text-foreground">{selectedCategory.displayName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Creada el</p>
                    <p className="text-xs text-foreground">{formatDate(selectedCategory.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Veces sugerida</p>
                    <p className="text-sm font-semibold text-foreground">{selectedCategory.count || 1}</p>
                  </div>
                </div>

                <div className="bg-muted/50 p-3 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Pregunta que generó esta categoría</p>
                  <p className="text-sm text-foreground italic">"{selectedCategory.question}"</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Palabras clave</p>
                  <Input
                    type="text"
                    placeholder="Separadas por comas"
                    value={editingKeywords}
                    onChange={(e) => setEditingKeywords(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Nombre a mostrar</p>
                  <Input
                    type="text"
                    placeholder="Nombre para mostrar en la interfaz"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-border">
                {selectedCategory.status === "pending" && (
                  <>
                    <button type="button" className="btn-sm btn-success" onClick={() => handleApprove(selectedCategory.id)}>
                      <Check className="w-4 h-4 mr-1" />
                      Aprobar
                    </button>
                    <button type="button" className="btn-sm btn-warning" onClick={() => handleReject(selectedCategory.id)}>
                      <X className="w-4 h-4 mr-1" />
                      Rechazar
                    </button>
                  </>
                )}

                <button type="button" className="btn-sm btn-primary" onClick={handleSaveChanges} disabled={isSaving}>
                  <Edit2 className="w-4 h-4 mr-1" />
                  {isSaving ? "Guardando..." : "Guardar cambios"}
                </button>

                <button type="button" className="btn-sm btn-danger" onClick={() => handleDelete(selectedCategory.id)}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Eliminar
                </button>
              </div>
            </div>

            {selectedCategory.status === "approved" && selectedCategory.approvedBy && (
              <div className="panel bg-green-50 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold text-green-900">Aprobada</h4>
                </div>
                <p className="text-sm text-green-800">Aprobada por {selectedCategory.approvedBy} el {formatDate(selectedCategory.approvedAt || "")}</p>
                <p className="text-xs text-green-700 mt-2">Esta categoría ha sido convertida en una categoría activa en el sistema y ahora puede ser utilizada para clasificar preguntas.</p>
              </div>
            )}
          </>
        ) : (
          <div className="panel">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Tags className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                {activeTab === "active" ? "Todas las categorías del sistema están activas" : "Selecciona una categoría para ver sus detalles"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoriesPanel;
