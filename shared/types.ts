export type FicheStatus = "draft" | "finalized";

/** Compte Windows sur lequel la tâche doit être réalisée */
export type TaskAccount = "admin" | "user";

/** Rôle applicatif (accès AUBM PCheck) */
export type AppRole = "admin" | "reader";

export type TaskItem = {
  id: string;
  text: string;
  done: boolean;
  sortOrder: number;
  account: TaskAccount;
};

export type PcTodoFiche = {
  id: string;
  version: string;
  owner: string;
  pcName: string;
  startDate: string | null;
  endDate: string | null;
  status: FicheStatus;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  tasks: TaskItem[];
};

export type FicheInput = {
  id?: string;
  version: string;
  owner: string;
  pcName: string;
  startDate: string | null;
  endDate?: string | null;
  status: FicheStatus;
  finalizedAt?: string | null;
  tasks: Array<{
    id?: string;
    text: string;
    done: boolean;
    account?: TaskAccount;
  }>;
};

export type PublicUser = {
  id: string;
  username: string;
  displayName: string;
  role: AppRole;
  createdAt: string;
  updatedAt: string;
};

export type UserInput = {
  username: string;
  displayName: string;
  password: string;
  role: AppRole;
};
