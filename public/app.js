
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
const docTextForm = document.getElementById("doc-text-form");
const textTitleInput = document.getElementById("textTitle");
const textSummaryInput = document.getElementById("textSummary");
const textContentInput = document.getElementById("textContent");
const qaHistoryContainer = document.getElementById("qa-history");
const clearHistoryBtn = document.getElementById("clear-history-btn");

let documentUploadMaxMB = 60;

function clampPercent(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function createProgressButton(button, workingText, fallbackText) {
  const originalText = button ? button.textContent : "";
  return {
    start() {
      if (!button) return;
      button.disabled = true;
      this.set(0);
    },
    set(percent) {
      if (!button) return;
      button.textContent = `${workingText} ${clampPercent(percent)}%`;
    },
    finish() {
      if (!button) return;
      button.disabled = false;
      button.textContent = originalText || fallbackText || "";
    },
  };
}

function startSimulatedProgress(setPercent) {
  let percent = 0;
  const safeSet = (value) => {
    try {
      setPercent(clampPercent(value));
    } catch {
      // ignore
    }
  };

  safeSet(0);
  const timer = setInterval(() => {
    if (percent < 85) {
      percent += 3 + Math.floor(Math.random() * 4);
    } else {
      percent += 1;
    }
    percent = Math.min(95, percent);
    safeSet(percent);
  }, 250);

  return () => {
    clearInterval(timer);
    safeSet(100);
  };
}

function xhrJson({ url, method = "POST", headers = {}, body, onUploadProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.responseType = "json";

    Object.entries(headers || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      xhr.setRequestHeader(key, String(value));
    });

    if (typeof onUploadProgress === "function" && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || !event.total) return;
        onUploadProgress(event.loaded, event.total);
      };
    }

    xhr.onload = () => {
      const status = xhr.status;
      const ok = status >= 200 && status < 300;

      let data = xhr.response;
      if (data == null && xhr.responseText) {
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          data = null;
        }
      }

      resolve({ ok, status, data });
    };

    xhr.onerror = () => reject(new Error("Error de red"));
    xhr.send(body);
  });
}

const broadcastForm = document.getElementById("broadcast-form");
const broadcastMessageInput = document.getElementById("broadcastMessage");
const broadcastSendToAllInput = document.getElementById("broadcastSendToAll");
const broadcastChatIdsInput = document.getElementById("broadcastChatIds");
const broadcastSecretInput = document.getElementById("broadcastSecret");
const broadcastSendBtn = document.getElementById("broadcastSendBtn");
const broadcastResultWrapper = document.getElementById("broadcast-result-wrapper");
const broadcastResultPre = document.getElementById("broadcast-result");

const broadcastMediaTypeInput = document.getElementById("broadcastMediaType");
const broadcastMediaSourceInput = document.getElementById("broadcastMediaSource");
const broadcastMediaRefWrap = document.getElementById("broadcastMediaRefWrap");
const broadcastMediaRefInput = document.getElementById("broadcastMediaRef");
const broadcastMediaFileWrap = document.getElementById("broadcastMediaFileWrap");
const broadcastMediaFileInput = document.getElementById("broadcastMediaFile");
const broadcastMediaCaptionInput = document.getElementById("broadcastMediaCaption");

function renderHistory(history) {
  if (!qaHistoryContainer) return;

  const sorted = Array.isArray(history)
    ? [...history].sort((a, b) => {
        const at = Date.parse(a?.timestamp ?? 0) || 0;
        const bt = Date.parse(b?.timestamp ?? 0) || 0;
        return bt - at;
      })
    : [];

  if (!sorted.length) {
    qaHistoryContainer.innerHTML =
      '<p class="empty-state">No hay historial aún. Cuando el bot responda preguntas, aparecerán aquí.</p>';
    return;
  }
  qaHistoryContainer.innerHTML = sorted
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

let historyCache = [];

async function loadHistory() {
  try {
    const res = await fetch("api/history");
    const data = await res.json();
    historyCache = Array.isArray(data) ? data : [];
    renderHistory(historyCache);
  } catch (e) {
    qaHistoryContainer.innerHTML = '<p>Error al cargar historial.</p>';
  }
}

if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener("click", async () => {
    if (!confirm("¿Seguro que deseas borrar todo el historial?")) return;
    const progress = createProgressButton(clearHistoryBtn, "Borrando…", "Borrar historial");
    progress.start();
    const stopSimulated = startSimulatedProgress((p) => progress.set(p));
    try {
      await fetch("api/history/clear", { method: "POST" });
      await loadHistory();
      stopSimulated();
      progress.set(100);
      appendLog("Historial borrado", "success");
    } catch (e) {
      appendLog("Error al borrar historial", "error");
    } finally {
      stopSimulated();
      progress.finish();
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  loadHistory();
  loadUsers();
  initUsersFilterBar();
  initUsersSearchAndPagination();
  initUserHistoryModal();
  setInterval(loadHistory, DOCUMENT_POLL_INTERVAL);
  setInterval(loadUsers, DOCUMENT_POLL_INTERVAL);
});

function initUsersFilterBar() {
  const buttons = Array.from(document.querySelectorAll('.filter-btn'));
  buttons.forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      usersFilter = btn.getAttribute('data-filter') || 'all';
      currentPage = 1;
      renderUsers(usersCache || []);
      renderBroadcastUsers(usersCache || []);
    });
  });
  // set default active
  const defaultBtn = document.querySelector('.filter-btn[data-filter="all"]');
  if (defaultBtn) defaultBtn.classList.add('active');
}

