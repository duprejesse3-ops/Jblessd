export type Channel = "search" | "conversation" | "proof" | "shadow";

export type Format =
  | "Prompt Pack"
  | "Automation"
  | "Agent"
  | "Template"
  | "Connector"
  | "Host";

export type OrganismStatus = "alive" | "killed" | "champion" | "live";

export type IntentSource = "search" | "x" | "reddit" | "forum";

export type Product = {
  sku: string;
  name: string;
  price: number;
  format: Format;
  role: string;
  job: string;
  proof: string;
  pain: string;
  queries: string[];
  utterances: string[];
  landing: string;
};

export type Organism = {
  id: string;
  swarmId: string;
  sku: string;
  channel: Channel;
  generation: number;
  parentIds: string[];
  headline: string;
  body: string;
  proofHook: string;
  cta: string;
  landingUrl: string;
  targetIntent: string;
  status: OrganismStatus;
  fitness: number;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  createdAt: number;
  liveAt?: number;
  /** Present once /api/swarm-performance has real data for this organism — clicks/conversions/fitness above stop being simulated the moment this is set. */
  verifiedLandings?: number;
  verifiedRevenue?: number;
  verifiedAt?: string;
};

export type Swarm = {
  id: string;
  name: string;
  generation: number;
  dailyBudget: number;
  running: boolean;
  startedAt: number | null;
  simulatedHours: number;
};

export type IntentPulse = {
  id: string;
  text: string;
  source: IntentSource;
  sku: string;
  heat: number;
  angle: number;
  radius: number;
  ts: number;
  postUrl?: string;
  handle?: string;
  live?: boolean;
};

export type GeneratedCopy = {
  channel: Channel;
  headline: string;
  body: string;
  proofHook: string;
  cta: string;
};

export type ActivityKind = "hijack" | "evolve" | "pilot" | "live" | "scan" | "real";

export type Activity = {
  id: string;
  ts: number;
  kind: ActivityKind;
  text: string;
};

export type Destinations = {
  xHandle: string;
  redditUser: string;
  redditSub: string;
};

export type LiveHit = {
  text: string;
  handle: string;
  url: string;
  sku: string;
  heat: number;
};
