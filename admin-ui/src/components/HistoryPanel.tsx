import { useEffect, useMemo, useState } from "react";
import { History, Trash2 } from "lucide-react";
import { clearHistory, formatDate, getHistory, type HistoryEntry } from "@/lib/api";

const HistoryPanel = () => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [chatIdFilter, setChatIdFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

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

  const filteredHistory = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedChat = chatIdFilter.trim();
    const fromTs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toTs = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

    return history
      .filter((item) => {
        const timestamp = typeof item.timestamp === "number"
          ? item.timestamp
          : Number(item.timestamp);
        const safeTimestamp = Number.isFinite(timestamp) ? timestamp : null;

        if (fromTs && safeTimestamp !== null && safeTimestamp < fromTs) return false;
        if (toTs && safeTimestamp !== null && safeTimestamp > toTs) return false;
        if (fromTs && safeTimestamp === null) return false;
        if (toTs && safeTimestamp === null) return false;

        if (normalizedChat && !String(item.chatId || "").includes(normalizedChat)) {
          return false;
        }

        if (!normalizedQuery) return true;
        const question = String(item.question || "").toLowerCase();
        const answer = String(item.answer || "").toLowerCase();
        return question.includes(normalizedQuery) || answer.includes(normalizedQuery);
      })
      .sort((a, b) => {
        const aTs = typeof a.timestamp === "number" ? a.timestamp : Number(a.timestamp);
        const bTs = typeof b.timestamp === "number" ? b.timestamp : Number(b.timestamp);
        const safeA = Number.isFinite(aTs) ? aTs : 0;
        const safeB = Number.isFinite(bTs) ? bTs : 0;
        return safeB - safeA;
      });
  }, [history, query, chatIdFilter, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = filteredHistory.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, chatIdFilter, fromDate, toDate, pageSize]);

  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [currentPage, page]);

  const handleResetFilters = () => {
    setQuery("");
    setChatIdFilter("");
    setFromDate("");
    setToDate("");
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

      <div className="grid gap-4 mb-4 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="form-label">Buscar texto</label>
          <input
            className="form-input"
            placeholder="Pregunta o respuesta"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Chat ID</label>
          <input
            className="form-input"
            placeholder="Filtrar por chatId"
            value={chatIdFilter}
            onChange={(event) => setChatIdFilter(event.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Desde</label>
          <input
            type="date"
            className="form-input"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Hasta</label>
          <input
            type="date"
            className="form-input"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="text-xs text-muted-foreground">
          Mostrando {pageItems.length} de {filteredHistory.length} registros
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary" onClick={handleResetFilters}>
            Limpiar filtros
          </button>
          <label className="text-xs text-muted-foreground">Por pagina</label>
          <select
            className="form-input min-w-[90px]"
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Cargando historial...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!loading && filteredHistory.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay historial aún.</p>
      )}
      {!loading && pageItems.length > 0 &&
        pageItems.map((item, i) => (
          <div key={`${item.question}-${i}`} className="qa-entry">
            <p className="text-sm text-foreground">
              <strong>Pregunta:</strong> {item.question}
            </p>
            <p className="text-sm text-accent mt-1">
              <strong>Respuesta:</strong> {item.answer}
            </p>
            <p className="text-xs text-muted-foreground text-right mt-2">
              {formatDate(item.timestamp)}
            </p>
          </div>
        ))}

      {!loading && filteredHistory.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage <= 1}
          >
            Anterior
          </button>
          <span className="text-xs text-muted-foreground">
            Pagina {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage >= totalPages}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
