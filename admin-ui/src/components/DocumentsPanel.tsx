import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText,
  Upload,
  Link,
  Globe,
  Code,
  FileType,
  Trash2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
import {
  deleteDocument,
  formatBytes,
  formatDate,
  getDocuments,
  toHtmlFromText,
  uploadDocument,
  uploadDocumentHtml,
  uploadDocumentUrl,
  uploadDocumentWeb,
  type DocumentEntry,
} from "@/lib/api";

type DocStatus = "uploaded" | "processing" | "extracting" | "ready" | "error";

interface DocView {
  id: string;
  name: string;
  summary: string;
  status: DocStatus;
  size: string;
  type: string;
  date: string;
  extractedText?: string;
  progress: number;
  stage: string;
}

const STATUS_LABELS: Record<DocStatus, string> = {
  uploaded: "Subido",
  processing: "Procesando",
  extracting: "Extrayendo texto",
  ready: "Listo",
  error: "Error",
};

const Tooltip = ({ text }: { text: string }) => (
  <span className="relative group inline-flex ml-1 cursor-help">
    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
    <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 bg-foreground text-background text-xs rounded-lg px-3 py-2 w-56 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-lg">
      {text}
    </span>
  </span>
);

const DocumentsPanel = () => {
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileSummary, setFileSummary] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [urlSummary, setUrlSummary] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [webSummary, setWebSummary] = useState("");
  const [webDepth, setWebDepth] = useState(0);
  const [webMaxPages, setWebMaxPages] = useState(1);
  const [htmlTitle, setHtmlTitle] = useState("");
  const [htmlSummary, setHtmlSummary] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [textSummary, setTextSummary] = useState("");
  const [textContent, setTextContent] = useState("");

  const toggleSection = (section: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(section) ? next.delete(section) : next.add(section);
      return next;
    });
  };

  const toggleDocExpand = (id: string) => {
    setExpandedDocs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const docs = await getDocuments();
      setDocuments(docs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los documentos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const hasPending = documents.some((doc) =>
    ["uploaded", "processing", "extracting"].includes(doc.status)
  );

  useEffect(() => {
    if (!hasPending) return;
    const interval = setInterval(() => {
      loadDocuments();
    }, 5000);

    return () => clearInterval(interval);
  }, [hasPending, loadDocuments]);

  const deleteDoc = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar este documento?")) return;

    try {
      const docs = await deleteDocument(id);
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el documento.");
    }
  };

  const statusClass = (s: DocStatus) => `status-badge status-${s}`;

  const viewDocs = useMemo<DocView[]>(() => {
    return documents.map((doc) => ({
      id: doc.id,
      name: doc.originalName || doc.filename,
      summary: doc.manualSummary || doc.autoSummary || "Sin resumen",
      status: doc.status,
      size: formatBytes(doc.size || 0),
      type: doc.mimetype || "-",
      date: formatDate(doc.processedAt || doc.createdAt),
      extractedText: doc.extractedText || "",
      progress: Number.isFinite(doc.progress)
        ? Math.min(100, Math.max(0, Number(doc.progress)))
        : doc.status === "ready" || doc.status === "error"
        ? 100
        : 0,
      stage: doc.stage || "Procesando",
    }));
  }, [documents]);

  const handleFileUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;

    try {
      const docs = await uploadDocument(file, fileSummary);
      setDocuments(docs);
      setFile(null);
      setFileSummary("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el documento.");
    }
  };

  const handleUrlUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!urlInput.trim()) return;

    try {
      const docs = await uploadDocumentUrl(urlInput.trim(), urlSummary);
      setDocuments(docs);
      setUrlInput("");
      setUrlSummary("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo descargar el documento.");
    }
  };

  const handleWebUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!webUrl.trim()) return;

    try {
      const docs = await uploadDocumentWeb(webUrl.trim(), webSummary, webDepth, webMaxPages);
      setDocuments(docs);
      setWebUrl("");
      setWebSummary("");
      setWebDepth(0);
      setWebMaxPages(1);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo extraer la pagina web.");
    }
  };

  const handleHtmlUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!htmlContent.trim()) return;

    try {
      const docs = await uploadDocumentHtml(htmlContent, htmlSummary, htmlTitle);
      setDocuments(docs);
      setHtmlTitle("");
      setHtmlSummary("");
      setHtmlContent("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el HTML.");
    }
  };

  const handleTextUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!textContent.trim()) return;

    try {
      const html = toHtmlFromText(textContent);
      const docs = await uploadDocumentHtml(html, textSummary, textTitle || "Texto plano");
      setDocuments(docs);
      setTextTitle("");
      setTextSummary("");
      setTextContent("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el texto.");
    }
  };

  return (
    <div className="panel">
      <h2 className="panel-title">
        <FileText className="w-5 h-5 text-primary" />
        Documentos de referencia
      </h2>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {/* File upload */}
      <form onSubmit={handleFileUpload}>
        <label className="form-label">
          <Upload className="w-3.5 h-3.5 inline mr-1" />
          Selecciona un archivo (PDF, Word, Excel, CSV)
        </label>
        <input
          type="file"
          className="form-input text-sm"
          accept=".pdf,.doc,.docx,.xlsx,.csv,.html,.htm"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <label className="form-label">Resumen / etiquetas</label>
        <input
          type="text"
          className="form-input"
          placeholder="¿Que contiene?"
          value={fileSummary}
          onChange={(event) => setFileSummary(event.target.value)}
        />
        <button type="submit" className="btn-primary mt-4 w-full" disabled={!file}>
          Subir documento
        </button>
      </form>

      {/* URL form */}
      <div className="inline-form">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer bg-transparent border-none p-0"
          onClick={() => toggleSection("url")}
        >
          {openSections.has("url") ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <Link className="w-4 h-4 text-primary" />
          Descargar PDF desde URL
        </button>
        {openSections.has("url") && (
          <form onSubmit={handleUrlUpload} className="grid gap-2 mt-2">
            <input
              type="url"
              className="form-input"
              placeholder="https://ejemplo.com/informe.pdf"
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
            />
            <input
              type="text"
              className="form-input"
              placeholder="Resumen / etiquetas (opcional)"
              value={urlSummary}
              onChange={(event) => setUrlSummary(event.target.value)}
            />
            <button type="submit" className="btn-primary w-full">
              Descargar y procesar
            </button>
          </form>
        )}
      </div>

      {/* Web form */}
      <div className="inline-form">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer bg-transparent border-none p-0"
          onClick={() => toggleSection("web")}
        >
          {openSections.has("web") ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <Globe className="w-4 h-4 text-primary" />
          Cargar pagina web como conocimiento
        </button>
        {openSections.has("web") && (
          <form onSubmit={handleWebUpload} className="grid gap-2 mt-2">
            <input
              type="url"
              className="form-input"
              placeholder="https://usbcali.edu.co/facultad/ingenieria/"
              value={webUrl}
              onChange={(event) => setWebUrl(event.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="form-label">
                  Profundidad de enlaces
                  <Tooltip text="Cuantos niveles de enlaces internos seguira desde la pagina inicial. 0 = solo esa pagina." />
                </label>
                <input
                  type="number"
                  className="form-input"
                  min={0}
                  max={3}
                  value={webDepth}
                  onChange={(event) => setWebDepth(Number(event.target.value))}
                />
              </div>
              <div>
                <label className="form-label">
                  Maximo de paginas
                  <Tooltip text="Limite total de paginas a extraer para evitar recorridos demasiado grandes." />
                </label>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  max={50}
                  value={webMaxPages}
                  onChange={(event) => setWebMaxPages(Number(event.target.value))}
                />
              </div>
            </div>
            <input
              type="text"
              className="form-input"
              placeholder="Resumen / etiquetas (opcional)"
              value={webSummary}
              onChange={(event) => setWebSummary(event.target.value)}
            />
            <button type="submit" className="btn-primary w-full">
              Extraer y guardar
            </button>
          </form>
        )}
      </div>

      {/* HTML form */}
      <div className="inline-form">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer bg-transparent border-none p-0"
          onClick={() => toggleSection("html")}
        >
          {openSections.has("html") ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <Code className="w-4 h-4 text-primary" />
          Pegar HTML
        </button>
        {openSections.has("html") && (
          <form onSubmit={handleHtmlUpload} className="grid gap-2 mt-2">
            <input
              type="text"
              className="form-input"
              placeholder="Titulo (opcional)"
              value={htmlTitle}
              onChange={(event) => setHtmlTitle(event.target.value)}
            />
            <input
              type="text"
              className="form-input"
              placeholder="Resumen / etiquetas (opcional)"
              value={htmlSummary}
              onChange={(event) => setHtmlSummary(event.target.value)}
            />
            <textarea
              className="form-textarea"
              placeholder="Pega aqui el codigo HTML completo"
              value={htmlContent}
              onChange={(event) => setHtmlContent(event.target.value)}
            />
            <button type="submit" className="btn-primary w-full">
              Guardar HTML
            </button>
          </form>
        )}
      </div>

      {/* Text form */}
      <div className="inline-form">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer bg-transparent border-none p-0"
          onClick={() => toggleSection("text")}
        >
          {openSections.has("text") ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <FileType className="w-4 h-4 text-primary" />
          Texto plano
        </button>
        {openSections.has("text") && (
          <form onSubmit={handleTextUpload} className="grid gap-2 mt-2">
            <input
              type="text"
              className="form-input"
              placeholder="Titulo (opcional)"
              value={textTitle}
              onChange={(event) => setTextTitle(event.target.value)}
            />
            <input
              type="text"
              className="form-input"
              placeholder="Resumen / etiquetas (opcional)"
              value={textSummary}
              onChange={(event) => setTextSummary(event.target.value)}
            />
            <textarea
              className="form-textarea"
              placeholder="Pega aqui el texto en limpio"
              value={textContent}
              onChange={(event) => setTextContent(event.target.value)}
            />
            <button type="submit" className="btn-primary w-full">
              Guardar texto
            </button>
          </form>
        )}
      </div>

      {/* Documents list */}
      <div className="mt-6 grid gap-3">
        {loading && <p className="text-sm text-muted-foreground">Cargando documentos...</p>}
        {!loading && viewDocs.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay documentos cargados.</p>
        )}
        {!loading &&
          viewDocs.map((doc) => (
            <div key={doc.id} className="doc-card">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{doc.name}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{doc.summary}</p>
                {doc.extractedText && (
                  <button
                    type="button"
                    className="text-xs text-primary mt-2 cursor-pointer bg-transparent border-none p-0 flex items-center gap-1"
                    onClick={() => toggleDocExpand(doc.id)}
                  >
                    {expandedDocs.has(doc.id) ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                    Ver texto extraido
                  </button>
                )}
                {expandedDocs.has(doc.id) && doc.extractedText && (
                  <pre className="mt-2 p-3 rounded-lg bg-secondary/50 text-xs text-muted-foreground overflow-auto max-h-48 whitespace-pre-wrap">
                    {doc.extractedText}
                  </pre>
                )}
                <p className="text-xs text-muted-foreground mt-2">{doc.date}</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={statusClass(doc.status)}>{STATUS_LABELS[doc.status]}</span>
                {doc.status !== "ready" && doc.status !== "error" && (
                  <div className="w-32">
                    <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${doc.progress}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 text-right">
                      {doc.stage} • {doc.progress}%
                    </p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {doc.size} • {doc.type}
                </p>
                <button type="button" className="btn-danger" onClick={() => deleteDoc(doc.id)}>
                  <Trash2 className="w-3 h-3 mr-1" />
                  Eliminar
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default DocumentsPanel;
