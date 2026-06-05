import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getKnowledgeGaps,
  resolveKnowledgeGap,
  formatDate,
  type KnowledgeGapsResponse,
} from "@/lib/api";

const KnowledgeGapsPanel = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<KnowledgeGapsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getKnowledgeGaps();
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los vacíos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleResolve = async (id: string) => {
    setBusy(id);
    try {
      await resolveKnowledgeGap(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo marcar como resuelto.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="panel">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="panel-title">Vacíos de conocimiento</h2>
        {data?.stats && (
          <div className="flex gap-3 text-sm">
            <span className="text-amber-600">⚠️ {data.stats.pending} sin resolver</span>
            <span className="text-muted-foreground">
              🔁 {data.stats.totalOccurrences} veces preguntado
            </span>
            <span className="text-green-600">✅ {data.stats.resolved} resueltos</span>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground my-2">
        Preguntas que el bot no pudo responder. Sube un documento que cubra el tema o crea una
        respuesta en{" "}
        <button className="text-blue-600 underline" onClick={() => navigate("/feedback")}>
          Feedback
        </button>
        , y luego márcalo como resuelto.
      </p>

      <div className="flex gap-2 my-3">
        <button onClick={load} className="btn-secondary">Actualizar</button>
        <button onClick={() => navigate("/documentos")} className="btn-secondary">
          Subir documento
        </button>
      </div>

      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Cargando...</p>}
      {!loading && (!data || data.items.length === 0) && (
        <p className="text-sm text-muted-foreground">
          🎉 No hay vacíos pendientes. El bot está respondiendo bien.
        </p>
      )}

      {!loading && data && data.byCategory.length > 0 && (
        <div className="space-y-5">
          {data.byCategory.map((group) => (
            <div key={group.category}>
              <h3 className="text-sm font-bold text-foreground uppercase mb-2">
                {group.category}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({group.total} consultas)
                </span>
              </h3>
              <div className="space-y-2">
                {group.items.map((gap) => (
                  <div key={gap.id} className="qa-entry">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-foreground">
                          {gap.question}
                          {gap.count > 1 && (
                            <span className="ml-2 text-xs text-amber-600">
                              ×{gap.count} veces
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Última vez: {formatDate(gap.lastSeenAt)}
                        </div>
                      </div>
                      <button
                        onClick={() => handleResolve(gap.id)}
                        className="btn-secondary text-xs"
                        disabled={busy === gap.id}
                      >
                        {busy === gap.id ? "..." : "✓ Resuelto"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default KnowledgeGapsPanel;