function debounce(fn, wait = 200) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function initUsersSearchAndPagination() {
  const search = document.getElementById('users-search');
  const paginationWrap = document.getElementById('users-pagination');
  if (search) {
    search.addEventListener('input', debounce((ev) => {
      usersQuery = (ev.target.value || '').trim();
      currentPage = 1;
      renderUsers(usersCache);
      renderBroadcastUsers(usersCache);
    }, 220));
  }

  if (paginationWrap) {
    paginationWrap.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.page-btn');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      if (action === 'prev') currentPage = Math.max(1, currentPage - 1);
      else if (action === 'next') currentPage = currentPage + 1;
      else if (btn.hasAttribute('data-page')) currentPage = Number(btn.getAttribute('data-page')) || 1;
      renderUsers(usersCache);
      // keep broadcast list synced
      renderBroadcastUsers(usersCache);
    });
  }
}

function renderPagination(totalItems) {
  const wrap = document.getElementById('users-pagination');
  if (!wrap) return;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  currentPage = Math.min(currentPage, totalPages);
  wrap.innerHTML = '';

  const info = document.createElement('div');
  info.style.fontSize = '0.85rem';
  info.style.color = 'rgba(255,255,255,0.7)';
  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(totalItems, currentPage * PAGE_SIZE);
  info.textContent = `${totalItems ? `${start}-${end} de ${totalItems}` : '0 usuarios'}`;
  wrap.appendChild(info);

  const spacer = document.createElement('div');
  spacer.style.flex = '1';
  wrap.appendChild(spacer);

  const prev = document.createElement('button');
  prev.className = 'page-btn';
  prev.setAttribute('data-action', 'prev');
  prev.textContent = '« Anterior';
  prev.disabled = currentPage <= 1;
  wrap.appendChild(prev);

  // simple page buttons (up to 7)
  const maxButtons = 7;
  const half = Math.floor(maxButtons / 2);
  let startPage = Math.max(1, currentPage - half);
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage + 1 < maxButtons) startPage = Math.max(1, endPage - maxButtons + 1);

  for (let p = startPage; p <= endPage; p += 1) {
    const b = document.createElement('button');
    b.className = 'page-btn' + (p === currentPage ? ' active' : '');
    b.setAttribute('data-page', String(p));
    b.textContent = String(p);
    wrap.appendChild(b);
  }

  const next = document.createElement('button');
  next.className = 'page-btn';
  next.setAttribute('data-action', 'next');
  next.textContent = 'Siguiente »';
  next.disabled = currentPage >= totalPages;
  wrap.appendChild(next);
}

function initUserHistoryModal() {
  const modal = document.getElementById('user-history-modal');
  const closeBtn = document.getElementById('modal-close');
  if (!modal) return;
  modal.addEventListener('click', (ev) => {
    if (ev.target === modal.querySelector('.modal-backdrop')) closeUserHistoryModal();
  });
  if (closeBtn) closeBtn.addEventListener('click', closeUserHistoryModal);
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closeUserHistoryModal();
  });
}

function openUserHistoryModal(title) {
  const modal = document.getElementById('user-history-modal');
  const titleEl = document.getElementById('modal-user-title');
  if (!modal) return;
  if (titleEl) titleEl.textContent = title || 'Conversación';
  modal.setAttribute('aria-hidden', 'false');
}

function closeUserHistoryModal() {
  const modal = document.getElementById('user-history-modal');
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'true');
}

