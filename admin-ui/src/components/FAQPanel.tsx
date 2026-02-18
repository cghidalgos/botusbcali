import { useEffect, useState } from "react";
import { MessageSquare, TrendingUp, RefreshCcw, AlertCircle, Eye, EyeOff, Edit2, Trash2, Save, X } from "lucide-react";
import {
  getAllFAQs,
  getFAQStats,
  getTopFAQs,
  getFAQsByCategory,
  updateFAQ,
  deleteFAQ,
  toggleFAQ,
  getFAQCategories,
  formatDate,
  type FAQ,
  type FAQStats,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const FAQPanel = () => {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [stats, setStats] = useState<FAQStats | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedFAQ, setSelectedFAQ] = useState<FAQ | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Edición
  const [isEditing, setIsEditing] = useState(false);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [faqsData, statsData, categoriesData] = await Promise.all([
        getAllFAQs(),
        getFAQStats(),
        getFAQCategories(),
      ]);
      setFaqs(faqsData);
      setStats(statsData);
      setCategories(["all", ...categoriesData]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las FAQs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredFAQs = selectedCategory === "all" 
    ? faqs 
    : faqs.filter(faq => faq.category === selectedCategory);

  const sortedFAQs = [...filteredFAQs].sort((a, b) => b.hitCount - a.hitCount);

  const handleSelectFAQ = (faq: FAQ) => {
    setSelectedFAQ(faq);
    setEditQuestion(faq.question);
    setEditAnswer(faq.answer);
    setEditCategory(faq.category);
    setIsEditing(false);
  };

  const handleToggleEnabled = async (faq: FAQ) => {
    try {
      const updated = await toggleFAQ(faq.id, !faq.enabled);
      setFaqs(prev => prev.map(f => f.id === faq.id ? updated : f));
      if (selectedFAQ?.id === faq.id) {
        setSelectedFAQ(updated);
      }
      toast.success(updated.enabled ? "FAQ habilitada" : "FAQ deshabilitada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado.");
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedFAQ) return;
    try {
      setIsSaving(true);
      const updated = await updateFAQ(selectedFAQ.id, {
        question: editQuestion,
        answer: editAnswer,
        category: editCategory,
      });
      setFaqs(prev => prev.map(f => f.id === updated.id ? updated : f));
      setSelectedFAQ(updated);
      setIsEditing(false);
      toast.success("FAQ actualizada correctamente");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (faq: FAQ) => {
    if (!confirm(`¿Eliminar esta FAQ?\n"${faq.question}"`)) return;
    try {
      await deleteFAQ(faq.id);
      setFaqs(prev => prev.filter(f => f.id !== faq.id));
      if (selectedFAQ?.id === faq.id) {
        setSelectedFAQ(null);
      }
      toast.success("FAQ eliminada");
      loadData(); // Recargar stats
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      horarios: "bg-blue-100 text-blue-800",
      profesores: "bg-purple-100 text-purple-800",
      becas: "bg-green-100 text-green-800",
      programas: "bg-yellow-100 text-yellow-800",
      admisiones: "bg-orange-100 text-orange-800",
      salones: "bg-pink-100 text-pink-800",
      materias: "bg-indigo-100 text-indigo-800",
      tramites: "bg-cyan-100 text-cyan-800",
      eventos: "bg-teal-100 text-teal-800",
      contacto: "bg-red-100 text-red-800",
      general: "bg-gray-100 text-gray-800",
    };
    return colors[category] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="panel bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total FAQs</p>
                <p className="text-3xl font-bold text-blue-900">{stats.total}</p>
              </div>
              <MessageSquare className="w-10 h-10 text-blue-400" />
            </div>
          </div>
          
          <div className="panel bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Habilitadas</p>
                <p className="text-3xl font-bold text-green-900">{stats.enabled}</p>
              </div>
              <Eye className="w-10 h-10 text-green-400" />
            </div>
          </div>
          
          <div className="panel bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Total Uso</p>
                <p className="text-3xl font-bold text-purple-900">{stats.totalHits}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-purple-400" />
            </div>
          </div>
          
          <div className="panel bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Categorías</p>
                <p className="text-3xl font-bold text-orange-900">{Object.keys(stats.categories).length}</p>
              </div>
              <MessageSquare className="w-10 h-10 text-orange-400" />
            </div>
          </div>
        </div>
      )}

      {/* Lista y detalles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de FAQs */}
        <div className="lg:col-span-1 panel">
          <div className="flex items-center justify-between mb-4">
            <h2 className="panel-title mb-0">
              <MessageSquare className="w-5 h-5 text-primary" />
              FAQs Cacheadas
            </h2>
            <button type="button" className="btn-secondary" onClick={loadData}>
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Filtro por categoría */}
          <div className="mb-4">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === "all" ? "Todas las categorías" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
          {loading && <p className="text-sm text-muted-foreground">Cargando FAQs...</p>}

          {!loading && sortedFAQs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {selectedCategory === "all" 
                  ? "No hay FAQs cacheadas aún. Se crearán automáticamente cuando los usuarios hagan preguntas."
                  : `No hay FAQs en la categoría "${selectedCategory}"`
                }
              </p>
            </div>
          )}

          {!loading && sortedFAQs.length > 0 && (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {sortedFAQs.map((faq) => (
                <button
                  key={faq.id}
                  type="button"
                  onClick={() => handleSelectFAQ(faq)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedFAQ?.id === faq.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted"
                  } ${!faq.enabled ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-foreground line-clamp-2">
                      {faq.question}
                    </p>
                    {!faq.enabled && <EyeOff className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${getCategoryColor(faq.category)}`}>
                      {faq.category}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      🎯 {faq.hitCount} uso{faq.hitCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detalles de FAQ */}
        <div className="lg:col-span-2">
          {selectedFAQ ? (
            <div className="panel">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Detalles de FAQ</h3>
                <div className="flex gap-2">
                  {!isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="btn-sm btn-primary"
                      >
                        <Edit2 className="w-4 h-4 mr-1" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleEnabled(selectedFAQ)}
                        className={`btn-sm ${selectedFAQ.enabled ? "btn-warning" : "btn-success"}`}
                      >
                        {selectedFAQ.enabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(selectedFAQ)}
                        className="btn-sm btn-danger"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                        className="btn-sm btn-success"
                      >
                        <Save className="w-4 h-4 mr-1" />
                        {isSaving ? "Guardando..." : "Guardar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(false);
                          setEditQuestion(selectedFAQ.question);
                          setEditAnswer(selectedFAQ.answer);
                          setEditCategory(selectedFAQ.category);
                        }}
                        className="btn-sm btn-secondary"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancelar
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {/* Estadísticas */}
                <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Veces usada</p>
                    <p className="text-lg font-bold text-foreground">{selectedFAQ.hitCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estado</p>
                    <p className={`text-sm font-semibold ${selectedFAQ.enabled ? "text-green-600" : "text-red-600"}`}>
                      {selectedFAQ.enabled ? "Habilitada" : "Deshabilitada"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Último uso</p>
                    <p className="text-xs text-foreground">{formatDate(String(selectedFAQ.lastUsedAt))}</p>
                  </div>
                </div>

                {/* Pregunta */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Pregunta</label>
                  {isEditing ? (
                    <Input
                      value={editQuestion}
                      onChange={(e) => setEditQuestion(e.target.value)}
                      className="text-sm"
                    />
                  ) : (
                    <p className="text-sm text-foreground p-3 bg-muted/30 rounded-lg border border-border">
                      {selectedFAQ.question}
                    </p>
                  )}
                </div>

                {/* Respuesta */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Respuesta</label>
                  {isEditing ? (
                    <Textarea
                      value={editAnswer}
                      onChange={(e) => setEditAnswer(e.target.value)}
                      rows={8}
                      className="text-sm"
                    />
                  ) : (
                    <div className="text-sm text-foreground p-3 bg-muted/30 rounded-lg border border-border max-h-64 overflow-y-auto whitespace-pre-wrap">
                      {selectedFAQ.answer}
                    </div>
                  )}
                </div>

                {/* Categoría */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Categoría</label>
                  {isEditing ? (
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground"
                    >
                      {categories.filter(c => c !== "all").map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`inline-block text-sm font-medium px-3 py-1 rounded ${getCategoryColor(selectedFAQ.category)}`}>
                      {selectedFAQ.category}
                    </span>
                  )}
                </div>

                {/* Metadatos */}
                <div className="pt-4 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Metadatos</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">ID:</span>
                      <span className="ml-2 font-mono text-foreground">{selectedFAQ.id}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Creada:</span>
                      <span className="ml-2 text-foreground">{formatDate(String(selectedFAQ.createdAt))}</span>
                    </div>
                    {selectedFAQ.metadata?.chatId && (
                      <div>
                        <span className="text-muted-foreground">Chat ID:</span>
                        <span className="ml-2 font-mono text-foreground">{selectedFAQ.metadata.chatId}</span>
                      </div>
                    )}
                    {selectedFAQ.metadata?.createdFrom && (
                      <div>
                        <span className="text-muted-foreground">Origen:</span>
                        <span className="ml-2 text-foreground">{selectedFAQ.metadata.createdFrom}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="panel">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  Selecciona una FAQ para ver sus detalles y editarla
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FAQPanel;
