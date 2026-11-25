export type FicheStatus = "draft" | "finalized";

export type TaskItem = {
  id: string;
  text: string;
  done: boolean;
  sortOrder: number;
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
  tasks: Array<{ id?: string; text: string; done: boolean }>;
};