async function showUserHistory(chatId, displayName) {
  if (!historyCache.length) await loadHistory();
  const items = (historyCache || []).filter((h) => String(h.chatId) === String(chatId));
  const container = document.getElementById('modal-user-history');
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<p class="user-history-empty">No hay historial para ${escapeHtml(displayName || chatId)}.</p>`;
    openUserHistoryModal(displayName || chatId);
    return;
  }

  const sorted = items.slice().sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
  container.innerHTML = sorted
    .map(it => `
      <div class="user-history-entry">
        <div class="qh">${escapeHtml(new Date(it.timestamp).toLocaleString())}</div>
        <div class="qa"><strong>Q:</strong> ${escapeHtml(it.question)}</div>
        <div class="qa" style="margin-top:.4rem"><strong>A:</strong> ${escapeHtml(it.answer)}</div>
      </div>
    `).join('');

  openUserHistoryModal(displayName || chatId);
}

/* ------------------ Users UI ------------------ */
const usersList = document.getElementById("users-list");
const usersCountEl = document.getElementById('users-count');
const pendingDeletes = new Map(); // chatId -> { timerId, expiresAt }
let usersCache = [];
let usersFilter = 'all';
let usersQuery = '';
const PAGE_SIZE = 20;
let currentPage = 1;
const RECENT_MS = 24 * 60 * 60 * 1000; // 24 horas

// UI state preserved across automatic refreshes
const broadcastSelectedIds = new Set();

function userMatchesQuery(u, q) {
  if (!q) return true;
  const low = String(q).toLowerCase().trim();
  const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
  const username = String(u.username || '').toLowerCase();
  const chatId = String(u.chatId || '');
  return name.includes(low) || username.includes(low) || chatId.includes(low);
}


function userMatchesFilter(u, filter) {
  if (!u) return false;
  if (!filter || filter === 'all') return true;
  if (filter === 'recent') {
    const t = Date.parse(u.lastInteractionAt || 0) || 0;
    return Date.now() - t <= RECENT_MS;
  }
  if (filter === 'blocked') return Boolean(u.isBlocked);
  if (filter === 'hasUsername') return Boolean(u.username);
  return true;
}

function renderUsers(users) {
  if (!usersList) return;
  const sorted = Array.isArray(users) ? [...users].sort((a,b)=>{
    const at = Date.parse(a?.lastInteractionAt||0)||0;
    const bt = Date.parse(b?.lastInteractionAt||0)||0;
    return bt - at;
  }) : [];

  const filtered = sorted.filter(u => userMatchesFilter(u, usersFilter) && userMatchesQuery(u, usersQuery));
  const total = filtered.length;
  if (usersCountEl) usersCountEl.textContent = String(total);

  if (!total) {
    usersList.innerHTML = '<p class="empty-state">No hay usuarios que coincidan con el filtro.</p>';
    renderPagination(0);
    return;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  usersList.innerHTML = pageItems
    .map((u) => {
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || '(sin nombre)';
      const identity = u.username ? `@${escapeHtml(u.username)}` : `chat_id: ${escapeHtml(String(u.chatId))}`;
      const last = u.lastInteractionAt ? new Date(u.lastInteractionAt).toLocaleString() : '';
      const isBlocked = Boolean(u.isBlocked);

      const avatarSvg = `
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z" fill="currentColor" opacity="0.12"/>
          <path d="M12 13c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" fill="currentColor" opacity="0.08"/>
          <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c4.418 0 8 2.239 8 5v1H4v-1c0-2.761 3.582-5 8-5z" stroke="currentColor" stroke-opacity="0.6" stroke-width="0.6"/>
        </svg>
      `;

      const badgeHtml = isBlocked ? `<span class="avatar-badge" title="Bloqueado">!</span>` : "";

      return `
        <div class="user-card ${isBlocked ? 'disabled-muted' : ''}" data-chat-id="${escapeHtml(String(u.chatId))}">
          <div class="user-avatar">${avatarSvg}${badgeHtml}</div>
          <div class="user-meta">
            <button class="user-name clickable" data-chat-id="${escapeHtml(String(u.chatId))}">${escapeHtml(name)}</button>
            <div class="user-identity meta-line">${identity} • ${escapeHtml(last)}</div>
          </div>
          <div class="user-actions">
            <button class="user-reply" type="button" data-chat-id="${escapeHtml(String(u.chatId))}">Responder</button>
            <button class="user-delete" type="button" data-chat-id="${escapeHtml(String(u.chatId))}">Eliminar</button>
          </div>
        </div>
      `;
    })
    .join('');

  renderPagination(total);
}

async function loadUsers() {
  if (!usersList) return;
  try {
    const res = await fetch('/api/users');
    if (!res.ok) throw new Error('Error cargando usuarios');
    const data = await res.json();
    usersCache = Array.isArray(data) ? data : [];
    renderUsers(usersCache);
    renderBroadcastUsers(usersCache);
  } catch (err) {
    usersList.innerHTML = '<p class="empty-state">Error al cargar usuarios.</p>';
    usersCache = [];
    renderBroadcastUsers([]);
  }
}

/* Broadcast users UI (inside Mensajería masiva) */
const broadcastUsersList = document.getElementById('broadcast-users-list');
const broadcastSelectAll = document.getElementById('broadcastSelectAll');

function renderBroadcastUsers(users) {
  if (!broadcastUsersList) return;
  if (!Array.isArray(users) || users.length === 0) {
    broadcastUsersList.innerHTML = '<p class="empty-state">No hay usuarios disponibles.</p>';
    return;
  }

  const filtered = users.filter(u => userMatchesFilter(u, usersFilter) && userMatchesQuery(u, usersQuery));

  const html = filtered.map(u => {
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || '(sin nombre)';
    const identity = u.username ? `@${escapeHtml(u.username)}` : `chat_id: ${escapeHtml(String(u.chatId))}`;
    const isBlocked = Boolean(u.isBlocked);
    const initials = (u.firstName || u.lastName || u.username || String(u.chatId)).slice(0,2).toUpperCase();
    const avatarSvg = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z" fill="currentColor" opacity="0.12"/>
        <path d="M12 13c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" fill="currentColor" opacity="0.08"/>
      </svg>
    `;
    const badgeHtml = isBlocked ? `<span class="avatar-badge" title="Bloqueado">!</span>` : "";
    return `
      <label class="broadcast-user" title="${escapeHtml(identity)}">
        <input type="checkbox" class="broadcast-user-checkbox" data-chat-id="${escapeHtml(String(u.chatId))}" />
        <div class="b-avatar">${avatarSvg}${badgeHtml}</div>
        <div>
          <div class="b-name">${escapeHtml(name)}</div>
          <div class="b-identity">${escapeHtml(identity)}</div>
        </div>
      </label>
    `;
  }).join('');

  broadcastUsersList.innerHTML = html;
  // restore selection from state
  document.querySelectorAll('.broadcast-user-checkbox').forEach((cb) => {
    const id = cb.getAttribute('data-chat-id');
    cb.checked = broadcastSelectedIds.has(id);
  });
  updateBroadcastChatIdsFromCheckboxes();
}

