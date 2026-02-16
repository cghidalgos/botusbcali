import { useEffect, useMemo, useState } from "react";
import { Brain, Pencil, Trash2, RefreshCcw } from "lucide-react";
import {
  deleteLearningPattern,
  formatDate,
  getLearningPatterns,
  getLearningStats,
  updateLearningPattern,
  type LearningPattern,
} from "@/lib/api";

const CATEGORY_OPTIONS = [
  "materias",
  "profesores",
  "horarios",
  "becas",
  "coordinadores",
  "general",
];

const LearningPanel = () => {
  const [stats, setStats] = useState<Record<string, { total: number; frequent: number; inTraining: number }> | null>(null);
  const [patterns, setPatterns] = useState<LearningPattern[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<Partial<LearningPattern>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [statsResponse, patternsResponse] = await Promise.all([
        getLearningStats(),
        getLearningPatterns(),
      ]);
      setStats(statsResponse as any);
      setPatterns(patternsResponse);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los patrones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const totalPatterns = useMemo(() => patterns.length, [patterns]);

  const startEdit = (pattern: LearningPattern) => {
    setEditingId(pattern.id);
    setFormState({
      question: pattern.question,
      category: pattern.category,
      frequency: pattern.frequency,
      answer: pattern.answer || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormState({});
  };

  const saveEdit = async (id: string) => {
    try {
      const updated = await updateLearningPattern(id, formState);
      setPatterns((prev) => prev.map((item) => (item.id === id ? updated : item)));
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el patron.");
    }
  };

  const removePattern = async (id: string) => {
    if (!confirm("Seguro que deseas eliminar este patron?")) return;
    try {
      await deleteLearningPattern(id);
      setPatterns((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el patron.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="panel">
        <div className="flex items-center justify-between">
          <h2 className="panel-title mb-0">
            <Brain className="w-5 h-5 text-primary" />
            Aprendizaje del bot
          </h2>
          <button type="button" className="btn-secondary" onClick={loadAll}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Actualizar
          </button>
        </div>

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
        {loading && <p className="text-sm text-muted-foreground mt-3">Cargando...</p>}

        {!loading && stats && (
          <div className="grid gap-3 md:grid-cols-3 mt-4">
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">Total de patrones</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{totalPatterns}</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">Frecuentes</p>
              <p className="text-2xl font-semibold text-foreground mt-1">
                {Object.values(stats).reduce((sum, item) => sum + item.frequent, 0)}
              </p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">En entrenamiento</p>
              <p className="text-2xl font-semibold text-foreground mt-1">
                {Object.values(stats).reduce((sum, item) => sum + item.inTraining, 0)}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <h3 className="text-sm font-semibold text-foreground mb-4">Patrones aprendidos</h3>
        {patterns.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">No hay patrones aprendidos aun.</p>
        )}
        {patterns.length > 0 && (
          <div className="grid gap-3">
            {patterns.map((pattern) => {
              const isEditing = editingId === pattern.id;
              return (
                <div key={pattern.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{pattern.question}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Categoria: {pattern.category} • Frecuencia: {pattern.frequency} •
                        {pattern.addedToTraining ? " En entrenamiento" : " Sin entrenamiento"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Primera vez: {formatDate(pattern.firstAsked)} • Ultima vez: {formatDate(pattern.lastAsked)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className="btn-secondary" onClick={() => startEdit(pattern)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Editar
                      </button>
                      <button type="button" className="btn-danger" onClick={() => removePattern(pattern.id)}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Eliminar
                      </button>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="mt-4 grid gap-3">
                      <div>
                        <label className="form-label">Pregunta</label>
                        <input
                          className="form-input"
                          value={formState.question || ""}
                          onChange={(event) =>
                            setFormState((prev) => ({ ...prev, question: event.target.value }))
                          }
                        />
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <label className="form-label">Categoria</label>
                          <select
                            className="form-input"
                            value={formState.category || pattern.category}
                            onChange={(event) =>
                              setFormState((prev) => ({ ...prev, category: event.target.value }))
                            }
                          >
                            {CATEGORY_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="form-label">Frecuencia</label>
                          <input
                            type="number"
                            min={1}
                            className="form-input"
                            value={formState.frequency ?? pattern.frequency}
                            onChange={(event) =>
                              setFormState((prev) => ({
                                ...prev,
                                frequency: Number(event.target.value),
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <label className="form-label">Respuesta guardada (opcional)</label>
                        <textarea
                          className="form-textarea"
                          value={formState.answer || ""}
                          onChange={(event) =>
                            setFormState((prev) => ({ ...prev, answer: event.target.value }))
                          }
                        />
                      </div>
                      <div className="flex gap-2">
                        <button type="button" className="btn-primary" onClick={() => saveEdit(pattern.id)}>
                          Guardar cambios
                        </button>
                        <button type="button" className="btn-secondary" onClick={cancelEdit}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LearningPanel;
