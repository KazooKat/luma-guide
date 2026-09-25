export interface JobItem {
  action: string;
  item: string;
  category: string;
  /** Level-1 base values; project with xpAt / moneyAt. */
  moneyBase: number;
  xpBase: number;
  /** The reading the base was derived from. */
  observed: { level: number; money: number; xp: number };
  icon: string | null;
  /** The server lists this item more than once in the same action with different pay. */
  dupe: boolean;
}

export interface Job {
  job: string;
  icon: string;
  defaultRate: number;
  rateNote: string;
  defaultItem?: string;
  confidence: 'confirmed' | 'assumed';
  level: number | null;
  source: string | null;
  items: JobItem[];
}

export interface JobsData {
  mcVersion: string;
  jobs: Job[];
}

export interface Perk {
  level: number;
  kind: 'unlock' | 'reward';
  text: string;
}