function getSelectedBroadcastChatIds() {
  // prefer tracked selection set; fall back to DOM
  if (broadcastSelectedIds.size) return Array.from(broadcastSelectedIds);
  const boxes = Array.from(document.querySelectorAll('.broadcast-user-checkbox'));
  return boxes.filter(b => b.checked).map(b => b.getAttribute('data-chat-id'));
}

function updateBroadcastChatIdsFromCheckboxes() {
  const ids = Array.from(document.querySelectorAll('.broadcast-user-checkbox'))
    .filter(b => b.checked)
    .map(b => b.getAttribute('data-chat-id'));

  // keep internal selection set in sync
  broadcastSelectedIds.clear();
  ids.forEach((id) => broadcastSelectedIds.add(id));

  if (broadcastChatIdsInput) broadcastChatIdsInput.value = ids.join('\n');

  // sync select-all checkbox
  const total = document.querySelectorAll('.broadcast-user-checkbox').length;
  const checked = ids.length;
  if (broadcastSelectAll) broadcastSelectAll.checked = checked > 0 && checked === total;
}

broadcastUsersList?.addEventListener('change', (ev) => {
  const box = ev.target.closest('.broadcast-user-checkbox');
  if (!box) return;
  const chatId = box.getAttribute('data-chat-id');
  if (box.checked) broadcastSelectedIds.add(chatId);
  else broadcastSelectedIds.delete(chatId);
  updateBroadcastChatIdsFromCheckboxes();
});

// allow clicking name/avatar in the broadcast list to open the per-user history
broadcastUsersList?.addEventListener('click', (ev) => {
  const label = ev.target.closest('.broadcast-user');
  if (!label) return;
  const id = label.querySelector('.broadcast-user-checkbox')?.getAttribute('data-chat-id');
  if (!id) return;
  if (ev.target.closest('.b-name') || ev.target.closest('.b-avatar')) {
    const display = label.querySelector('.b-name')?.textContent || id;
    showUserHistory(id, display);
  }
});

