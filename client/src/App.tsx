import {
  type DragEvent,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { downloadPdf, printPdf } from "./pdf";
import type {
  AppRole,
  PcTodoFiche,
  PublicUser,
  TaskAccount,
  TaskItem,
  UserInput,
} from "@shared/types";

type View = "editor" | "drafts" | "history" | "users";
type EditorMode = "new" | "draft" | "finalized";

type EditorTask = TaskItem;

const emptyTasks: EditorTask[] = [];

const fetchOpts: RequestInit = { credentials: "include" };

function roleLabel(role: AppRole) {
  return role === "admin" ? "Administrateur" : "Lecteur";
}

function accountLabel(account: TaskAccount) {
  return account === "admin" ? "Administrateur" : "Utilisateur";
}

function normalizeAccount(value: TaskAccount | string | undefined): TaskAccount {
  return value === "admin" ? "admin" : "user";
}

function sortTasksByAccount(list: EditorTask[]): EditorTask[] {
  const admin = list.filter((t) => t.account === "admin");
  const user = list.filter((t) => t.account !== "admin");
  return [...admin, ...user].map((t, index) => ({ ...t, sortOrder: index }));
}

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

async function parseJsonError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  if (data && typeof data === "object" && "error" in data) {
    return String((data as { error?: string }).error);
  }
  return `Erreur API (${res.status})`;
}

export default function App() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [authSettled, setAuthSettled] = useState(false);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", fetchOpts);
      if (res.ok) {
        const data = (await res.json()) as { user: PublicUser };
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setAuthSettled(true);
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  async function handleLogin(username: string, password: string) {
    const res = await fetch("/api/auth/login", {
      ...fetchOpts,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const message = await parseJsonError(res);
      throw new Error(message);
    }
    const data = (await res.json()) as { user: PublicUser };
    setUser(data.user);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { ...fetchOpts, method: "POST" });
    setUser(null);
  }

  if (user) {
    return <AppShell user={user} onLogout={() => void handleLogout()} />;
  }

  return (
    <LoginScreen
      onLogin={handleLogin}
      settling={!authSettled}
    />
  );
}

