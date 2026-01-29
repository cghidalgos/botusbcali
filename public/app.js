
const DOCUMENT_POLL_INTERVAL = 6000;
const STATUS_LABELS = {
  uploaded: "Subido",
  processing: "Procesando",
  extracting: "Extrayendo texto",
  ready: "Listo",
  error: "Error",
};

const contextForm = document.getElementById("context-form");
const docUploadForm = document.getElementById("doc-upload-form");
const logContainer = document.getElementById("log");
const documentsList = document.getElementById("documents-list");
const activePromptInput = document.getElementById("activePrompt");
const additionalNotesInput = document.getElementById("additionalNotes");
const contextPreview = document.getElementById("context-preview");
const previewPrompt = document.getElementById("preview-prompt");
const previewNotes = document.getElementById("preview-notes");
const previewTemplate = document.getElementById("preview-template");
const editContextBtn = document.getElementById("edit-context-btn");
const docUrlForm = document.getElementById("doc-url-form");
const docUrlInput = document.getElementById("docUrl");
const docUrlSummaryInput = document.getElementById("docUrlSummary");
const docWebForm = document.getElementById("doc-web-form");
const webUrlInput = document.getElementById("webUrl");
const webUrlSummaryInput = document.getElementById("webUrlSummary");
const webDepthInput = document.getElementById("webDepth");
const webMaxPagesInput = document.getElementById("webMaxPages");
const openDocumentIds = new Set();
const scrollPositions = new Map();
const docHtmlForm = document.getElementById("doc-html-form");
const htmlTitleInput = document.getElementById("htmlTitle");
const htmlSummaryInput = document.getElementById("htmlSummary");
const htmlContentInput = document.getElementById("htmlContent");
const qaHistoryContainer = document.getElementById("qa-history");
const clearHistoryBtn = document.getElementById("clear-history-btn");
function renderHistory(history) {
  if (!qaHistoryContainer) return;
  if (!history.length) {
    qaHistoryContainer.innerHTML = '<p>No hay historial aún.</p>';
    return;
  }
  qaHistoryContainer.innerHTML = history
    .map(
      (item) => `
        <div class="qa-entry">
          <div class="qa-question"><strong>Pregunta:</strong> ${escapeHtml(item.question)}</div>
          <div class="qa-answer"><strong>Respuesta:</strong> ${escapeHtml(item.answer)}</div>
          <div class="qa-meta">${new Date(item.timestamp).toLocaleString()}</div>
        </div>
      `
    )
    .join("");
}

async function loadHistory() {
  try {
    const res = await fetch("/api/history");
    const data = await res.json();
    renderHistory(data);
  } catch (e) {
    qaHistoryContainer.innerHTML = '<p>Error al cargar historial.</p>';
  }
}