broadcastSelectAll?.addEventListener('change', (ev) => {
  const checked = Boolean(ev.target.checked);
  document.querySelectorAll('.broadcast-user-checkbox').forEach((b) => {
    b.checked = checked;
    const id = b.getAttribute('data-chat-id');
    if (checked) broadcastSelectedIds.add(id);
    else broadcastSelectedIds.delete(id);
  });
  updateBroadcastChatIdsFromCheckboxes();
});



usersList?.addEventListener('click', async (ev) => {
  const nameBtn = ev.target.closest('.user-name.clickable');
  if (nameBtn) {
    const chatId = nameBtn.getAttribute('data-chat-id');
    const display = nameBtn.textContent || chatId;
    showUserHistory(chatId, display);
    return;
  }

  const replyBtn = ev.target.closest('.user-reply');
  const deleteBtn = ev.target.closest('.user-delete');
  const undoBtn = ev.target.closest('.undo-restore');

  // 'Responder' button — prompt + send (keeps improved timeout/UX)
  if (replyBtn) {
    const chatId = replyBtn.getAttribute('data-chat-id');
    const text = prompt('Mensaje a enviar al usuario:');
    if (!text || !text.trim()) return;

    const originalText = replyBtn.textContent;
    replyBtn.disabled = true;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(`/api/users/${encodeURIComponent(chatId)}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      appendLog(`Mensaje enviado a ${chatId}`, 'success');
      replyBtn.textContent = 'Enviado';
      await loadUsers();
      setTimeout(() => (replyBtn.textContent = originalText), 1400);
    } catch (e) {
      if (e.name === 'AbortError') {
        appendLog(`Envio interrumpido (timeout) a ${chatId}`, 'error');
      } else {
        appendLog(`Error al enviar mensaje a ${chatId}: ${e.message || e}`, 'error');
      }
    } finally {
      clearTimeout(timeoutId);
      replyBtn.disabled = false;
    }
    return;
  }






  if (deleteBtn) {
    const chatId = deleteBtn.getAttribute('data-chat-id');
    if (!chatId) return;

    // optimistic UI: replace card with undo notice and delay actual DELETE
    const card = deleteBtn.closest('.user-card');
    if (!card) return;
    const undoSeconds = 15; // configured by user choice
    const expiresAt = Date.now() + undoSeconds * 1000;

    const undoHtml = `
      <div class="undo-card" data-chat-id="${escapeHtml(chatId)}">
        <div>Usuario eliminado • <span class="undo-countdown">${undoSeconds}</span>s</div>
        <div class="user-actions">
          <button class="undo-restore" type="button" data-chat-id="${escapeHtml(chatId)}">Deshacer</button>
        </div>
      </div>
    `;

    const parent = card.parentElement;
    const placeholder = document.createElement('div');
    placeholder.className = 'user-placeholder';
    placeholder.innerHTML = undoHtml;
    parent.replaceChild(placeholder, card);

    const timerId = setInterval(() => {
      const el = parent.querySelector(`.undo-card[data-chat-id="${chatId}"] .undo-countdown`);
      if (!el) return clearInterval(timerId);
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      el.textContent = String(remaining);
    }, 900);

    const finalizeId = setTimeout(async () => {
      clearInterval(timerId);
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(chatId)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('No se pudo eliminar');
        appendLog(`Usuario ${chatId} eliminado (confirmado)`, 'success');
      } catch (e) {
        appendLog(`Error al eliminar ${chatId}`, 'error');
      } finally {
        pendingDeletes.delete(chatId);
        await loadUsers();
      }
    }, undoSeconds * 1000);

    pendingDeletes.set(chatId, { timerId: finalizeId, intervalId: timerId });
    return;
  }

  if (undoBtn) {
    const chatId = undoBtn.getAttribute('data-chat-id');
    const pending = pendingDeletes.get(chatId);
    if (pending) {
      clearTimeout(pending.timerId);
      clearInterval(pending.intervalId);
      pendingDeletes.delete(chatId);
    }
    appendLog(`Restaurado usuario ${chatId}`, 'info');
    await loadUsers();
    return;
  }
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
  entry.innerHTML = `<strong>[${new Date().toLocaleTimeString()}]</strong> ${escapeHtml(
    message
  )}`;
  logContainer.prepend(entry);
}

function parseChatIds(raw) {
  return String(raw || "")
    .split(/[\s,;]+/g)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => /^-?\d+$/.test(token));
}

function renderBroadcastResult(result) {
  if (!broadcastResultPre) return;
  if (typeof result === "string") {
    broadcastResultPre.textContent = result;
  } else {
    broadcastResultPre.textContent = JSON.stringify(result, null, 2);
  }
  if (broadcastResultWrapper) {
    broadcastResultWrapper.open = true;
  }
}

function updateBroadcastMediaUi() {
  const mediaType = (broadcastMediaTypeInput?.value || "").trim();
  const source = (broadcastMediaSourceInput?.value || "upload").trim();
  const hasMedia = Boolean(mediaType);

  if (broadcastMediaSourceInput) {
    broadcastMediaSourceInput.disabled = !hasMedia;
  }

  const showRef = hasMedia && source === "ref";
  const showFile = hasMedia && source === "upload";
  if (broadcastMediaRefWrap) broadcastMediaRefWrap.style.display = showRef ? "block" : "none";
  if (broadcastMediaFileWrap) broadcastMediaFileWrap.style.display = showFile ? "block" : "none";
}

broadcastMediaTypeInput?.addEventListener("change", updateBroadcastMediaUi);
broadcastMediaSourceInput?.addEventListener("change", updateBroadcastMediaUi);
updateBroadcastMediaUi();

function describeStatus(status) {
  return STATUS_LABELS[status] || status || "Nuevo";
}

function renderDocuments(documents) {
  const sorted = Array.isArray(documents)
    ? [...documents].sort((a, b) => {
        const at = Date.parse(a?.processedAt || a?.createdAt || 0) || 0;
        const bt = Date.parse(b?.processedAt || b?.createdAt || 0) || 0;
        return bt - at;
      })
    : [];

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

  if (!sorted.length) {
    documentsList.innerHTML =
      '<p class="empty-state">No hay documentos cargados. Sube un archivo o pega contenido para que el bot tenga referencias.</p>';
    return;
  }

  sorted.forEach((doc) => {
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

  const progress = createProgressButton(button, "Eliminando…", "Eliminar");
  progress.start();
  const stopSimulated = startSimulatedProgress((p) => progress.set(p));

  try {
    const response = await fetch(`api/documents/${docId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "No se pudo eliminar el documento.");
    }
    const documents = await response.json();
    stopSimulated();
    progress.set(100);
    renderDocuments(documents);
    appendLog("Documento eliminado", "success");
  } catch (error) {
    appendLog("Error al eliminar documento: " + error.message, "error");
  } finally {
    stopSimulated();
    progress.finish();
  }
});