function LoginScreen({
  onLogin,
  settling,
}: {
  onLogin: (username: string, password: string) => Promise<void>;
  settling: boolean;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onLogin(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10 anim-fade">
      <div className="panel w-full max-w-lg p-8 anim-rise">
        <div className="flex items-center gap-4">
          <div className="brand-mark text-lg">PC</div>
          <div>
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-[var(--text)]">
              AUBM PCheck
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Préparation et contrôle des Todo PC
            </p>
          </div>
        </div>

        <p className="mt-8 text-lg font-semibold text-[var(--text)]">
          Connectez-vous pour accéder aux fiches.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Les brouillons et l&apos;historique sont centralisés sur le serveur
          AUBM. Identifiez-vous avec votre compte applicatif.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block text-xs font-semibold text-[var(--muted)]">
            Identifiant
            <input
              autoComplete="username"
              value={username}
              disabled={busy}
              onChange={(e) => setUsername(e.target.value)}
              className="field mt-2"
              placeholder="nom.utilisateur"
            />
          </label>
          <label className="block text-xs font-semibold text-[var(--muted)]">
            Mot de passe
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              disabled={busy}
              onChange={(e) => setPassword(e.target.value)}
              className="field mt-2"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy || settling}
            className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-bold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-50"
          >
            {busy
              ? "Connexion…"
              : settling
                ? "Vérification de session…"
                : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}

function AppShell({
  user,
  onLogout,
}: {
  user: PublicUser;
  onLogout: () => void;
}) {
  const isAppAdmin = user.role === "admin";

  const [view, setView] = useState<View>(isAppAdmin ? "editor" : "drafts");
  const [drafts, setDrafts] = useState<PcTodoFiche[]>([]);
  const [history, setHistory] = useState<PcTodoFiche[]>([]);
  const [syncing, setSyncing] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [finalizeOpen, setFinalizeOpen] = useState(false);

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("new");
  const [editorTitle, setEditorTitle] = useState("Nouvelle fiche Todo PC");
  const [version, setVersion] = useState("");
  const [owner, setOwner] = useState("");
  const [pcName, setPcName] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [newTask, setNewTask] = useState("");
  const [newTaskAccount, setNewTaskAccount] = useState<TaskAccount>("user");
  const [pasteBlock, setPasteBlock] = useState("");
  const [pasteAccount, setPasteAccount] = useState<TaskAccount>("user");
  const [tasks, setTasks] = useState<EditorTask[]>(emptyTasks);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingAccount, setEditingAccount] = useState<TaskAccount>("user");
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  const [users, setUsers] = useState<PublicUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userForm, setUserForm] = useState<UserInput>({
    username: "",
    displayName: "",
    password: "",
    role: "reader",
  });

  const isReadOnly =
    user.role === "reader" || editorMode === "finalized";

  const adminTasks = useMemo(
    () => tasks.filter((t) => t.account === "admin"),
    [tasks],
  );
  const userTasks = useMemo(
    () => tasks.filter((t) => t.account !== "admin"),
    [tasks],
  );

  const toast = useCallback((message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(""), 3500);
  }, []);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const parseList = async (res: Response) => {
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (data && typeof data === "object" && "error" in data
            ? String((data as { error?: string }).error)
            : null) || `Erreur API (${res.status})`,
        );
      }
      if (!Array.isArray(data)) {
        throw new Error("Réponse API invalide (liste attendue).");
      }
      return data as PcTodoFiche[];
    };

    const opts: RequestInit = { ...fetchOpts, signal };
    const [d, h] = await Promise.all([
      fetch("/api/fiches?status=draft", opts).then(parseList),
      fetch("/api/fiches?status=finalized", opts).then(parseList),
    ]);
    setDrafts(d);
    setHistory(h);
  }, []);

  const boot = useCallback(async () => {
    setSyncing(true);
    setLoadError("");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    try {
      await refresh(controller.signal);
      setLoadError("");
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "AbortError"
          ? "Délai dépassé : l’API ne répond pas."
          : err instanceof Error
            ? err.message
            : "Impossible de charger les fiches.";
      setLoadError(message);
    } finally {
      window.clearTimeout(timer);
      setSyncing(false);
    }
  }, [refresh]);

  useEffect(() => {
    void boot();
  }, [boot]);

  const loadUsers = useCallback(async () => {
    if (!isAppAdmin) return;
    setUsersLoading(true);
    try {
      const res = await fetch("/api/users", fetchOpts);
      if (!res.ok) {
        throw new Error(await parseJsonError(res));
      }
      const list = (await res.json()) as PublicUser[];
      setUsers(list);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur utilisateurs.");
    } finally {
      setUsersLoading(false);
    }
  }, [isAppAdmin, toast]);

  useEffect(() => {
    if (view === "users" && isAppAdmin) {
      void loadUsers();
    }
  }, [view, isAppAdmin, loadUsers]);

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return history;
    return history.filter((f) =>
      `${f.pcName} ${f.owner} ${f.version}`.toLowerCase().includes(q),
    );
  }, [history, historySearch]);

  function resetEditor() {
    if (!isAppAdmin) return;
    setCurrentId(null);
    setEditorMode("new");
    setEditorTitle("Nouvelle fiche Todo PC");
    setVersion("");
    setOwner("");
    setPcName("");
    setStartDate(todayISO());
    setEndDate(todayISO());
    setNewTask("");
    setNewTaskAccount("user");
    setPasteBlock("");
    setPasteAccount("user");
    setTasks([]);
    setEditingTaskId(null);
    setEditingText("");
    setEditingAccount("user");
    setDragTaskId(null);
    setDragOverTaskId(null);
    setView("editor");
  }

  function fillEditor(fiche: PcTodoFiche, mode: EditorMode) {
    setCurrentId(fiche.id);
    setEditorMode(mode);
    setVersion(fiche.version);
    setOwner(fiche.owner);
    setPcName(fiche.pcName);
    setStartDate(fiche.startDate || todayISO());
    setEndDate(fiche.endDate || todayISO());
    setTasks(
      sortTasksByAccount(
        fiche.tasks.map((t) => ({
          ...t,
          account: normalizeAccount(t.account),
        })),
      ),
    );
    setEditingTaskId(null);
    setEditingText("");
    setEditingAccount("user");
    setView("editor");
  }

  function collect(ficheStatus: "draft" | "finalized") {
    const ordered = sortTasksByAccount(tasks);
    return {
      id: currentId || undefined,
      version: version.trim(),
      owner: owner.trim(),
      pcName: pcName.trim(),
      startDate,
      endDate: ficheStatus === "finalized" ? endDate : null,
      status: ficheStatus,
      finalizedAt: ficheStatus === "finalized" ? new Date().toISOString() : null,
      tasks: ordered.map((t) => ({
        id: t.id,
        text: t.text,
        done: t.done,
        account: t.account,
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
    setTasks((prev) =>
      sortTasksByAccount([
        ...prev,
        {
          id: uid(),
          text,
          done: false,
          sortOrder: prev.length,
          account: newTaskAccount,
        },
      ]),
    );
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
      account: pasteAccount,
    }));

    if (mode === "replace") {
      setTasks(sortTasksByAccount(incoming));
      toast(
        `${incoming.length} tâche(s) importée(s) (${accountLabel(pasteAccount)}, liste remplacée).`,
      );
    } else {
      setTasks((prev) => {
        const existing = new Set(
          prev
            .filter((t) => t.account === pasteAccount)
            .map((t) => t.text.toLowerCase()),
        );
        const unique = incoming.filter(
          (t) => !existing.has(t.text.toLowerCase()),
        );
        toast(
          unique.length
            ? `${unique.length} tâche(s) ${accountLabel(pasteAccount).toLowerCase()} ajoutée(s)${
                unique.length < incoming.length
                  ? ` (${incoming.length - unique.length} doublon(s) ignoré(s))`
                  : ""
              }.`
            : "Aucune nouvelle tâche (doublons uniquement).",
        );
        return sortTasksByAccount([...prev, ...unique]);
      });
    }
    setPasteBlock("");
  }

  function startEditTask(task: EditorTask) {
    if (isReadOnly) return;
    setEditingTaskId(task.id);
    setEditingText(task.text);
    setEditingAccount(task.account);
  }

  function cancelEditTask() {
    setEditingTaskId(null);
    setEditingText("");
    setEditingAccount("user");
  }

  function saveEditTask() {
    if (isReadOnly || !editingTaskId) return;
    const text = editingText.trim();
    if (!text) {
      toast("Le libellé de la tâche ne peut pas être vide.");
      return;
    }
    setTasks((prev) =>
      sortTasksByAccount(
        prev.map((t) =>
          t.id === editingTaskId
            ? { ...t, text, account: editingAccount }
            : t,
        ),
      ),
    );
    cancelEditTask();
    toast("Tâche modifiée.");
  }

  function deleteTask(id: string) {
    if (isReadOnly) return;
    setTasks((prev) =>
      sortTasksByAccount(prev.filter((t) => t.id !== id)),
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

  function clearTasksByAccount(account: TaskAccount) {
    if (isReadOnly) return;
    const label = accountLabel(account).toLowerCase();
    if (!window.confirm(`Supprimer toutes les tâches ${label} ?`)) return;
    setTasks((prev) =>
      sortTasksByAccount(prev.filter((t) => t.account !== account)),
    );
    cancelEditTask();
    toast(`Tâches ${label} vidées.`);
  }

  function setTaskAccount(id: string, account: TaskAccount) {
    if (isReadOnly) return;
    setTasks((prev) =>
      sortTasksByAccount(
        prev.map((t) => (t.id === id ? { ...t, account } : t)),
      ),
    );
  }

  function moveTaskInAccount(
    account: TaskAccount,
    fromIndex: number,
    toIndex: number,
  ) {
    if (isReadOnly) return;
    setTasks((prev) => {
      const group = prev.filter((t) => t.account === account);
      const other = prev.filter((t) => t.account !== account);
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= group.length ||
        toIndex >= group.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }
      const next = [...group];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      const admin = account === "admin" ? next : other;
      const userList = account === "user" ? next : other;
      return sortTasksByAccount([...admin, ...userList]);
    });
  }

  function onTaskDragStart(taskId: string) {
    if (isReadOnly) return;
    setDragTaskId(taskId);
  }

  function onTaskDragOver(e: DragEvent, taskId: string) {
    if (isReadOnly || !dragTaskId || dragTaskId === taskId) return;
    const source = tasks.find((t) => t.id === dragTaskId);
    const target = tasks.find((t) => t.id === taskId);
    if (!source || !target || source.account !== target.account) return;
    e.preventDefault();
    setDragOverTaskId(taskId);
  }

  function onTaskDrop(targetId: string) {
    if (isReadOnly || !dragTaskId || dragTaskId === targetId) {
      setDragTaskId(null);
      setDragOverTaskId(null);
      return;
    }
    const source = tasks.find((t) => t.id === dragTaskId);
    const target = tasks.find((t) => t.id === targetId);
    if (!source || !target || source.account !== target.account) {
      setDragTaskId(null);
      setDragOverTaskId(null);
      return;
    }
    const group = tasks.filter((t) => t.account === source.account);
    const fromIndex = group.findIndex((t) => t.id === dragTaskId);
    const toIndex = group.findIndex((t) => t.id === targetId);
    moveTaskInAccount(source.account, fromIndex, toIndex);
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
      ...fetchOpts,
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
    setEditorMode("draft");
    setEditorTitle(`Brouillon — ${fiche.pcName}`);
    await refresh();
    toast("Brouillon enregistré.");
  }

  async function confirmFinalize() {
    if (isReadOnly || !validate()) return;
    if (!endDate) {
      toast("Indiquez la date de fin de préparation.");
      return;
    }
    if (startDate && endDate < startDate) {
      toast("La date de fin ne peut pas être antérieure à la date de début.");
      return;
    }
    const res = await fetch("/api/fiches", {
      ...fetchOpts,
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
    if (!isAppAdmin) return;
    const ok = window.confirm(
      kind === "draft"
        ? "Supprimer ce brouillon ?"
        : "Retirer cette fiche de l’historique ?",
    );
    if (!ok) return;
    await fetch(`/api/fiches/${id}`, { ...fetchOpts, method: "DELETE" });
    if (currentId === id) {
      if (isAppAdmin) resetEditor();
      else setView("drafts");
    }
    await refresh();
    toast(kind === "draft" ? "Brouillon supprimé." : "Fiche retirée.");
  }

  async function createAppUser(e: FormEvent) {
    e.preventDefault();
    if (!isAppAdmin) return;
    const res = await fetch("/api/users", {
      ...fetchOpts,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userForm),
    });
    if (!res.ok) {
      toast(await parseJsonError(res));
      return;
    }
    setUserForm({
      username: "",
      displayName: "",
      password: "",
      role: "reader",
    });
    await loadUsers();
    toast("Utilisateur créé.");
  }

  async function deleteAppUser(id: string) {
    if (!isAppAdmin || id === user.id) return;
    if (!window.confirm("Supprimer cet utilisateur ?")) return;
    const res = await fetch(`/api/users/${id}`, {
      ...fetchOpts,
      method: "DELETE",
    });
    if (!res.ok) {
      toast(await parseJsonError(res));
      return;
    }
    await loadUsers();
    toast("Utilisateur supprimé.");
  }

  function currentAsFiche(): PcTodoFiche {
    return {
      id: currentId || uid(),
      version: version.trim(),
      owner: owner.trim(),
      pcName: pcName.trim(),
      startDate,
      endDate: editorMode === "finalized" ? endDate : null,
      status: editorMode === "finalized" ? "finalized" : "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      finalizedAt: null,
      tasks,
    };
  }

  const navItems: Array<{
    key: View;
    label: string;
    count: number | null;
    adminOnly?: boolean;
  }> = [
    { key: "editor", label: "Nouvelle fiche", count: null, adminOnly: true },
    { key: "drafts", label: "Brouillons", count: drafts.length },
    { key: "history", label: "Historique", count: history.length },
    { key: "users", label: "Utilisateurs", count: null, adminOnly: true },
  ];

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="flex flex-col bg-[var(--sidebar)] px-5 py-7 text-white">
        <div className="mb-8 flex items-center gap-3 anim-rise">
          <div className="brand-mark text-sm">PC</div>
          <div>
            <div className="font-display text-xl font-extrabold">AUBM PCheck</div>
            <div className="text-xs text-slate-300">Todo PC · contrôle</div>
          </div>
        </div>

        <nav className="space-y-2">
          {navItems
            .filter((item) => !item.adminOnly || isAppAdmin)
            .map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  if (item.key === "editor" && isAppAdmin) resetEditor();
                  else setView(item.key);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition ${
                  view === item.key
                    ? "bg-[var(--accent)]/25 text-white"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span>{item.label}</span>
                {item.count !== null && (
                  <span className="min-w-6 rounded-md bg-white/10 px-2 py-0.5 text-center text-xs">
                    {item.count}
                  </span>
                )}
              </button>
            ))}
        </nav>

        <div className="mt-8 rounded-xl border border-white/10 bg-[var(--sidebar-2)] p-4 text-sm">
          <div className="font-semibold text-white">
            {user.displayName || user.username}
          </div>
          <div className="mt-1 text-xs text-slate-300">
            {user.username} · {roleLabel(user.role)}
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="mt-4 w-full rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
          >
            Se déconnecter
          </button>
        </div>

        <div className="mt-6 hidden text-xs leading-relaxed text-slate-400 lg:mt-auto lg:block">
          Préparez · cochez · finalisez
          <br />
          Export PDF ou impression.
        </div>
      </aside>

      <main className="px-5 py-6 sm:px-8 anim-fade">
        {(syncing || loadError) && view !== "users" && (
          <div
            className={`mx-auto mb-4 max-w-5xl rounded-xl border px-4 py-3 text-sm ${
              loadError
                ? "border-red-200 bg-red-50 text-[var(--danger)]"
                : "border-[var(--line)] bg-white text-[var(--muted)]"
            }`}
          >
            {syncing ? (
              "Synchronisation avec le serveur…"
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{loadError}</span>
                <button
                  type="button"
                  onClick={() => void boot()}
                  className="rounded-lg bg-white px-3 py-1.5 font-semibold text-[var(--text)] shadow-sm"
                >
                  Réessayer
                </button>
              </div>
            )}
          </div>
        )}

        {view === "editor" && (
          <section className="mx-auto max-w-5xl space-y-5 anim-rise">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-5">
              <div>
                <h1 className="font-display text-3xl font-bold text-[var(--text)]">
                  {editorTitle}
                </h1>
                <p className="mt-2 text-[var(--muted)]">
                  {isReadOnly
                    ? "Consultation seule — export PDF ou impression disponibles."
                    : "Renseignez le PC, ajoutez les tâches, puis cochez-les au fur et à mesure."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {isAppAdmin && editorMode === "new" && (
                  <Btn ghost onClick={resetEditor}>
                    Nouvelle
                  </Btn>
                )}
                {isAppAdmin && !isReadOnly && (
                  <Btn onClick={() => void saveDraft()}>Enregistrer brouillon</Btn>
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
                {isAppAdmin && !isReadOnly && (
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

            <div className="panel p-5">
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
            </div>

            <div className="panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTitle>Tâches à faire</SectionTitle>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-md bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                    Admin {adminTasks.filter((t) => t.done).length}/
                    {adminTasks.length}
                  </span>
                  <span className="rounded-md bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-900">
                    Utilisateur {userTasks.filter((t) => t.done).length}/
                    {userTasks.length}
                  </span>
                  <span className="rounded-md bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                    Total {tasks.filter((t) => t.done).length}/{tasks.length}
                  </span>
                </div>
              </div>

              {!isReadOnly && (
                <>
                  <div className="mt-4 space-y-3">
                    <div className="text-sm font-semibold text-[var(--text)]">
                      Coller une liste (une tâche par ligne)
                    </div>
                    <AccountPicker
                      value={pasteAccount}
                      disabled={isReadOnly}
                      onChange={setPasteAccount}
                      label="Ces tâches collées se feront sur le compte"
                    />
                    <textarea
                      value={pasteBlock}
                      disabled={isReadOnly}
                      onChange={(e) => setPasteBlock(e.target.value)}
                      rows={5}
                      placeholder={
                        pasteAccount === "admin"
                          ? "Exemple (admin) :\nInstaller Windows 11\nConfigurer le domaine\nInstaller les drivers"
                          : "Exemple (utilisateur) :\nConfigurer le bureau\nInstaller Office\nTester l’imprimante"
                      }
                      className="field min-h-28 resize-y"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Btn
                        primary
                        disabled={isReadOnly}
                        onClick={() => importFromPaste("append")}
                      >
                        Importer en {accountLabel(pasteAccount)}
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

                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-[var(--text)]">
                      Ajout manuel
                    </div>
                    <AccountPicker
                      value={newTaskAccount}
                      disabled={isReadOnly}
                      onChange={setNewTaskAccount}
                      label="Cette tâche se fera sur le compte"
                    />
                    <form
                      onSubmit={addTask}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input
                        value={newTask}
                        disabled={isReadOnly}
                        onChange={(e) => setNewTask(e.target.value)}
                        placeholder={`Tâche ${accountLabel(newTaskAccount).toLowerCase()}…`}
                        className="field min-w-48 flex-1"
                      />
                      <Btn primary disabled={isReadOnly} onClick={() => addTask()}>
                        Ajouter en {accountLabel(newTaskAccount)}
                      </Btn>
                    </form>
                  </div>
                </>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[var(--muted)]">
                  Les listes sont séparées par compte Windows. Glissez ou
                  utilisez les flèches pour réordonner dans une même liste.
                </p>
                {!isReadOnly && tasks.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllTasks}
                    className="rounded-lg px-2 py-1 text-sm text-[var(--danger)] hover:bg-red-50"
                  >
                    Vider toutes les tâches
                  </button>
                )}
              </div>

              {tasks.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-[var(--line)] bg-[#f4f7fb] px-4 py-8 text-center">
                  <div className="font-semibold">Aucune tâche pour l’instant</div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    {isReadOnly
                      ? "Cette fiche ne contient aucune tâche enregistrée."
                      : "Collez une liste ou ajoutez une tâche en précisant le compte (admin / utilisateur)."}
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-5">
                  <TaskGroup
                    title="Tâches compte administrateur"
                    hint="À réaliser connecté en administrateur Windows"
                    accent="admin"
                    tasks={adminTasks}
                    isReadOnly={isReadOnly}
                    editingTaskId={editingTaskId}
                    editingText={editingText}
                    editingAccount={editingAccount}
                    dragTaskId={dragTaskId}
                    dragOverTaskId={dragOverTaskId}
                    onEditingText={setEditingText}
                    onEditingAccount={setEditingAccount}
                    onToggleDone={(id, done) => {
                      if (isReadOnly) return;
                      setTasks((prev) =>
                        prev.map((t) => (t.id === id ? { ...t, done } : t)),
                      );
                    }}
                    onDragStart={onTaskDragStart}
                    onDragOver={onTaskDragOver}
                    onDrop={onTaskDrop}
                    onDragEnd={onTaskDragEnd}
                    onMove={(from, to) => moveTaskInAccount("admin", from, to)}
                    onStartEdit={startEditTask}
                    onSaveEdit={saveEditTask}
                    onCancelEdit={cancelEditTask}
                    onDelete={deleteTask}
                    onSetAccount={setTaskAccount}
                    onClearGroup={() => clearTasksByAccount("admin")}
                  />
                  <TaskGroup
                    title="Tâches compte utilisateur"
                    hint="À réaliser connecté en utilisateur Windows"
                    accent="user"
                    tasks={userTasks}
                    isReadOnly={isReadOnly}
                    editingTaskId={editingTaskId}
                    editingText={editingText}
                    editingAccount={editingAccount}
                    dragTaskId={dragTaskId}
                    dragOverTaskId={dragOverTaskId}
                    onEditingText={setEditingText}
                    onEditingAccount={setEditingAccount}
                    onToggleDone={(id, done) => {
                      if (isReadOnly) return;
                      setTasks((prev) =>
                        prev.map((t) => (t.id === id ? { ...t, done } : t)),
                      );
                    }}
                    onDragStart={onTaskDragStart}
                    onDragOver={onTaskDragOver}
                    onDrop={onTaskDrop}
                    onDragEnd={onTaskDragEnd}
                    onMove={(from, to) => moveTaskInAccount("user", from, to)}
                    onStartEdit={startEditTask}
                    onSaveEdit={saveEditTask}
                    onCancelEdit={cancelEditTask}
                    onDelete={deleteTask}
                    onSetAccount={setTaskAccount}
                    onClearGroup={() => clearTasksByAccount("user")}
                  />
                </div>
              )}
            </div>

            {status && (
              <p className="font-semibold text-[var(--accent-strong)]">{status}</p>
            )}
          </section>
        )}

        {view === "drafts" && (
          <section className="mx-auto max-w-5xl anim-rise">
            <h1 className="font-display text-3xl font-bold">Brouillons</h1>
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
                            fillEditor(fiche, isAppAdmin ? "draft" : "draft");
                            setEditorTitle(
                              isAppAdmin
                                ? `Brouillon — ${fiche.pcName}`
                                : `Consultation — ${fiche.pcName}`,
                            );
                          }}
                        >
                          {isAppAdmin ? "Ouvrir" : "Consulter"}
                        </Btn>
                        <Btn onClick={() => downloadPdf(fiche)}>PDF</Btn>
                        {isAppAdmin && (
                          <Btn
                            danger
                            onClick={() => void removeFiche(fiche.id, "draft")}
                          >
                            Supprimer
                          </Btn>
                        )}
                      </>
                    }
                  />
                ))
              )}
            </div>
          </section>
        )}

        {view === "history" && (
          <section className="mx-auto max-w-5xl anim-rise">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold">
                  Historique des Todo PC
                </h1>
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
                            fillEditor(fiche, "finalized");
                            setEditorTitle(
                              `Historique — ${fiche.pcName} (terminé le ${formatDate(fiche.endDate)})`,
                            );
                          }}
                        >
                          Voir
                        </Btn>
                        <Btn onClick={() => downloadPdf(fiche)}>PDF</Btn>
                        <Btn onClick={() => printPdf(fiche)}>Imprimer</Btn>
                        {isAppAdmin && (
                          <Btn
                            danger
                            onClick={() => void removeFiche(fiche.id, "history")}
                          >
                            Supprimer
                          </Btn>
                        )}
                      </>
                    }
                  />
                ))
              )}
            </div>
          </section>
        )}

        {view === "users" && isAppAdmin && (
          <section className="mx-auto max-w-5xl space-y-6 anim-rise">
            <div>
              <h1 className="font-display text-3xl font-bold">Utilisateurs</h1>
              <p className="mt-2 text-[var(--muted)]">
                Comptes applicatifs AUBM PCheck (distincts des comptes Windows des
                tâches).
              </p>
            </div>

            <div className="panel p-5">
              <SectionTitle>Créer un utilisateur</SectionTitle>
              <form
                onSubmit={(e) => void createAppUser(e)}
                className="mt-4 grid gap-4 md:grid-cols-2"
              >
                <Field label="Identifiant (connexion)">
                  <input
                    required
                    value={userForm.username}
                    onChange={(e) =>
                      setUserForm((f) => ({ ...f, username: e.target.value }))
                    }
                    className="field"
                    autoComplete="off"
                  />
                </Field>
                <Field label="Nom affiché">
                  <input
                    required
                    value={userForm.displayName}
                    onChange={(e) =>
                      setUserForm((f) => ({
                        ...f,
                        displayName: e.target.value,
                      }))
                    }
                    className="field"
                  />
                </Field>
                <Field label="Mot de passe initial">
                  <input
                    required
                    type="password"
                    value={userForm.password}
                    onChange={(e) =>
                      setUserForm((f) => ({ ...f, password: e.target.value }))
                    }
                    className="field"
                    autoComplete="new-password"
                  />
                </Field>
                <Field label="Rôle applicatif">
                  <select
                    value={userForm.role}
                    onChange={(e) =>
                      setUserForm((f) => ({
                        ...f,
                        role: e.target.value as AppRole,
                      }))
                    }
                    className="field"
                  >
                    <option value="reader">Lecteur</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </Field>
                <div className="md:col-span-2">
                  <Btn primary type="submit" disabled={usersLoading}>
                    Créer l&apos;utilisateur
                  </Btn>
                </div>
              </form>
            </div>

            <div className="space-y-3">
              {usersLoading && users.length === 0 ? (
                <Empty>Chargement des utilisateurs…</Empty>
              ) : users.length === 0 ? (
                <Empty>Aucun utilisateur enregistré.</Empty>
              ) : (
                users.map((u) => (
                  <div
                    key={u.id}
                    className="panel flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="text-lg font-semibold">
                        {u.displayName}
                      </div>
                      <div className="mt-1 text-sm text-[var(--muted)]">
                        {u.username} · {roleLabel(u.role)}
                      </div>
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        Créé le {formatDate(u.createdAt.slice(0, 10))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {u.id !== user.id ? (
                        <Btn
                          danger
                          onClick={() => void deleteAppUser(u.id)}
                        >
                          Supprimer
                        </Btn>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">
                          Compte actuel
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </main>

      {finalizeOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0b1524]/60 p-4 anim-fade">
          <div className="panel w-full max-w-md p-6 anim-rise">
            <h2 className="font-display text-xl font-bold">Finaliser la fiche</h2>
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
              <Btn primary onClick={() => void confirmFinalize()}>
                Confirmer la finalisation
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountPicker({
  value,
  onChange,
  disabled = false,
  label = "Cette tâche se fera sur le compte",
}: {
  value: TaskAccount;
  onChange: (value: TaskAccount) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[#f4f7fb] p-3">
      <div className="text-sm font-semibold text-[var(--text)]">{label}</div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("admin")}
          className={`rounded-xl border px-3 py-3 text-left transition disabled:opacity-40 ${
            value === "admin"
              ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200"
              : "border-[var(--line)] bg-white hover:border-amber-300"
          }`}
        >
          <div className="text-sm font-bold text-amber-900">Administrateur</div>
          <div className="mt-0.5 text-xs text-[var(--muted)]">
            Connexion Windows administrateur
          </div>
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("user")}
          className={`rounded-xl border px-3 py-3 text-left transition disabled:opacity-40 ${
            value === "user"
              ? "border-sky-500 bg-sky-50 ring-2 ring-sky-200"
              : "border-[var(--line)] bg-white hover:border-sky-300"
          }`}
        >
          <div className="text-sm font-bold text-sky-900">Utilisateur</div>
          <div className="mt-0.5 text-xs text-[var(--muted)]">
            Connexion Windows utilisateur
          </div>
        </button>
      </div>
      <p className="mt-2 text-xs font-medium text-[var(--muted)]">
        Sélection actuelle :{" "}
        <span
          className={value === "admin" ? "text-amber-800" : "text-sky-800"}
        >
          {accountLabel(value)}
        </span>
      </p>
    </div>
  );
}

function TaskGroup({
  title,
  hint,
  accent,
  tasks,
  isReadOnly,
  editingTaskId,
  editingText,
  editingAccount,
  dragTaskId,
  dragOverTaskId,
  onEditingText,
  onEditingAccount,
  onToggleDone,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMove,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onSetAccount,
  onClearGroup,
}: {
  title: string;
  hint: string;
  accent: TaskAccount;
  tasks: EditorTask[];
  isReadOnly: boolean;
  editingTaskId: string | null;
  editingText: string;
  editingAccount: TaskAccount;
  dragTaskId: string | null;
  dragOverTaskId: string | null;
  onEditingText: (value: string) => void;
  onEditingAccount: (value: TaskAccount) => void;
  onToggleDone: (id: string, done: boolean) => void;
  onDragStart: (id: string) => void;
  onDragOver: (e: DragEvent, id: string) => void;
  onDrop: (id: string) => void;
  onDragEnd: () => void;
  onMove: (from: number, to: number) => void;
  onStartEdit: (task: EditorTask) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onSetAccount: (id: string, account: TaskAccount) => void;
  onClearGroup: () => void;
}) {
  const badge =
    accent === "admin"
      ? "bg-amber-50 text-amber-900"
      : "bg-sky-50 text-sky-900";
  const borderAccent =
    accent === "admin" ? "border-amber-200" : "border-sky-200";

  return (
    <div className={`rounded-xl border ${borderAccent} bg-[#f8fafc] p-3`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-[var(--text)]">{title}</h3>
            <span
              className={`rounded-md px-2.5 py-0.5 text-xs font-semibold ${badge}`}
            >
              {tasks.filter((t) => t.done).length}/{tasks.length}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p>
        </div>
        {!isReadOnly && tasks.length > 0 && (
          <button
            type="button"
            onClick={onClearGroup}
            className="rounded-lg px-2 py-1 text-sm text-[var(--danger)] hover:bg-red-50"
          >
            Vider
          </button>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--line)] bg-white px-3 py-5 text-center text-sm text-[var(--muted)]">
          Aucune tâche dans cette liste.
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task, index) => {
            const isEditing = editingTaskId === task.id;
            const isDragging = dragTaskId === task.id;
            const isDropTarget = dragOverTaskId === task.id;

            return (
              <div
                key={task.id}
                draggable={!isReadOnly && !isEditing}
                onDragStart={() => onDragStart(task.id)}
                onDragOver={(e) => onDragOver(e, task.id)}
                onDrop={() => onDrop(task.id)}
                onDragEnd={onDragEnd}
                className={`flex flex-wrap items-center gap-2 rounded-xl border bg-white px-3 py-2 transition ${
                  isDropTarget
                    ? "border-[var(--accent)] ring-2 ring-[var(--accent-soft)]"
                    : "border-[var(--line)]"
                } ${isDragging ? "opacity-50" : ""} ${
                  !isReadOnly && !isEditing
                    ? "cursor-grab active:cursor-grabbing"
                    : ""
                }`}
              >
                {!isReadOnly && (
                  <span
                    className="select-none px-1 font-mono text-xs text-[var(--muted)]"
                    title="Glisser pour déplacer"
                    aria-hidden
                  >
                    ::
                  </span>
                )}

                <input
                  type="checkbox"
                  checked={task.done}
                  disabled={isReadOnly}
                  onChange={(e) => onToggleDone(task.id, e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />

                {isEditing ? (
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <input
                      autoFocus
                      value={editingText}
                      onChange={(e) => onEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          onSaveEdit();
                        }
                        if (e.key === "Escape") onCancelEdit();
                      }}
                      className="field min-w-40 flex-1 py-1.5 text-sm"
                    />
                    <select
                      value={editingAccount}
                      onChange={(e) =>
                        onEditingAccount(e.target.value as TaskAccount)
                      }
                      className="field w-auto py-1.5 text-sm"
                    >
                      <option value="admin">Administrateur</option>
                      <option value="user">Utilisateur</option>
                    </select>
                  </div>
                ) : (
                  <div className="min-w-0 flex-1">
                    <span
                      className={`block text-sm ${
                        task.done
                          ? "text-[var(--muted)] line-through"
                          : "text-[var(--text)]"
                      }`}
                    >
                      {task.text}
                    </span>
                    <span
                      className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${badge}`}
                    >
                      {accountLabel(task.account)}
                    </span>
                  </div>
                )}

                {!isReadOnly && (
                  <div className="flex flex-wrap items-center gap-1">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={onSaveEdit}
                          className="rounded-lg px-2 py-1 text-sm font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent-soft)]"
                        >
                          OK
                        </button>
                        <button
                          type="button"
                          onClick={onCancelEdit}
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
                          onClick={() => onMove(index, index - 1)}
                          className="rounded-lg px-2 py-1 text-sm text-[var(--text)] hover:bg-[#f4f7fb] disabled:opacity-30"
                        >
                          Haut
                        </button>
                        <button
                          type="button"
                          title="Descendre"
                          disabled={index === tasks.length - 1}
                          onClick={() => onMove(index, index + 1)}
                          className="rounded-lg px-2 py-1 text-sm text-[var(--text)] hover:bg-[#f4f7fb] disabled:opacity-30"
                        >
                          Bas
                        </button>
                        <select
                          value={task.account}
                          title="Changer de compte"
                          onChange={(e) =>
                            onSetAccount(
                              task.id,
                              e.target.value as TaskAccount,
                            )
                          }
                          className="rounded-lg border border-[var(--line)] bg-[#f4f7fb] px-2 py-1 text-xs"
                        >
                          <option value="admin">Admin</option>
                          <option value="user">Utilisateur</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => onStartEdit(task)}
                          className="rounded-lg px-2 py-1 text-sm text-[var(--text)] hover:bg-[#f4f7fb]"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(task.id)}
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
          })}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
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
  children: ReactNode;
}) {
  return (
    <label className="block text-xs font-semibold text-[var(--muted)]">
      {label}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="panel px-4 py-10 text-center text-[var(--muted)]">
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
  actions: ReactNode;
  showEnd?: boolean;
}) {
  const done = fiche.tasks.filter((t) => t.done).length;
  const admin = fiche.tasks.filter((t) => t.account === "admin");
  const userList = fiche.tasks.filter((t) => t.account !== "admin");
  return (
    <div className="panel flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="text-lg font-semibold">{fiche.pcName}</div>
        <div className="mt-1 text-sm text-[var(--muted)]">
          Version {fiche.version} · {fiche.owner}
        </div>
        <div className="mt-1 text-sm text-[var(--muted)]">
          Début : {formatDate(fiche.startDate)}
          {showEnd ? ` · Fin : ${formatDate(fiche.endDate)}` : ""}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex rounded-md bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
            Admin {admin.filter((t) => t.done).length}/{admin.length}
          </span>
          <span className="inline-flex rounded-md bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-900">
            Utilisateur {userList.filter((t) => t.done).length}/{userList.length}
          </span>
          <span className="inline-flex rounded-md bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
            Total {done}/{fiche.tasks.length}
          </span>
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
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  ghost?: boolean;
  danger?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const base =
    "rounded-xl px-3.5 py-2.5 text-sm font-semibold transition disabled:opacity-40";
  const style = primary
    ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]"
    : danger
      ? "border border-red-200 bg-red-50 text-[var(--danger)] hover:bg-red-100"
      : ghost
        ? "border border-[var(--line)] bg-[#f4f7fb] text-[var(--text)] hover:border-[var(--accent)]"
        : "border border-[var(--line)] bg-white text-[var(--text)] hover:border-[var(--accent)]";
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${style}`}
    >
      {children}
    </button>
  );
}