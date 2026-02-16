import { useEffect, useState } from "react";
import { History, Trash2 } from "lucide-react";
import { clearHistory, formatDate, getHistory, type HistoryEntry } from "@/lib/api";

const HistoryPanel = () => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await getHistory();
        if (active) setHistory(data);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "No se pudo cargar el historial.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const handleClearHistory = async () => {
    if (confirm("¿Seguro que deseas borrar todo el historial?")) {
      try {
        await clearHistory();
        setHistory([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo limpiar el historial.");
      }
    }
  };

  return (
    <div className="panel">
      <div className="flex items-center justify-between mb-4">
        <h2 className="panel-title mb-0">
          <History className="w-5 h-5 text-primary" />
          Historial de preguntas y respuestas
        </h2>
        <button type="button" className="btn-danger" onClick={handleClearHistory}>
          <Trash2 className="w-3 h-3 mr-1" />
          Limpiar historial
        </button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Cargando historial...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!loading && history.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay historial aún.</p>
      )}
      {!loading && history.length > 0 &&
        history.map((item, i) => (
          <div key={`${item.question}-${i}`} className="qa-entry">
            <p className="text-sm text-foreground">
              <strong>Pregunta:</strong> {item.question}
            </p>
            <p className="text-sm text-accent mt-1">
              <strong>Respuesta:</strong> {item.answer}
            </p>
            <p className="text-xs text-muted-foreground text-right mt-2">
              {formatDate(String(item.timestamp))}
            </p>
          </div>
        ))}
    </div>
  );
};

export default HistoryPanel;
