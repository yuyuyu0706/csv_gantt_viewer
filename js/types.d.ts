// js/types.d.ts
export type Priority = '高' | '中' | '低' | string;
export type Status   = '未着手' | '進行中' | '遅延' | '完了' | string;

export interface Task {
  cat: string;
  sub: string;
  task?: string;
  name: string;
  start: Date;
  end: Date;
  check: Date | null;
  assignee?: string;
  status?: Status;
  priority?: Priority;
  taskNo?: string;
  successorsRaw?: string;
  successors?: Task[];
}

export interface Group { cat: string; items: Task[]; }

export interface Model {
  tasks: Task[];
  groups: Group[];
  min: Date;
  max: Date;
  dayWidth: number;
}

export interface ViewpointOrderConfig {
  enabled: boolean;
  order: string[];
}

export interface AppConfig {
  viewpointOrder: ViewpointOrderConfig;
}

export interface AppState {
  model: Model;
  hideTaskRows: boolean;
  collapsedCats: Set<string>;
  collapsedSubs: Set<string>;
  subsInitialized: boolean;
  config: AppConfig;
}