async function loadConfig() {
  try {
    const response = await fetch("api/config");
    const data = await response.json();
    activePromptInput.value = data.context.activePrompt || "";
    additionalNotesInput.value = data.context.additionalNotes || "";
    renderDocuments(data.documents);
    if (Number.isFinite(Number(data?.limits?.documentUploadMaxMB))) {
      const parsed = Number.parseInt(String(data.limits.documentUploadMaxMB), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        documentUploadMaxMB = parsed;
      }
    }
    appendLog("Contexto cargado", "success");
    renderContextPreview(data.context);
  } catch (error) {
    appendLog("No se pudo cargar la configuración: " + error.message, "error");
  }
}

function renderContextPreview(context = {}) {
  const { activePrompt = "", additionalNotes = "" } = context;
  previewPrompt.textContent = activePrompt || "(No definido)";
  previewNotes.textContent = additionalNotes || "(Sin notas adicionales)";
}

async function refreshDocuments() {
  try {
    const response = await fetch("api/documents");
    const documents = await response.json();
    renderDocuments(documents);
  } catch (error) {
    appendLog("No se pudo actualizar los documentos: " + error.message, "error");
  }
}

broadcastForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = (broadcastMessageInput?.value || "").trim();

  const sendToAll = Boolean(broadcastSendToAllInput?.checked);
  const chatIds = sendToAll ? [] : parseChatIds(broadcastChatIdsInput?.value);
  if (!sendToAll && chatIds.length === 0) {
    appendLog("Broadcast: marca 'Enviar a todos' o ingresa chat_id.", "error");
    return;
  }

  const mediaType = (broadcastMediaTypeInput?.value || "").trim();
  const mediaSource = (broadcastMediaSourceInput?.value || "upload").trim();
  const mediaCaption = (broadcastMediaCaptionInput?.value || "").trim();
  const hasMedia = Boolean(mediaType);

  const mediaFile = broadcastMediaFileInput?.files?.[0] || null;
  const mediaRef = (broadcastMediaRefInput?.value || "").trim();

  if (!text && !hasMedia) {
    appendLog("Broadcast: escribe texto y/o selecciona multimedia.", "error");
    return;
  }

  if (hasMedia && mediaSource === "upload" && !mediaFile) {
    appendLog("Broadcast: selecciona un archivo para enviar.", "error");
    return;
  }

  if (hasMedia && mediaSource === "ref" && !mediaRef) {
    appendLog("Broadcast: ingresa una URL https o un file_id.", "error");
    return;
  }

  const headers = {};
  const secret = (broadcastSecretInput?.value || "").trim();
  if (secret) {
    headers["x-broadcast-secret"] = secret;
  }

  const useMultipart = hasMedia && mediaSource === "upload";

  const progress = createProgressButton(broadcastSendBtn, "Enviando…", "Enviar broadcast");
  progress.start();
  appendLog(`Broadcast: enviando${sendToAll ? " a todos" : " a lista"}...`, "info");

  let stopSimulated = null;
  try {
    if (useMultipart) {
      const form = new FormData();
      form.append("sendToAll", String(sendToAll));
      if (!sendToAll) {
        form.append("chatIds", chatIds.join(" "));
      }
      if (text) form.append("text", text);
      if (hasMedia) form.append("mediaType", mediaType);
      if (mediaCaption) form.append("mediaCaption", mediaCaption);
      if (mediaFile) form.append("media", mediaFile);

      const result = await xhrJson({
        url: "send-broadcast",
        method: "POST",
        headers,
        body: form,
        onUploadProgress: (loaded, total) => {
          progress.set((loaded / total) * 100);
        },
      });
      progress.set(100);

      if (!result.ok) {
        const errMsg = result.data?.error || `HTTP ${result.status}`;
        appendLog(`Broadcast: error - ${errMsg}`, "error");
        renderBroadcastResult(result.data || { error: errMsg });
        return;
      }

      const data = result.data;
      appendLog(
        `Broadcast: terminado. Enviados=${data?.sent ?? "?"}, Fallidos=${data?.failed ?? "?"}`,
        "success"
      );
      renderBroadcastResult(data);
      return;
    } else {
      stopSimulated = startSimulatedProgress((p) => progress.set(p));
      const payload = {
        sendToAll,
        ...(sendToAll ? {} : { chatIds }),
        ...(text ? { text } : {}),
        ...(hasMedia
          ? {
              mediaType,
              mediaRef,
              mediaCaption,
            }
          : {}),
      };

      const response = await fetch("send-broadcast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const errMsg = data?.error || `HTTP ${response.status}`;
        appendLog(`Broadcast: error - ${errMsg}`, "error");
        renderBroadcastResult(data || { error: errMsg });
        return;
      }

      appendLog(
        `Broadcast: terminado. Enviados=${data?.sent ?? "?"}, Fallidos=${data?.failed ?? "?"}`,
        "success"
      );
      renderBroadcastResult(data);
      return;
    }
  } catch (error) {
    appendLog("Broadcast: error de red - " + error.message, "error");
    renderBroadcastResult({ error: error.message });
  } finally {
    if (typeof stopSimulated === "function") stopSimulated();
    progress.finish();
  }
});

contextForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    activePrompt: activePromptInput.value,
    additionalNotes: additionalNotesInput.value,
  };

  const submitButton = contextForm.querySelector("button[type=submit]");
  const progress = createProgressButton(submitButton, "Guardando…", "Guardar contexto");
  progress.start();
  const stopSimulated = startSimulatedProgress((p) => progress.set(p));

  try {
    const response = await fetch("api/config/context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    stopSimulated();
    progress.set(100);
    appendLog("Contexto actualizado", "success");
    activePromptInput.value = data.activePrompt || "";
    additionalNotesInput.value = data.additionalNotes || "";
    renderContextPreview(data);
  } catch (error) {
    appendLog("Error al guardar el contexto: " + error.message, "error");
  } finally {
    stopSimulated();
    progress.finish();
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
  const submitButton = docUploadForm.querySelector("button[type=submit]");
  const progress = createProgressButton(submitButton, "Subiendo…", "Subir documento");

  if (!fileInput.files.length) {
    appendLog("Selecciona un archivo para subir.");
    return;
  }

  const file = fileInput.files[0];
  const maxBytes = documentUploadMaxMB * 1024 * 1024;
  if (Number.isFinite(maxBytes) && maxBytes > 0 && file?.size && file.size > maxBytes) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    appendLog(
      `El archivo pesa ${sizeMb} MB y supera el máximo permitido (${documentUploadMaxMB} MB).`,
      "error"
    );
    return;
  }

  progress.start();
  fileInput.disabled = true;
  appendLog("Subiendo documento…", "info");

  formData.append("document", file);
  formData.append("summary", document.getElementById("docSummary").value);

  try {
    const result = await xhrJson({
      url: "api/documents",
      method: "POST",
      body: formData,
      onUploadProgress: (loaded, total) => {
        progress.set((loaded / total) * 100);
      },
    });
    progress.set(100);

    if (!result.ok) {
      const errMsg =
        result.data?.error ||
        (result.status === 413
          ? "Payload demasiado grande (HTTP 413). Puede ser el límite del backend o de un proxy/reverse-proxy delante del servidor."
          : `HTTP ${result.status}`);
      throw new Error(errMsg);
    }

    const documents = result.data;
    renderDocuments(documents);
    appendLog("Documento subido", "success");
    docUploadForm.reset();
  } catch (error) {
    appendLog("Error al subir documento: " + error.message, "error");
  } finally {
    fileInput.disabled = false;
    progress.finish();
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
  const progress = createProgressButton(submitButton, "Descargando…", "Descargar y procesar");
  progress.start();
  const stopSimulated = startSimulatedProgress((p) => progress.set(p));
  appendLog("Descargando y procesando el PDF...", "info");

  const payload = {
    url,
    summary: docUrlSummaryInput.value.trim(),
  };

  try {
    const response = await fetch("api/documents/url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const documents = await response.json();
    stopSimulated();
    progress.set(100);
    renderDocuments(documents);
    appendLog("Documento descargado y procesado", "success");
    docUrlForm.reset();
  } catch (error) {
    appendLog("Error al descargar el documento: " + error.message, "error");
  } finally {
    stopSimulated();
    progress.finish();
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
  const progress = createProgressButton(submitButton, "Extrayendo…", "Extraer y procesar");
  progress.start();
  const stopSimulated = startSimulatedProgress((p) => progress.set(p));
  appendLog("Extrayendo información de la página web...", "info");

  const payload = {
    url,
    summary: webUrlSummaryInput.value.trim(),
    depth: Number.parseInt(webDepthInput?.value || "1", 10),
    maxPages: Number.parseInt(webMaxPagesInput?.value || "10", 10),
  };

  try {
    const response = await fetch("api/documents/web", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "No se pudo extraer la página.");
    }
    const documents = await response.json();
    stopSimulated();
    progress.set(100);
    renderDocuments(documents);
    appendLog("Página web extraída y guardada", "success");
    docWebForm.reset();
  } catch (error) {
    appendLog("Error al extraer página: " + error.message, "error");
  } finally {
    stopSimulated();
    progress.finish();
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
  const progress = createProgressButton(submitButton, "Guardando…", "Guardar HTML");
  progress.start();
  const stopSimulated = startSimulatedProgress((p) => progress.set(p));

  const payload = {
    title: htmlTitleInput.value.trim(),
    summary: htmlSummaryInput.value.trim(),
    html,
  };

  try {
    const response = await fetch("api/documents/html", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "No se pudo guardar el HTML.");
    }
    const documents = await response.json();
    stopSimulated();
    progress.set(100);
    renderDocuments(documents);
    appendLog("HTML guardado y procesado", "success");
    docHtmlForm.reset();
  } catch (error) {
    appendLog("Error al guardar HTML: " + error.message, "error");
  } finally {
    stopSimulated();
    progress.finish();
  }
});

docTextForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = textContentInput.value.trim();
  if (!text) {
    appendLog("Pega el texto antes de guardar.", "error");
    return;
  }

  const submitButton = docTextForm.querySelector("button[type=submit]");
  const progress = createProgressButton(submitButton, "Guardando…", "Guardar texto");
  progress.start();
  const stopSimulated = startSimulatedProgress((p) => progress.set(p));

  const html = `<pre>${escapeHtml(text)}</pre>`;
  const payload = {
    title: textTitleInput.value.trim() || "Texto plano",
    summary: textSummaryInput.value.trim(),
    html,
  };

  try {
    const response = await fetch("api/documents/html", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "No se pudo guardar el texto.");
    }
    const documents = await response.json();
    stopSimulated();
    progress.set(100);
    renderDocuments(documents);
    appendLog("Texto guardado y procesado", "success");
    docTextForm.reset();
  } catch (error) {
    appendLog("Error al guardar texto: " + error.message, "error");
  } finally {
    stopSimulated();
    progress.finish();
  }
});

loadConfig();
refreshDocuments();
setInterval(refreshDocuments, DOCUMENT_POLL_INTERVAL);