if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener("click", async () => {
    if (!confirm("¿Seguro que deseas borrar todo el historial?")) return;
    try {
      await fetch("/api/history/clear", { method: "POST" });
      loadHistory();
      appendLog("Historial borrado", "success");
    } catch (e) {
      appendLog("Error al borrar historial", "error");
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  loadHistory();
  setInterval(loadHistory, DOCUMENT_POLL_INTERVAL);
});

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderExtractedText(doc, isOpen) {
  if (!doc.extractedText) {
    return "";
  }

  return `
    <details class="document-details" ${isOpen ? "open" : ""}>
      <summary>Ver texto extraído completo</summary>
      <pre>${escapeHtml(doc.extractedText)}</pre>
    </details>
  `;
}

function appendLog(message, tone = "info") {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.innerHTML = `<strong>[${new Date().toLocaleTimeString()}]</strong> ${message}`;
  logContainer.prepend(entry);
}

function describeStatus(status) {
  return STATUS_LABELS[status] || status || "Nuevo";
}

function renderDocuments(documents) {
  const currentlyOpen = Array.from(
    documentsList.querySelectorAll(".document-details[open]")
  )
    .map((details) => details.closest(".document-card")?.dataset?.docId)
    .filter(Boolean);
  openDocumentIds.clear();
  currentlyOpen.forEach((id) => openDocumentIds.add(id));

  Array.from(documentsList.querySelectorAll(".document-card")).forEach((card) => {
    const docId = card.dataset?.docId;
    const pre = card.querySelector(".document-details pre");
    if (docId && pre) {
      scrollPositions.set(docId, pre.scrollTop);
    }
  });

  documentsList.innerHTML = "";

  if (!documents.length) {
    documentsList.textContent = "No hay documentos cargados.";
    return;
  }

  documents.forEach((doc) => {
    const summaryText =
      doc.status === "processing"
        ? "El archivo se está procesando..."
        : doc.status === "extracting"
        ? "Extrayendo texto completo del PDF..."
        : doc.autoSummary || doc.manualSummary || "Sin resumen";
    const manualNote = doc.manualSummary
      ? `<p class="document-manual">Resumen manual: ${doc.manualSummary}</p>`
      : "";
    const sourceLink = doc.sourceUrl
      ? `<p class="document-source"><a href="${doc.sourceUrl}" target="_blank" rel="noreferrer">Fuente original</a></p>`
      : "";
    const extractionNote =
      doc.status === "extracting"
        ? `<p class="document-extraction">Se está generando texto legible desde el PDF.</p>`
        : "";
    const ocrNote = doc.usedOcr
      ? `<p class="document-ocr">Se aplicó OCR con Tesseract para capturar texto.</p>`
      : "";
    const extractedTextBlock = renderExtractedText(doc, openDocumentIds.has(doc.id));
    const statusTag = `<span class="status-tag status-${doc.status}">${describeStatus(
      doc.status
    )}</span>`;
    const errorLine = doc.error ? `<p class="error-text">${doc.error}</p>` : "";
    const timestamp = new Date(doc.processedAt || doc.createdAt).toLocaleString();

    const sizeLabel = doc.size ? `${(doc.size / 1024).toFixed(1)} KB` : "Tamaño desconocido";
    const deleteAction = `<button class="document-delete" type="button" data-doc-id="${doc.id}">Eliminar</button>`;
    const card = document.createElement("div");
    card.className = "document-card";
    card.dataset.docId = doc.id;
    card.innerHTML = `
      <div class="document-meta">
        <strong>${doc.originalName}</strong>
        <p class="document-summary">${summaryText}</p>
        ${manualNote}
        ${sourceLink}
        ${extractionNote}
        ${ocrNote}
        ${extractedTextBlock}
        <p class="document-meta__timestamp">${timestamp}</p>
      </div>
      <div class="document-status">
        ${statusTag}
        <p class="document-size">${sizeLabel} • ${doc.mimetype}</p>
        ${deleteAction}
        ${errorLine}
      </div>
    `;

    documentsList.append(card);
  });

    documentsList.querySelectorAll(".document-card").forEach((card) => {
      const docId = card.dataset?.docId;
      const pre = card.querySelector(".document-details pre");
      if (docId && pre && scrollPositions.has(docId)) {
        pre.scrollTop = scrollPositions.get(docId);
      }
    });
}

  documentsList.addEventListener("toggle", (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement)) {
      return;
    }
    const card = details.closest(".document-card");
    const docId = card?.dataset?.docId;
    if (!docId) return;
    if (details.open) {
      openDocumentIds.add(docId);
    } else {
      openDocumentIds.delete(docId);
    }
  });

