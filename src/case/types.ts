// The shape of a mystery. A case is pure data: the engine and agents read it,
// and no agent ever receives the whole thing.

export type SuspectId = string;
export type EvidenceId = string;

export interface Evidence {
  id: EvidenceId;
  name: string;
  /** Where it is found. Searching this location reveals it. */
  location: string;
  /** Words a player might use to refer to it. Matched case-insensitively. */
  keywords: string[];
  /** What the player sees when it is found. */
  description: string;
  /** What the forensics lab reports. Omit if the lab can learn nothing. */
  lab?: string;
  /** Only appears once this act begins. */
  appearsInAct?: number;
  /** Which parts of the accusation this supports. */
  supports?: Array<"who" | "how" | "why">;
  /** Clears a suspect when found. */
  clears?: SuspectId;
}

export interface PrivateClue {
  id: EvidenceId;
  /** Seat number, 1-based. With fewer players the engine deals extras round-robin. */
  seat: number;
  text: string;
  keywords: string[];
  supports?: Array<"who" | "how" | "why">;
}

/** A lie that breaks when a player presents the right evidence. */
export interface Crack {
  /** Any one of these breaks the lie. */
  triggers: EvidenceId[];
  /** Instruction given to the suspect once cracked. */
  admit: string;
  /** Testimony evidence the team gains when this lie breaks. */
  unlocks?: EvidenceId[];
}

export interface Suspect {
  id: SuspectId;
  /** Switch agent name, used for @mentions. */
  agent: string;
  name: string;
  role: string;
  /** Public persona and voice. */
  persona: string;
  /** What they say happened. */
  story: string;
  /** What they hide. Only this suspect's prompt contains it. */
  secret: string;
  /** What they genuinely saw that may help players. */
  knows: string[];
  tell: string;
  cracks: Crack[];
  isKiller: boolean;
}

export interface GhostMemory {
  /** Shown this evidence, the ghost recalls the memory. */
  trigger: EvidenceId | "none";
  memory: string;
}

export interface Act {
  number: number;
  title: string;
  /** Narration the Game Master posts when the act begins. */
  opening: string;
}

export interface Solution {
  killer: SuspectId;
  /** Evidence ids that prove each part of the accusation. */
  how: EvidenceId[];
  why: EvidenceId[];
  who: EvidenceId[];
  summary: string;
  reveal: string;
}

export interface Case {
  id: string;
  title: string;
  setting: string;
  victim: { name: string; description: string };
  locations: Record<string, string>;
  evidence: Evidence[];
  privateClues: PrivateClue[];
  suspects: Suspect[];
  ghost: { agent: string; name: string; persona: string; memories: GhostMemory[] };
  acts: Act[];
  solution: Solution;
}
