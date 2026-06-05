import { useEffect, useMemo, useState } from "react";
import { getMetricsOverview, getTopQuestions, type MetricsOverviewResponse, type TopQuestionsResponse } from "@/lib/api";

const BotMetricsPanel = () => {
  const [overview, setOverview] = useState<MetricsOverviewResponse | null>(null);
  const [topQuestions, setTopQuestions] = useState<TopQuestionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const [overviewData, topData] = await Promise.all([
          getMetricsOverview(7),
          getTopQuestions(10),
        ]);
        if (!active) return;
        setOverview(overviewData);
        setTopQuestions(topData);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "No se pudieron cargar métricas.");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(() => {
    if (!overview?.data) return null;
    return overview.data.reduce(
      (acc, day) => {
        acc.requests += day.openai.requests;
        acc.promptTokens += day.openai.promptTokens;
        acc.completionTokens += day.openai.completionTokens;
        acc.totalTokens += day.openai.totalTokens;
        acc.estimatedCost += day.openai.estimatedCost;
        acc.embeddingRequests += day.embeddings.requests;
        acc.embeddingTokens += day.embeddings.totalTokens;
        acc.questions += day.questions;
        return acc;
      },
      {
        requests: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        embeddingRequests: 0,
        embeddingTokens: 0,
        questions: 0,
      }
    );
  }, [overview]);

  return (
    <div className="panel">
      <h2 className="panel-title">Métricas del bot</h2>
      {loading && <p className="text-sm text-muted-foreground">Cargando métricas...</p>}
      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

      {!loading && totals && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="preview-box">
            <p className="preview-label">OpenAI (7 días)</p>
            <p className="preview-value">Solicitudes: {totals.requests}</p>
            <p className="preview-value">Tokens: {totals.totalTokens}</p>
            <p className="preview-value">Costo aprox: ${totals.estimatedCost.toFixed(4)}</p>
          </div>
          <div className="preview-box">
            <p className="preview-label">Embeddings (7 días)</p>
            <p className="preview-value">Solicitudes: {totals.embeddingRequests}</p>
            <p className="preview-value">Tokens: {totals.embeddingTokens}</p>
            <p className="preview-value">Preguntas: {totals.questions}</p>
          </div>
        </div>
      )}

      {!loading && overview?.data?.length ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-foreground mb-2">Uso diario</h3>
          <div className="space-y-2">
            {overview.data.map((day) => (
              <div key={day.date} className="doc-card">
                <div>
                  <div className="text-sm font-semibold text-foreground">{day.date}</div>
                  <div className="text-xs text-muted-foreground">Preguntas: {day.questions}</div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>OpenAI: {day.openai.requests} req</div>
                  <div>Tokens: {day.openai.totalTokens}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && topQuestions?.items?.length ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-foreground mb-2">Top preguntas</h3>
          <div className="space-y-2">
            {topQuestions.items.map((item) => (
              <div key={item.text} className="qa-entry">
                <div className="text-sm text-foreground">{item.text}</div>
                <div className="text-xs text-muted-foreground">Veces: {item.count}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default BotMetricsPanel;