documentsList.addEventListener("click", async (event) => {
  const button = event.target.closest(".document-delete");
  if (!button) {
    return;
  }

  const docId = button.dataset.docId;
  if (!docId) {
    return;
  }

  if (!confirm("¿Seguro que deseas eliminar este documento?") ) {
    return;
  }

  try {
    button.disabled = true;
    const response = await fetch(`/api/documents/${docId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "No se pudo eliminar el documento.");
    }
    const documents = await response.json();
    renderDocuments(documents);
    appendLog("Documento eliminado", "success");
  } catch (error) {
    appendLog("Error al eliminar documento: " + error.message, "error");
  }
});

async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    const data = await response.json();
    activePromptInput.value = data.context.activePrompt || "";
    additionalNotesInput.value = data.context.additionalNotes || "";
    const promptTemplateInput = document.getElementById("promptTemplate");
    if (promptTemplateInput) {
      promptTemplateInput.value = data.context.promptTemplate || "";
    }
    renderDocuments(data.documents);
    appendLog("Contexto cargado", "success");
    renderContextPreview(data.context);
  } catch (error) {
    appendLog("No se pudo cargar la configuración: " + error.message, "error");
  }
}

function renderContextPreview(context = {}) {
  const { activePrompt = "", additionalNotes = "", promptTemplate = "" } = context;
  previewPrompt.textContent = activePrompt || "(No definido)";
  previewNotes.textContent = additionalNotes || "(Sin notas adicionales)";
  if (previewTemplate) {
    previewTemplate.textContent = promptTemplate || "(Sin plantilla personalizada)";
  }
}

async function refreshDocuments() {
  try {
    const response = await fetch("/api/documents");
    const documents = await response.json();
    renderDocuments(documents);
  } catch (error) {
    appendLog("No se pudo actualizar los documentos: " + error.message, "error");
  }
}

contextForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    activePrompt: activePromptInput.value,
    additionalNotes: additionalNotesInput.value,
    promptTemplate: document.getElementById("promptTemplate")?.value || "",
  };

  try {
    const response = await fetch("/api/config/context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    appendLog("Contexto actualizado", "success");
    activePromptInput.value = data.activePrompt || "";
    additionalNotesInput.value = data.additionalNotes || "";
    const promptTemplateInput = document.getElementById("promptTemplate");
    if (promptTemplateInput) {
      promptTemplateInput.value = data.promptTemplate || "";
    }
    renderContextPreview(data);
  } catch (error) {
    appendLog("Error al guardar el contexto: " + error.message, "error");
  }
});

editContextBtn.addEventListener("click", () => {
  activePromptInput.focus();
  activePromptInput.scrollIntoView({ behavior: "smooth", block: "center" });
});

docUploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData();
  const fileInput = document.getElementById("docFile");

  if (!fileInput.files.length) {
    appendLog("Selecciona un archivo para subir.");
    return;
  }

  formData.append("document", fileInput.files[0]);
  formData.append("summary", document.getElementById("docSummary").value);

  try {
    const response = await fetch("/api/documents", {
      method: "POST",
      body: formData,
    });
    const documents = await response.json();
    renderDocuments(documents);
    appendLog("Documento subido", "success");
    docUploadForm.reset();
  } catch (error) {
    appendLog("Error al subir documento: " + error.message, "error");
  }
});

docUrlForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const url = docUrlInput.value.trim();
  if (!url) {
    appendLog("Ingresa una URL para descargar el PDF.");
    return;
  }

  const submitButton = docUrlForm.querySelector("button[type=submit]");
  const originalButtonText = submitButton ? submitButton.textContent : "";
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Descargando...";
  }
  appendLog("Descargando y procesando el PDF...", "info");

  const payload = {
    url,
    summary: docUrlSummaryInput.value.trim(),
  };

  try {
    const response = await fetch("/api/documents/url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const documents = await response.json();
    renderDocuments(documents);
    appendLog("Documento descargado y procesado", "success");
    docUrlForm.reset();
  } catch (error) {
    appendLog("Error al descargar el documento: " + error.message, "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText || "Descargar y procesar";
    }
  }
});

docWebForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const url = webUrlInput.value.trim();
  if (!url) {
    appendLog("Ingresa una URL para extraer la página.");
    return;
  }

  const submitButton = docWebForm.querySelector("button[type=submit]");
  const originalButtonText = submitButton ? submitButton.textContent : "";
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Extrayendo...";
  }
  appendLog("Extrayendo información de la página web...", "info");

  const payload = {
    url,
    summary: webUrlSummaryInput.value.trim(),
    depth: Number.parseInt(webDepthInput?.value || "1", 10),
    maxPages: Number.parseInt(webMaxPagesInput?.value || "10", 10),
  };

  try {
    const response = await fetch("/api/documents/web", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "No se pudo extraer la página.");
    }
    const documents = await response.json();
    renderDocuments(documents);
    appendLog("Página web extraída y guardada", "success");
    docWebForm.reset();
  } catch (error) {
    appendLog("Error al extraer página: " + error.message, "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  }
});

docHtmlForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const html = htmlContentInput.value.trim();
  if (!html) {
    appendLog("Pega el HTML antes de guardar.");
    return;
  }

  const submitButton = docHtmlForm.querySelector("button[type=submit]");
  const originalButtonText = submitButton ? submitButton.textContent : "";
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Guardando...";
  }

  const payload = {
    title: htmlTitleInput.value.trim(),
    summary: htmlSummaryInput.value.trim(),
    html,
  };

  try {
    const response = await fetch("/api/documents/html", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "No se pudo guardar el HTML.");
    }
    const documents = await response.json();
    renderDocuments(documents);
    appendLog("HTML guardado y procesado", "success");
    docHtmlForm.reset();
  } catch (error) {
    appendLog("Error al guardar HTML: " + error.message, "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  }
});

loadConfig();
refreshDocuments();
setInterval(refreshDocuments, DOCUMENT_POLL_INTERVAL);