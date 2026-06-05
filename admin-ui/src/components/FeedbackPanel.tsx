import { useEffect, useState } from "react";
import {
  getFeedback,
  regenerateFeedbackAnswer,
  resolveFeedback,
  formatDate,
  type FeedbackEntry,
  type FeedbackStats,
} from "@/lib/api";

type Filter = "pending" | "down" | "up" | "all";

const FeedbackPanel = () => {
  const [items, setItems] = useState<FeedbackEntry[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");

  // Estado por entrada: respuesta sugerida/editada y flags de carga.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, "regen" | "save" | undefined>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const params =
        filter === "pending"
          ? { rating: "down" as const, resolved: false }
          : filter === "down"
          ? { rating: "down" as const }
          : filter === "up"
          ? { rating: "up" as const }
          : {};
      const data = await getFeedback({ ...params, limit: 300 });
      setItems(data.items);
      setStats(data.stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el feedback.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleRegenerate = async (entry: FeedbackEntry) => {
    setBusy((b) => ({ ...b, [entry.id]: "regen" }));
    setNotice(null);
    try {
      const res = await regenerateFeedbackAnswer(entry.id);
      setDrafts((d) => ({ ...d, [entry.id]: res.answer || "" }));
      if (!res.answer) setNotice("La IA no devolvió una sugerencia. Revisa que haya documentos y API key.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Error generando sugerencia.");
    } finally {
      setBusy((b) => ({ ...b, [entry.id]: undefined }));
    }
  };

  const handleSave = async (entry: FeedbackEntry) => {
    const answer = (drafts[entry.id] ?? "").trim();
    if (!answer) {
      setNotice("Escribe o genera una respuesta antes de guardar.");
      return;
    }
    setBusy((b) => ({ ...b, [entry.id]: "save" }));
    setNotice(null);
    try {
      const res = await resolveFeedback(entry.id, answer);
      setNotice(
        res.savedToFaq
          ? "Respuesta guardada. El bot la usará automáticamente para preguntas similares. ✅"
          : "Respuesta guardada (no se pudo indexar para autocompletar; revisa la API key de embeddings)."
      );
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Error guardando la respuesta.");
    } finally {
      setBusy((b) => ({ ...b, [entry.id]: undefined }));
    }
  };

  return (
    <div className="panel">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="panel-title">Feedback de usuarios</h2>
        {stats && (
          <div className="flex gap-3 text-sm">
            <span className="text-green-600">👍 {stats.up}</span>
            <span className="text-red-500">👎 {stats.down}</span>
            <span className="text-amber-600">⏳ {stats.pendingDown} sin resolver</span>
            <span className="text-muted-foreground">✅ {stats.resolvedDown} resueltas</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 my-3 flex-wrap">
        {([
          ["pending", "Pendientes 👎"],
          ["down", "Todas 👎"],
          ["up", "Positivas 👍"],
          ["all", "Todas"],
        ] as [Filter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={filter === key ? "btn-primary" : "btn-secondary"}
          >
            {label}
          </button>
        ))}
        <button onClick={load} className="btn-secondary">Actualizar</button>
      </div>

      {notice && <p className="text-sm text-blue-600 mb-3">{notice}</p>}
      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Cargando feedback...</p>}
      {!loading && items.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay feedback en esta vista.</p>
      )}

      <div className="space-y-3">
        {items.map((entry) => (
          <div key={entry.id} className="qa-entry">
            <div className="flex items-center justify-between gap-2">
              <span className={entry.rating === "up" ? "text-green-600" : "text-red-500"}>
                {entry.rating === "up" ? "👍 Útil" : "👎 No le sirvió"}
              </span>
              <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>
            </div>

            <div className="mt-2">
              <div className="text-xs text-muted-foreground">Pregunta</div>
              <div className="text-sm font-semibold text-foreground">{entry.question}</div>
            </div>

            <div className="mt-2">
              <div className="text-xs text-muted-foreground">Respuesta que dio el bot</div>
              <div className="text-sm text-foreground whitespace-pre-wrap">{entry.answer}</div>
            </div>

            {entry.resolved ? (
              <div className="mt-2 rounded bg-green-50 p-2">
                <div className="text-xs text-green-700">✅ Respuesta corregida (guardada como confiable)</div>
                <div className="text-sm text-foreground whitespace-pre-wrap">{entry.resolvedAnswer}</div>
              </div>
            ) : entry.rating === "down" ? (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleRegenerate(entry)}
                    className="btn-secondary"
                    disabled={busy[entry.id] === "regen"}
                  >
                    {busy[entry.id] === "regen" ? "Generando..." : "✨ Generar solución"}
                  </button>
                  <button
                    onClick={() => handleSave(entry)}
                    className="btn-primary"
                    disabled={busy[entry.id] === "save"}
                  >
                    {busy[entry.id] === "save" ? "Guardando..." : "💾 Guardar como respuesta correcta"}
                  </button>
                </div>
                <textarea
                  className="form-input w-full min-h-[120px]"
                  placeholder="Genera una solución con IA o escribe la respuesta correcta aquí. Al guardar, el bot la usará para preguntas similares."
                  value={drafts[entry.id] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [entry.id]: e.target.value }))}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeedbackPanel;
