"use client";

import {
  DragEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { downloadPdf, printPdf } from "@/lib/pdf";
import type { PcTodoFiche, TaskItem } from "@/lib/types";

type View = "editor" | "drafts" | "history";

type EditorTask = TaskItem;

const emptyTasks: EditorTask[] = [];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function uid() {
  return crypto.randomUUID();
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

export default function AppShell() {
  const [view, setView] = useState<View>("editor");
  const [drafts, setDrafts] = useState<PcTodoFiche[]>([]);
  const [history, setHistory] = useState<PcTodoFiche[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [finalizeOpen, setFinalizeOpen] = useState(false);

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [editorTitle, setEditorTitle] = useState("Nouvelle fiche Todo PC");
  const [version, setVersion] = useState("");
  const [owner, setOwner] = useState("");
  const [pcName, setPcName] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [newTask, setNewTask] = useState("");
  const [pasteBlock, setPasteBlock] = useState("");
  const [tasks, setTasks] = useState<EditorTask[]>(emptyTasks);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  const toast = useCallback((message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(""), 3500);
  }, []);

  const refresh = useCallback(async () => {
    const [d, h] = await Promise.all([
      fetch("/api/fiches?status=draft").then((r) => r.json()),
      fetch("/api/fiches?status=finalized").then((r) => r.json()),
    ]);
    setDrafts(d);
    setHistory(h);
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return history;
    return history.filter((f) =>
      `${f.pcName} ${f.owner} ${f.version}`.toLowerCase().includes(q),
    );
  }, [history, historySearch]);

  function resetEditor() {
    setCurrentId(null);
    setIsReadOnly(false);
    setEditorTitle("Nouvelle fiche Todo PC");
    setVersion("");
    setOwner("");
    setPcName("");
    setStartDate(todayISO());
    setEndDate(todayISO());
    setNewTask("");
    setPasteBlock("");
    setTasks([]);
    setEditingTaskId(null);
    setEditingText("");
    setDragTaskId(null);
    setDragOverTaskId(null);
    setView("editor");
  }

  function fillEditor(fiche: PcTodoFiche, readOnly: boolean) {
    setCurrentId(fiche.id);
    setIsReadOnly(readOnly);
    setVersion(fiche.version);
    setOwner(fiche.owner);
    setPcName(fiche.pcName);
    setStartDate(fiche.startDate || todayISO());
    setEndDate(fiche.endDate || todayISO());
    setTasks(fiche.tasks.map((t) => ({ ...t })));
    setEditingTaskId(null);
    setEditingText("");
    setView("editor");
  }

  function collect(status: "draft" | "finalized") {
    return {
      id: currentId || undefined,
      version: version.trim(),
      owner: owner.trim(),
      pcName: pcName.trim(),
      startDate,
      endDate: status === "finalized" ? endDate : null,
      status,
      finalizedAt: status === "finalized" ? new Date().toISOString() : null,
      tasks: tasks.map((t, index) => ({
        id: t.id,
        text: t.text,
        done: t.done,
        sortOrder: index,
      })),
    };
  }

  function validate() {
    if (!version.trim() || !owner.trim() || !pcName.trim() || !startDate) {
      toast("Renseignez version, propriétaire, nom du PC et date de début.");
      return false;
    }
    if (!tasks.length) {
      toast("Ajoutez au moins une tâche.");
      return false;
    }
    return true;
  }

  function parseTaskLines(raw: string): string[] {
    return raw
      .split(/\r?\n|;/)
      .map((line) =>
        line
          .replace(/^\s*([-*•]+|\d+[.)])\s*/u, "")
          .replace(/^\s*\[\s*[xX ]?\s*\]\s*/u, "")
          .trim(),
      )
      .filter((line) => line.length > 0);
  }

  function addTask(e?: FormEvent) {
    e?.preventDefault();
    if (isReadOnly) return;
    const text = newTask.trim();
    if (!text) {
      toast("Saisissez le libellé de la tâche.");
      return;
    }
    setTasks((prev) => [
      ...prev,
      { id: uid(), text, done: false, sortOrder: prev.length },
    ]);
    setNewTask("");
  }

  function importFromPaste(mode: "append" | "replace") {
    if (isReadOnly) return;
    const lines = parseTaskLines(pasteBlock);
    if (!lines.length) {
      toast("Collez une liste de tâches (une par ligne).");
      return;
    }

    const incoming = lines.map((text, index) => ({
      id: uid(),
      text,
      done: false,
      sortOrder: index,
    }));

    if (mode === "replace") {
      setTasks(incoming);
      toast(`${incoming.length} tâche(s) importée(s) (liste remplacée).`);
    } else {
      setTasks((prev) => {
        const existing = new Set(prev.map((t) => t.text.toLowerCase()));
        const unique = incoming.filter(
          (t) => !existing.has(t.text.toLowerCase()),
        );
        toast(
          unique.length
            ? `${unique.length} tâche(s) ajoutée(s)${
                unique.length < incoming.length
                  ? ` (${incoming.length - unique.length} doublon(s) ignoré(s))`
                  : ""
              }.`
            : "Aucune nouvelle tâche (doublons uniquement).",
        );
        return [
          ...prev,
          ...unique.map((t, i) => ({
            ...t,
            sortOrder: prev.length + i,
          })),
        ];
      });
    }
    setPasteBlock("");
  }

  function startEditTask(task: EditorTask) {
    if (isReadOnly) return;
    setEditingTaskId(task.id);
    setEditingText(task.text);
  }

  function cancelEditTask() {
    setEditingTaskId(null);
    setEditingText("");
  }

  function saveEditTask() {
    if (isReadOnly || !editingTaskId) return;
    const text = editingText.trim();
    if (!text) {
      toast("Le libellé de la tâche ne peut pas être vide.");
      return;
    }
    setTasks((prev) =>
      prev.map((t) => (t.id === editingTaskId ? { ...t, text } : t)),
    );
    cancelEditTask();
    toast("Tâche modifiée.");
  }

  function deleteTask(id: string) {
    if (isReadOnly) return;
    setTasks((prev) =>
      prev
        .filter((t) => t.id !== id)
        .map((t, index) => ({ ...t, sortOrder: index })),
    );
    if (editingTaskId === id) cancelEditTask();
  }

  function clearAllTasks() {
    if (isReadOnly || !tasks.length) return;
    if (!window.confirm("Supprimer toute la liste des tâches ?")) return;
    setTasks([]);
    cancelEditTask();
    toast("Liste des tâches vidée.");
  }

  function moveTask(fromIndex: number, toIndex: number) {
    if (isReadOnly) return;
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= tasks.length ||
      toIndex >= tasks.length ||
      fromIndex === toIndex
    ) {
      return;
    }
    setTasks((prev) => {
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next.map((t, index) => ({ ...t, sortOrder: index }));
    });
  }

  function onTaskDragStart(taskId: string) {
    if (isReadOnly) return;
    setDragTaskId(taskId);
  }

  function onTaskDragOver(e: DragEvent, taskId: string) {
    if (isReadOnly || !dragTaskId || dragTaskId === taskId) return;
    e.preventDefault();
    setDragOverTaskId(taskId);
  }

  function onTaskDrop(targetId: string) {
    if (isReadOnly || !dragTaskId || dragTaskId === targetId) {
      setDragTaskId(null);
      setDragOverTaskId(null);
      return;
    }
    const fromIndex = tasks.findIndex((t) => t.id === dragTaskId);
    const toIndex = tasks.findIndex((t) => t.id === targetId);
    moveTask(fromIndex, toIndex);
    setDragTaskId(null);
    setDragOverTaskId(null);
  }

  function onTaskDragEnd() {
    setDragTaskId(null);
    setDragOverTaskId(null);
  }

  async function saveDraft() {
    if (isReadOnly || !validate()) return;
    const res = await fetch("/api/fiches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(collect("draft")),
    });
    const fiche = (await res.json()) as PcTodoFiche;
    if (!res.ok) {
      toast((fiche as unknown as { error?: string }).error || "Erreur");
      return;
    }
    setCurrentId(fiche.id);
    setEditorTitle(`Brouillon — ${fiche.pcName}`);
    await refresh();
    toast("Brouillon enregistré.");
  }

  async function confirmFinalize() {
    if (!validate()) return;
    if (!endDate) {
      toast("Indiquez la date de fin de préparation.");
      return;
    }
    if (startDate && endDate < startDate) {
      toast("La date de fin ne peut pas être antérieure à la date de début.");
      return;
    }
    const res = await fetch("/api/fiches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(collect("finalized")),
    });
    if (!res.ok) {
      const err = await res.json();
      toast(err.error || "Erreur");
      return;
    }
    setFinalizeOpen(false);
    await refresh();
    resetEditor();
    setView("history");
    toast("Fiche finalisée et ajoutée à l’historique.");
  }

  async function removeFiche(id: string, kind: "draft" | "history") {
    const ok = window.confirm(
      kind === "draft"
        ? "Supprimer ce brouillon ?"
        : "Retirer cette fiche de l’historique ?",
    );
    if (!ok) return;
    await fetch(`/api/fiches/${id}`, { method: "DELETE" });
    if (currentId === id) resetEditor();
    await refresh();
    toast(kind === "draft" ? "Brouillon supprimé." : "Fiche retirée.");
  }

  function currentAsFiche(): PcTodoFiche {
    return {
      id: currentId || uid(),
      version: version.trim(),
      owner: owner.trim(),
      pcName: pcName.trim(),
      startDate,
      endDate: null,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      finalizedAt: null,
      tasks,
    };
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-[var(--muted)]">
        Chargement…
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[268px_1fr]">
      <aside className="bg-[var(--sidebar)] px-5 py-7 text-white">
        <div className="mb-9 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-teal-400 to-teal-700 text-sm font-bold">
            PC
          </div>
          <div>
            <div className="text-lg font-bold">AUBM PCheck</div>
            <div className="text-xs text-slate-300">Préparation PC</div>
          </div>
        </div>

        <nav className="space-y-2">
          {(
            [
              ["editor", "Nouvelle fiche", null],
              ["drafts", "Brouillons", drafts.length],
              ["history", "Historique", history.length],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition ${
                view === key
                  ? "bg-teal-400/20 text-white"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span>{label}</span>
              {count !== null && (
                <span className="min-w-6 rounded-full bg-white/10 px-2 py-0.5 text-center text-xs">
                  {count}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-8 rounded-xl bg-white/10 p-3.5 text-xs leading-relaxed text-slate-300 lg:mt-auto">
          Préparez · cochez · finalisez
          <br />
          Puis exportez en PDF ou imprimez.
        </div>
      </aside>

      <main className="px-5 py-6 sm:px-8">
        {view === "editor" && (
          <section className="mx-auto max-w-5xl space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-5">
              <div>
                <h1 className="text-3xl font-bold text-[var(--text)]">
                  {editorTitle}
                </h1>
                <p className="mt-2 text-[var(--muted)]">
                  Renseignez le PC, ajoutez les tâches, puis cochez-les au fur et
                  à mesure.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Btn ghost onClick={resetEditor}>
                  Nouvelle
                </Btn>
                {!isReadOnly && (
                  <Btn onClick={saveDraft}>Enregistrer brouillon</Btn>
                )}
                <Btn
                  onClick={() => {
                    if (!validate()) return;
                    printPdf(currentAsFiche());
                  }}
                >
                  Imprimer
                </Btn>
                <Btn
                  onClick={() => {
                    if (!validate()) return;
                    downloadPdf(currentAsFiche());
                  }}
                >
                  Exporter PDF
                </Btn>
                {!isReadOnly && (
                  <Btn
                    primary
                    onClick={() => {
                      if (!validate()) return;
                      setEndDate(todayISO());
                      setFinalizeOpen(true);
                    }}
                  >
                    Finaliser
                  </Btn>
                )}
              </div>
            </div>

            <Card>
              <SectionTitle>Informations du PC</SectionTitle>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Version du Todo PC">
                  <input
                    value={version}
                    disabled={isReadOnly}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="ex. v2.1"
                    className="field"
                  />
                </Field>
                <Field label="Propriétaire du PC">
                  <input
                    value={owner}
                    disabled={isReadOnly}
                    onChange={(e) => setOwner(e.target.value)}
                    placeholder="Nom du propriétaire"
                    className="field"
                  />
                </Field>
                <Field label="Nom complet du PC">
                  <input
                    value={pcName}
                    disabled={isReadOnly}
                    onChange={(e) => setPcName(e.target.value)}
                    placeholder="ex. LAPTOP-DUPONT-01"
                    className="field"
                  />
                </Field>
                <Field label="Date de début de préparation">
                  <input
                    type="date"
                    value={startDate}
                    disabled={isReadOnly}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="field"
                  />
                </Field>
              </div>
            </Card>

            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTitle>Tâches à faire</SectionTitle>
                <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                  {tasks.filter((t) => t.done).length} / {tasks.length} cochées
                </span>
              </div>

              <div className="mt-4 space-y-2">
                <label className="block text-xs font-semibold text-[var(--muted)]">
                  Coller une liste (une tâche par ligne)
                </label>
                <textarea
                  value={pasteBlock}
                  disabled={isReadOnly}
                  onChange={(e) => setPasteBlock(e.target.value)}
                  rows={5}
                  placeholder={
                    "Exemple :\nInstaller Windows 11\nConfigurer le réseau\nInstaller Office\n- Créer le compte utilisateur"
                  }
                  className="field min-h-28 resize-y"
                />
                <div className="flex flex-wrap gap-2">
                  <Btn
                    primary
                    disabled={isReadOnly}
                    onClick={() => importFromPaste("append")}
                  >
                    Importer (ajouter)
                  </Btn>
                  <Btn
                    disabled={isReadOnly}
                    onClick={() => importFromPaste("replace")}
                  >
                    Remplacer toute la liste
                  </Btn>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  Accepte aussi les puces (-, •), numéros (1.) et cases [ ].
                </p>
              </div>

              <div className="my-4 border-t border-[var(--line)]" />

              <label className="mb-2 block text-xs font-semibold text-[var(--muted)]">
                Ajout manuel
              </label>
              <form onSubmit={addTask} className="flex gap-2">
                <input
                  value={newTask}
                  disabled={isReadOnly}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder="Saisir une tâche à ajouter…"
                  className="field flex-1"
                />
                <Btn primary disabled={isReadOnly} onClick={() => addTask()}>
                  Ajouter
                </Btn>
              </form>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[var(--muted)]">
                  Glissez une tâche pour changer son ordre, ou utilisez ▲ / ▼.
                </p>
                {!isReadOnly && tasks.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllTasks}
                    className="rounded-lg px-2 py-1 text-sm text-[var(--danger)] hover:bg-red-50"
                  >
                    Vider la liste
                  </button>
                )}
              </div>

              <div className="mt-3 space-y-2">
                {tasks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--line)] bg-[#f4f7fb] px-4 py-8 text-center">
                    <div className="font-semibold">Aucune tâche pour l’instant</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">
                      Collez une liste ci-dessus, ou ajoutez une tâche manuellement.
                    </div>
                  </div>
                ) : (
                  tasks.map((task, index) => {
                    const isEditing = editingTaskId === task.id;
                    const isDragging = dragTaskId === task.id;
                    const isDropTarget = dragOverTaskId === task.id;

                    return (
                      <div
                        key={task.id}
                        draggable={!isReadOnly && !isEditing}
                        onDragStart={() => onTaskDragStart(task.id)}
                        onDragOver={(e) => onTaskDragOver(e, task.id)}
                        onDrop={() => onTaskDrop(task.id)}
                        onDragEnd={onTaskDragEnd}
                        className={`flex items-center gap-2 rounded-xl border bg-[#f4f7fb] px-3 py-2 transition ${
                          isDropTarget
                            ? "border-[var(--accent)] ring-2 ring-teal-200"
                            : "border-[var(--line)]"
                        } ${isDragging ? "opacity-50" : ""} ${
                          !isReadOnly && !isEditing ? "cursor-grab active:cursor-grabbing" : ""
                        }`}
                      >
                        {!isReadOnly && (
                          <span
                            className="select-none px-1 text-sm text-[var(--muted)]"
                            title="Glisser pour déplacer"
                            aria-hidden
                          >
                            ⋮⋮
                          </span>
                        )}

                        <input
                          type="checkbox"
                          checked={task.done}
                          disabled={isReadOnly}
                          onChange={(e) =>
                            setTasks((prev) =>
                              prev.map((t) =>
                                t.id === task.id
                                  ? { ...t, done: e.target.checked }
                                  : t,
                              ),
                            )
                          }
                          className="h-4 w-4 accent-[var(--accent)]"
                        />

                        {isEditing ? (
                          <input
                            autoFocus
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                saveEditTask();
                              }
                              if (e.key === "Escape") cancelEditTask();
                            }}
                            className="field flex-1 py-1.5 text-sm"
                          />
                        ) : (
                          <span
                            className={`flex-1 text-sm ${
                              task.done
                                ? "text-[var(--muted)] line-through"
                                : "text-[var(--text)]"
                            }`}
                          >
                            {task.text}
                          </span>
                        )}

                        {!isReadOnly && (
                          <div className="flex flex-wrap items-center gap-1">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={saveEditTask}
                                  className="rounded-lg px-2 py-1 text-sm font-semibold text-[var(--accent-strong)] hover:bg-teal-50"
                                >
                                  OK
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditTask}
                                  className="rounded-lg px-2 py-1 text-sm text-[var(--muted)] hover:bg-slate-100"
                                >
                                  Annuler
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  title="Monter"
                                  disabled={index === 0}
                                  onClick={() => moveTask(index, index - 1)}
                                  className="rounded-lg px-2 py-1 text-sm text-[var(--text)] hover:bg-white disabled:opacity-30"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  title="Descendre"
                                  disabled={index === tasks.length - 1}
                                  onClick={() => moveTask(index, index + 1)}
                                  className="rounded-lg px-2 py-1 text-sm text-[var(--text)] hover:bg-white disabled:opacity-30"
                                >
                                  ▼
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startEditTask(task)}
                                  className="rounded-lg px-2 py-1 text-sm text-[var(--text)] hover:bg-white"
                                >
                                  Modifier
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteTask(task.id)}
                                  className="rounded-lg px-2 py-1 text-sm text-[var(--danger)] hover:bg-red-50"
                                >
                                  Supprimer
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            {status && (
              <p className="font-semibold text-[var(--accent-strong)]">
                {status}
              </p>
            )}
          </section>
        )}

        {view === "drafts" && (
          <section className="mx-auto max-w-5xl">
            <h1 className="text-3xl font-bold">Brouillons</h1>
            <p className="mt-2 text-[var(--muted)]">
              Fiches en cours de préparation, non encore finalisées.
            </p>
            <div className="mt-6 space-y-3">
              {drafts.length === 0 ? (
                <Empty>Aucun brouillon enregistré.</Empty>
              ) : (
                drafts.map((fiche) => (
                  <FicheRow
                    key={fiche.id}
                    fiche={fiche}
                    actions={
                      <>
                        <Btn
                          primary
                          onClick={() => {
                            fillEditor(fiche, false);
                            setEditorTitle(`Brouillon — ${fiche.pcName}`);
                          }}
                        >
                          Ouvrir
                        </Btn>
                        <Btn onClick={() => downloadPdf(fiche)}>PDF</Btn>
                        <Btn
                          danger
                          onClick={() => removeFiche(fiche.id, "draft")}
                        >
                          Supprimer
                        </Btn>
                      </>
                    }
                  />
                ))
              )}
            </div>
          </section>
        )}

        {view === "history" && (
          <section className="mx-auto max-w-5xl">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">Historique des Todo PC</h1>
                <p className="mt-2 text-[var(--muted)]">
                  Fiches finalisées avec date de fin de préparation.
                </p>
              </div>
              <input
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Rechercher (PC, propriétaire, version)…"
                className="field w-full max-w-xs"
              />
            </div>
            <div className="mt-6 space-y-3">
              {filteredHistory.length === 0 ? (
                <Empty>
                  {history.length === 0
                    ? "Aucune fiche finalisée pour le moment."
                    : "Aucun résultat pour cette recherche."}
                </Empty>
              ) : (
                filteredHistory.map((fiche) => (
                  <FicheRow
                    key={fiche.id}
                    fiche={fiche}
                    showEnd
                    actions={
                      <>
                        <Btn
                          primary
                          onClick={() => {
                            fillEditor(fiche, true);
                            setEditorTitle(
                              `Historique — ${fiche.pcName} (terminé le ${formatDate(fiche.endDate)})`,
                            );
                          }}
                        >
                          Voir
                        </Btn>
                        <Btn onClick={() => downloadPdf(fiche)}>PDF</Btn>
                        <Btn onClick={() => printPdf(fiche)}>Imprimer</Btn>
                        <Btn
                          danger
                          onClick={() => removeFiche(fiche.id, "history")}
                        >
                          Supprimer
                        </Btn>
                      </>
                    }
                  />
                ))
              )}
            </div>
          </section>
        )}
      </main>

      {finalizeOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0b1524]/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold">Finaliser la fiche</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Indiquez la date de fin de préparation. La fiche passera dans
              l’historique.
            </p>
            <label className="mt-4 block text-xs font-semibold text-[var(--muted)]">
              Date de fin de préparation
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="field mt-2"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <Btn ghost onClick={() => setFinalizeOpen(false)}>
                Annuler
              </Btn>
              <Btn primary onClick={confirmFinalize}>
                Confirmer la finalisation
              </Btn>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-[17px] font-semibold">
      <span className="h-4.5 w-1 rounded bg-[var(--accent)]" />
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-semibold text-[var(--muted)]">
      {label}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-10 text-center text-[var(--muted)]">
      {children}
    </div>
  );
}

function FicheRow({
  fiche,
  actions,
  showEnd = false,
}: {
  fiche: PcTodoFiche;
  actions: React.ReactNode;
  showEnd?: boolean;
}) {
  const done = fiche.tasks.filter((t) => t.done).length;
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div>
        <div className="text-lg font-semibold">{fiche.pcName}</div>
        <div className="mt-1 text-sm text-[var(--muted)]">
          Version {fiche.version} · {fiche.owner}
        </div>
        <div className="mt-1 text-sm text-[var(--muted)]">
          Début : {formatDate(fiche.startDate)}
          {showEnd ? ` · Fin : ${formatDate(fiche.endDate)}` : ""}
        </div>
        <div className="mt-3 inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
          {done} / {fiche.tasks.length} tâches
        </div>
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  primary = false,
  ghost = false,
  danger = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
  ghost?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const base =
    "rounded-xl px-3.5 py-2.5 text-sm font-semibold transition disabled:opacity-40";
  const style = primary
    ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]"
    : danger
      ? "border border-red-200 bg-red-50 text-[var(--danger)] hover:bg-red-100"
      : ghost
        ? "border border-[var(--line)] bg-[#f4f7fb] text-[var(--text)] hover:border-teal-500"
        : "border border-[var(--line)] bg-white text-[var(--text)] hover:border-teal-500";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${style}`}
    >
      {children}
    </button>
  );
}
