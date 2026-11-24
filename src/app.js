(() => {
  const uid = () =>
    `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

  const todayISO = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const formatDateFR = (iso) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  };

  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const state = {
    store: { drafts: [], history: [] },
    currentId: null,
    tasks: [],
    viewingHistory: false
  };

  const els = {
    views: {
      editor: document.getElementById('view-editor'),
      drafts: document.getElementById('view-drafts'),
      history: document.getElementById('view-history')
    },
    navBtns: document.querySelectorAll('.nav-btn'),
    editorTitle: document.getElementById('editor-title'),
    version: document.getElementById('field-version'),
    owner: document.getElementById('field-owner'),
    pcName: document.getElementById('field-pc-name'),
    startDate: document.getElementById('field-start-date'),
    endDate: document.getElementById('field-end-date'),
    newTaskInput: document.getElementById('new-task-input'),
    tasksList: document.getElementById('tasks-list'),
    tasksEmpty: document.getElementById('tasks-empty'),
    tasksProgress: document.getElementById('tasks-progress'),
    draftsList: document.getElementById('drafts-list'),
    draftsEmpty: document.getElementById('drafts-empty'),
    draftsCount: document.getElementById('drafts-count'),
    historyList: document.getElementById('history-list'),
    historyEmpty: document.getElementById('history-empty'),
    historyCount: document.getElementById('history-count'),
    historySearch: document.getElementById('history-search'),
    modal: document.getElementById('modal-finalize'),
    toast: document.getElementById('toast'),
    btnNew: document.getElementById('btn-new'),
    btnSaveDraft: document.getElementById('btn-save-draft'),
    btnPrint: document.getElementById('btn-print'),
    btnExportPdf: document.getElementById('btn-export-pdf'),
    btnFinalize: document.getElementById('btn-finalize'),
    btnAddTask: document.getElementById('btn-add-task'),
    btnConfirmFinalize: document.getElementById('btn-confirm-finalize')
  };

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => els.toast.classList.add('hidden'), 3200);
  }

  function showView(name) {
    Object.entries(els.views).forEach(([key, el]) => {
      el.classList.toggle('active', key === name);
    });
    els.navBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === name);
    });
  }

  function collectForm() {
    return {
      version: els.version.value.trim(),
      owner: els.owner.value.trim(),
      pcName: els.pcName.value.trim(),
      startDate: els.startDate.value,
      tasks: state.tasks.map((t) => ({ ...t }))
    };
  }

  function fillForm(fiche) {
    els.version.value = fiche.version || '';
    els.owner.value = fiche.owner || '';
    els.pcName.value = fiche.pcName || '';
    els.startDate.value = fiche.startDate || todayISO();
    state.tasks = (fiche.tasks || []).map((t) => ({ ...t }));
    renderTasks();
  }

  function resetEditor() {
    state.currentId = null;
    state.viewingHistory = false;
    state.tasks = [];
    fillForm({
      version: '',
      owner: '',
      pcName: '',
      startDate: todayISO(),
      tasks: []
    });
    els.editorTitle.textContent = 'Nouvelle fiche Todo PC';
    setEditorReadonly(false);
  }

  function setEditorReadonly(readonly) {
    [els.version, els.owner, els.pcName, els.startDate, els.newTaskInput].forEach(
      (el) => {
        el.disabled = readonly;
      }
    );
    els.btnAddTask.disabled = readonly;
    els.btnSaveDraft.classList.toggle('hidden', readonly);
    els.btnFinalize.classList.toggle('hidden', readonly);
    els.btnNew.classList.toggle('hidden', false);
  }

  function validateMeta(data) {
    if (!data.version || !data.owner || !data.pcName || !data.startDate) {
      toast('Veuillez renseigner version, propriétaire, nom du PC et date de début.');
      return false;
    }
    if (!data.tasks.length) {
      toast('Ajoutez au moins une tâche avant de continuer.');
      return false;
    }
    return true;
  }

  async function persist() {
    await window.pcheck.saveStore(state.store);
    updateCounts();
    renderDrafts();
    renderHistory();
  }

  function updateCounts() {
    els.draftsCount.textContent = String(state.store.drafts.length);
    els.historyCount.textContent = String(state.store.history.length);
  }

  function renderTasks() {
    els.tasksList.innerHTML = '';
    const done = state.tasks.filter((t) => t.done).length;
    els.tasksProgress.textContent = `${done} / ${state.tasks.length}`;
    els.tasksEmpty.classList.toggle('hidden', state.tasks.length > 0);

    state.tasks.forEach((task) => {
      const li = document.createElement('li');
      li.className = `task-item${task.done ? ' done' : ''}`;
      li.dataset.id = task.id;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !!task.done;
      checkbox.disabled = state.viewingHistory;
      checkbox.addEventListener('change', () => {
        task.done = checkbox.checked;
        renderTasks();
      });

      const label = document.createElement('span');
      label.className = 'task-label';
      label.textContent = task.text;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn ghost small';
      removeBtn.textContent = 'Supprimer';
      removeBtn.disabled = state.viewingHistory;
      removeBtn.addEventListener('click', () => {
        state.tasks = state.tasks.filter((t) => t.id !== task.id);
        renderTasks();
      });

      li.append(checkbox, label, removeBtn);
      els.tasksList.appendChild(li);
    });
  }

  function addTask() {
    if (state.viewingHistory) return;
    const text = els.newTaskInput.value.trim();
    if (!text) {
      toast('Saisissez le libellé de la tâche.');
      return;
    }
    state.tasks.push({ id: uid(), text, done: false });
    els.newTaskInput.value = '';
    els.newTaskInput.focus();
    renderTasks();
  }

  function saveDraft() {
    const data = collectForm();
    if (!validateMeta(data)) return;

    const now = new Date().toISOString();
    if (state.currentId) {
      const idx = state.store.drafts.findIndex((d) => d.id === state.currentId);
      if (idx >= 0) {
        state.store.drafts[idx] = {
          ...state.store.drafts[idx],
          ...data,
          updatedAt: now
        };
      } else {
        state.currentId = uid();
        state.store.drafts.unshift({
          id: state.currentId,
          ...data,
          createdAt: now,
          updatedAt: now
        });
      }
    } else {
      state.currentId = uid();
      state.store.drafts.unshift({
        id: state.currentId,
        ...data,
        createdAt: now,
        updatedAt: now
      });
    }

    els.editorTitle.textContent = `Brouillon — ${data.pcName}`;
    persist().then(() => toast('Brouillon enregistré.'));
  }

  function openDraft(id) {
    const draft = state.store.drafts.find((d) => d.id === id);
    if (!draft) return;
    state.currentId = draft.id;
    state.viewingHistory = false;
    fillForm(draft);
    setEditorReadonly(false);
    els.editorTitle.textContent = `Brouillon — ${draft.pcName}`;
    showView('editor');
  }

  function openHistoryItem(id) {
    const item = state.store.history.find((h) => h.id === id);
    if (!item) return;
    state.currentId = item.id;
    state.viewingHistory = true;
    fillForm(item);
    setEditorReadonly(true);
    els.editorTitle.textContent = `Historique — ${item.pcName} (terminé le ${formatDateFR(item.endDate)})`;
    showView('editor');
  }

  function deleteDraft(id) {
    state.store.drafts = state.store.drafts.filter((d) => d.id !== id);
    if (state.currentId === id) resetEditor();
    persist().then(() => toast('Brouillon supprimé.'));
  }

  function deleteHistory(id) {
    state.store.history = state.store.history.filter((h) => h.id !== id);
    if (state.currentId === id && state.viewingHistory) resetEditor();
    persist().then(() => toast('Fiche retirée de l’historique.'));
  }

  function openFinalizeModal() {
    const data = collectForm();
    if (!validateMeta(data)) return;
    els.endDate.value = todayISO();
    els.modal.classList.remove('hidden');
  }

  function closeFinalizeModal() {
    els.modal.classList.add('hidden');
  }

  async function confirmFinalize() {
    const data = collectForm();
    if (!validateMeta(data)) return;

    const endDate = els.endDate.value;
    if (!endDate) {
      toast('Indiquez la date de fin de préparation.');
      return;
    }
    if (data.startDate && endDate < data.startDate) {
      toast('La date de fin ne peut pas être antérieure à la date de début.');
      return;
    }

    const now = new Date().toISOString();
    const finalized = {
      id: state.currentId || uid(),
      ...data,
      endDate,
      finalizedAt: now,
      createdAt: now,
      updatedAt: now
    };

    state.store.history.unshift(finalized);
    if (state.currentId) {
      state.store.drafts = state.store.drafts.filter((d) => d.id !== state.currentId);
    }

    await persist();
    closeFinalizeModal();
    resetEditor();
    showView('history');
    toast('Fiche finalisée et ajoutée à l’historique.');
  }

  function renderDrafts() {
    els.draftsList.innerHTML = '';
    const drafts = state.store.drafts;
    els.draftsEmpty.classList.toggle('hidden', drafts.length > 0);

    drafts.forEach((draft) => {
      const done = (draft.tasks || []).filter((t) => t.done).length;
      const total = (draft.tasks || []).length;
      const card = document.createElement('article');
      card.className = 'record-card';
      card.innerHTML = `
        <div>
          <h3 class="record-title">${escapeHtml(draft.pcName)}</h3>
          <p class="record-meta">
            Version ${escapeHtml(draft.version)} · ${escapeHtml(draft.owner)}<br />
            Début : ${formatDateFR(draft.startDate)}
          </p>
          <span class="progress-pill">${done} / ${total} tâches</span>
        </div>
        <div class="record-actions"></div>
      `;

      const actions = card.querySelector('.record-actions');
      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'btn secondary small';
      openBtn.textContent = 'Ouvrir';
      openBtn.addEventListener('click', () => openDraft(draft.id));

      const pdfBtn = document.createElement('button');
      pdfBtn.type = 'button';
      pdfBtn.className = 'btn ghost small';
      pdfBtn.textContent = 'PDF';
      pdfBtn.addEventListener('click', () => exportPdf(draft));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn danger small';
      delBtn.textContent = 'Supprimer';
      delBtn.addEventListener('click', () => {
        if (confirm(`Supprimer le brouillon « ${draft.pcName} » ?`)) {
          deleteDraft(draft.id);
        }
      });

      actions.append(openBtn, pdfBtn, delBtn);
      els.draftsList.appendChild(card);
    });
  }

  function renderHistory() {
    const query = (els.historySearch.value || '').trim().toLowerCase();
    const items = state.store.history.filter((item) => {
      if (!query) return true;
      const hay = `${item.pcName} ${item.owner} ${item.version}`.toLowerCase();
      return hay.includes(query);
    });

    els.historyList.innerHTML = '';
    els.historyEmpty.classList.toggle('hidden', items.length > 0);
    if (!items.length && state.store.history.length === 0) {
      els.historyEmpty.textContent = 'Aucune fiche finalisée pour le moment.';
    } else if (!items.length) {
      els.historyEmpty.textContent = 'Aucun résultat pour cette recherche.';
      els.historyEmpty.classList.remove('hidden');
    }

    items.forEach((item) => {
      const done = (item.tasks || []).filter((t) => t.done).length;
      const total = (item.tasks || []).length;
      const card = document.createElement('article');
      card.className = 'record-card';
      card.innerHTML = `
        <div>
          <h3 class="record-title">${escapeHtml(item.pcName)}</h3>
          <p class="record-meta">
            Version ${escapeHtml(item.version)} · ${escapeHtml(item.owner)}<br />
            Début : ${formatDateFR(item.startDate)} · Fin : ${formatDateFR(item.endDate)}
          </p>
          <span class="progress-pill">${done} / ${total} tâches</span>
        </div>
        <div class="record-actions"></div>
      `;

      const actions = card.querySelector('.record-actions');

      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'btn secondary small';
      openBtn.textContent = 'Voir';
      openBtn.addEventListener('click', () => openHistoryItem(item.id));

      const pdfBtn = document.createElement('button');
      pdfBtn.type = 'button';
      pdfBtn.className = 'btn ghost small';
      pdfBtn.textContent = 'PDF';
      pdfBtn.addEventListener('click', () => exportPdf(item));

      const printBtn = document.createElement('button');
      printBtn.type = 'button';
      printBtn.className = 'btn ghost small';
      printBtn.textContent = 'Imprimer';
      printBtn.addEventListener('click', () => printFiche(item));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn danger small';
      delBtn.textContent = 'Supprimer';
      delBtn.addEventListener('click', () => {
        if (confirm(`Retirer « ${item.pcName} » de l’historique ?`)) {
          deleteHistory(item.id);
        }
      });

      actions.append(openBtn, pdfBtn, printBtn, delBtn);
      els.historyList.appendChild(card);
    });
  }

  function buildPdfHtml(fiche) {
    const tasks = fiche.tasks || [];
    const done = tasks.filter((t) => t.done).length;
    const taskRows = tasks
      .map(
        (t) => `
        <tr>
          <td class="check">${t.done ? '☑' : '☐'}</td>
          <td class="${t.done ? 'done' : ''}">${escapeHtml(t.text)}</td>
        </tr>`
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Fiche Todo PC — ${escapeHtml(fiche.pcName)}</title>
  <style>
    @page { margin: 18mm; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      color: #15202b;
      margin: 0;
      font-size: 12pt;
    }
    .header {
      border-bottom: 3px solid #1f9a85;
      padding-bottom: 12px;
      margin-bottom: 22px;
    }
    .brand {
      font-size: 11pt;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #1f9a85;
      font-weight: 700;
      margin: 0 0 4px;
    }
    h1 {
      margin: 0;
      font-size: 20pt;
    }
    .meta {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 22px;
    }
    .meta th, .meta td {
      text-align: left;
      padding: 8px 10px;
      border: 1px solid #d5dde7;
      vertical-align: top;
    }
    .meta th {
      width: 34%;
      background: #f3f7fa;
      font-weight: 600;
      color: #445566;
    }
    h2 {
      font-size: 13pt;
      margin: 0 0 10px;
    }
    .progress {
      color: #445566;
      margin: 0 0 12px;
      font-size: 10.5pt;
    }
    table.tasks {
      width: 100%;
      border-collapse: collapse;
    }
    table.tasks td {
      border: 1px solid #d5dde7;
      padding: 9px 10px;
    }
    table.tasks td.check {
      width: 36px;
      text-align: center;
      font-size: 14pt;
    }
    table.tasks td.done {
      text-decoration: line-through;
      color: #708090;
    }
    .footer {
      margin-top: 28px;
      padding-top: 10px;
      border-top: 1px solid #d5dde7;
      font-size: 9.5pt;
      color: #708090;
    }
  </style>
</head>
<body>
  <div class="header">
    <p class="brand">AUBM PCheck</p>
    <h1>Fiche Todo PC</h1>
  </div>
  <table class="meta">
    <tr><th>Version du Todo PC</th><td>${escapeHtml(fiche.version)}</td></tr>
    <tr><th>Propriétaire du PC</th><td>${escapeHtml(fiche.owner)}</td></tr>
    <tr><th>Nom complet du PC</th><td>${escapeHtml(fiche.pcName)}</td></tr>
    <tr><th>Date de début de préparation</th><td>${formatDateFR(fiche.startDate)}</td></tr>
    <tr><th>Date de fin de préparation</th><td>${fiche.endDate ? formatDateFR(fiche.endDate) : 'En cours'}</td></tr>
  </table>
  <h2>Checklist des tâches</h2>
  <p class="progress">${done} / ${tasks.length} tâches cochées</p>
  <table class="tasks">
    <tbody>
      ${taskRows || '<tr><td colspan="2">Aucune tâche</td></tr>'}
    </tbody>
  </table>
  <div class="footer">Généré par AUBM PCheck — ${escapeHtml(new Date().toLocaleString('fr-FR'))}</div>
</body>
</html>`;
  }

  function safeFileName(fiche) {
    const base = `TodoPC_${fiche.pcName || 'fiche'}_${fiche.version || 'v'}`
      .replace(/[^\w\-]+/g, '_')
      .replace(/_+/g, '_');
    return `${base}.pdf`;
  }

  async function exportPdf(ficheOverride) {
    const fiche = ficheOverride || collectForm();
    if (!ficheOverride && !validateMeta(fiche)) return;

    if (!window.pcheck?.exportPdf) {
      toast('Export PDF disponible dans l’application desktop Electron.');
      return;
    }

    const result = await window.pcheck.exportPdf({
      html: buildPdfHtml(fiche),
      defaultName: safeFileName(fiche)
    });

    if (result?.canceled) return;
    if (result?.ok) {
      toast('PDF exporté avec succès.');
      if (result.filePath) {
        window.pcheck.openPath(result.filePath);
      }
    } else {
      toast(`Échec de l’export PDF : ${result?.error || 'erreur inconnue'}`);
    }
  }

  async function printFiche(ficheOverride) {
    const fiche = ficheOverride || collectForm();
    if (!ficheOverride && !validateMeta(fiche)) return;

    if (!window.pcheck?.printFiche) {
      toast('Impression disponible dans l’application desktop Electron.');
      return;
    }

    const result = await window.pcheck.printFiche({
      html: buildPdfHtml(fiche)
    });

    if (result?.ok) {
      toast('Dialogue d’impression ouvert.');
    } else if (result?.error) {
      toast(`Impression : ${result.error}`);
    }
  }

  function bindEvents() {
    els.navBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view === 'editor' && state.viewingHistory) {
          // keep current history view content unless starting new
        }
        showView(view);
        if (view === 'drafts') renderDrafts();
        if (view === 'history') renderHistory();
      });
    });

    els.btnAddTask.addEventListener('click', addTask);
    els.newTaskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTask();
      }
    });

    els.btnNew.addEventListener('click', () => {
      resetEditor();
      showView('editor');
    });
    els.btnSaveDraft.addEventListener('click', saveDraft);
    els.btnExportPdf.addEventListener('click', () => exportPdf());
    els.btnPrint.addEventListener('click', () => printFiche());
    els.btnFinalize.addEventListener('click', openFinalizeModal);
    els.btnConfirmFinalize.addEventListener('click', confirmFinalize);

    document.querySelectorAll('[data-close-modal]').forEach((el) => {
      el.addEventListener('click', closeFinalizeModal);
    });

    els.historySearch.addEventListener('input', renderHistory);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.modal.classList.contains('hidden')) {
        closeFinalizeModal();
      }
    });
  }

  function ensureApi() {
    if (window.pcheck) return;
    const KEY = 'aubm-pcheck-store';
    window.pcheck = {
      loadStore: async () => {
        try {
          return JSON.parse(localStorage.getItem(KEY) || '{"drafts":[],"history":[]}');
        } catch {
          return { drafts: [], history: [] };
        }
      },
      saveStore: async (store) => {
        localStorage.setItem(KEY, JSON.stringify(store));
        return true;
      },
      exportPdf: async () => ({
        ok: false,
        error: 'Disponible uniquement dans l’application Windows (Electron).'
      }),
      printFiche: async () => {
        window.print();
        return { ok: true };
      },
      openPath: async () => {}
    };
  }

  async function init() {
    ensureApi();
    bindEvents();
    resetEditor();

    try {
      const store = await window.pcheck.loadStore();
      state.store = {
        drafts: Array.isArray(store?.drafts) ? store.drafts : [],
        history: Array.isArray(store?.history) ? store.history : []
      };
    } catch {
      state.store = { drafts: [], history: [] };
    }

    updateCounts();
    renderDrafts();
    renderHistory();
  }

  init();
})();
