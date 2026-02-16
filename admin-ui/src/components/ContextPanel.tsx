import { useEffect, useState } from "react";
import { MessageSquare, Pencil, Save } from "lucide-react";
import { getConfig, updateConfig, type ContextData } from "@/lib/api";

const ContextPanel = () => {
  const [context, setContext] = useState<ContextData>({
    activePrompt: "",
    additionalNotes: "",
  });
  const [saved, setSaved] = useState<ContextData | null>(null);
  const [editing, setEditing] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const response = await getConfig();
        if (!active) return;
        setContext(response.context);
        setSaved(response.context);
        setEditing(false);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "No se pudo cargar el contexto.");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const updated = await updateConfig(context);
      setSaved(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el contexto.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel">
      <h2 className="panel-title">
        <MessageSquare className="w-5 h-5 text-primary" />
        Contexto de conversación
      </h2>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando contexto...</p>
      ) : editing ? (
        <form onSubmit={handleSubmit}>
          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
          <label className="form-label">Prompt base</label>
          <textarea
            className="form-textarea"
            value={context.activePrompt}
            onChange={(e) => setContext({ ...context, activePrompt: e.target.value })}
            required
          />

          <label className="form-label">Notas adicionales</label>
          <textarea
            className="form-textarea"
            value={context.additionalNotes}
            onChange={(e) => setContext({ ...context, additionalNotes: e.target.value })}
          />

          <button type="submit" className="btn-primary mt-4 w-full" disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Guardando..." : "Guardar contexto"}
          </button>
        </form>
      ) : (
        <div className="preview-box">
          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
          <h3 className="text-sm font-semibold text-foreground mb-3">Contexto guardado</h3>

          <p className="preview-label">Prompt base</p>
          <p className="preview-value">{saved?.activePrompt || "(No definido)"}</p>

          <p className="preview-label">Notas adicionales</p>
          <p className="preview-value">{saved?.additionalNotes || "(Sin notas adicionales)"}</p>

          <button
            type="button"
            className="btn-secondary mt-4 w-full"
            onClick={() => setEditing(true)}
          >
            <Pencil className="w-4 h-4 mr-2" />
            Editar contexto
          </button>
        </div>
      )}
    </div>
  );
};

export default ContextPanel;
