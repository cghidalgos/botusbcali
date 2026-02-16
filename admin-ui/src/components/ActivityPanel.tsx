import { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import {
  getCacheStats,
  getLearningStats,
  getProfileStats,
  getDocuments,
  formatDate,
} from "@/lib/api";

interface LogEntry {
  time: string;
  message: string;
}

const ActivityPanel = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshLogs = async () => {
    try {
      setLoading(true);
      const [cacheStats, learningStats, profileStats, documents] = await Promise.all([
        getCacheStats(),
        getLearningStats(),
        getProfileStats(),
        getDocuments(),
      ]);

      const now = new Date();
      const time = now.toLocaleTimeString();
      const newLogs: LogEntry[] = [
        {
          time,
          message: `Cache GPT: ${cacheStats.totalEntries} respuestas, ${cacheStats.totalHits} hits`,
        },
        {
          time,
          message: `Aprendizaje: ${learningStats.totalPatterns} patrones aprendidos`,
        },
        {
          time,
          message: `Usuarios activos: ${profileStats.activeUsers} (total ${profileStats.totalUsers})`,
        },
        {
          time,
          message: `Documentos cargados: ${documents.length}`,
        },
      ];

      setLogs(newLogs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la actividad.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    refreshLogs();
    const interval = setInterval(() => {
      if (active) refreshLogs();
    }, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const lastUpdate = useMemo(() => formatDate(new Date().toISOString()), [logs]);

  return (
    <div className="panel">
      <h2 className="panel-title">
        <Activity className="w-5 h-5 text-primary" />
        Actividad
      </h2>
      <div>
        {loading && <p className="text-sm text-muted-foreground">Cargando actividad...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && logs.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin actividad reciente.</p>
        )}
        {!loading && logs.length > 0 &&
          logs.map((entry, i) => (
            <div key={`${entry.message}-${i}`} className="log-entry">
              <strong className="text-foreground">[{entry.time}]</strong> {entry.message}
            </div>
          ))}
        {!loading && logs.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3">Ultima actualizacion: {lastUpdate}</p>
        )}
      </div>
    </div>
  );
};

export default ActivityPanel;
