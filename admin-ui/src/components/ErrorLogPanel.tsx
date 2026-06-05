import { useEffect, useState } from "react";
import { getRecentErrors, type ErrorLogResponse } from "@/lib/api";

const ErrorLogPanel = () => {
  const [errors, setErrors] = useState<ErrorLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await getRecentErrors(100);
        if (!active) return;
        setErrors(data);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "No se pudieron cargar errores.");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="panel">
      <h2 className="panel-title">Monitor de errores</h2>
      {loading && <p className="text-sm text-muted-foreground">Cargando errores...</p>}
      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

      {!loading && errors?.items?.length === 0 && (
        <p className="text-sm text-muted-foreground">Sin errores recientes.</p>
      )}

      {!loading && errors?.items?.length ? (
        <div className="space-y-2">
          {errors.items.map((entry) => (
            <div key={entry.id} className="qa-entry">
              <div className="text-xs text-muted-foreground">{entry.createdAt}</div>
              <div className="text-sm font-semibold text-foreground">{entry.type}</div>
              <div className="text-sm text-foreground">{entry.message}</div>
              {entry.context ? (
                <div className="text-xs text-muted-foreground mt-2">
                  {JSON.stringify(entry.context).slice(0, 180)}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default ErrorLogPanel;
