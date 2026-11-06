// What the window needs to draw the game: art, where things sit in each scene,
// and short names for the private clues. No solution data lives here.

export const ART = (id: string) => `/art/${id}.webp`;

export const PLACES: Record<string, { title: string; art: string; blurb: string }> = {
  conservatory: { title: "The Conservatory", art: "conservatory", blurb: "Where Lady Verity was found." },
  study: { title: "Lord Henry's Study", art: "study", blurb: "Where Dr. Vale mixes the tonic." },
  kitchen: { title: "The Kitchen", art: "kitchen", blurb: "Below stairs: sink and scullery." },
  greenhouse: { title: "The Greenhouse", art: "greenhouse", blurb: "Thomas Reed's domain." },
  "back-door": { title: "The Servants' Door", art: "back-door", blurb: "The boot room by the yard." },
  "clara-room": { title: "Clara's Bedroom", art: "clara-room", blurb: "The east wing." },
};

/** Where each piece of evidence sits in its scene, as % of the image. */
export const HOTSPOTS: Record<string, { x: number; y: number }> = {
  orchid: { x: 22, y: 60 },
  "tonic-tray": { x: 47, y: 64 },
  "writing-desk": { x: 86, y: 57 },
  "tonic-bottle": { x: 86, y: 70 },
  "burned-letter": { x: 32, y: 74 },
  "kitchen-glass": { x: 18, y: 48 },
  "muddy-boots": { x: 34, y: 86 },
  "london-crate": { x: 17, y: 70 },
  iou: { x: 64, y: 58 },
};

export const ICONS: Record<string, string> = {
  orchid: "🥀",
  "tonic-tray": "🫖",
  "writing-desk": "🗝️",
  "tonic-bottle": "🧪",
  "burned-letter": "📜",
  "kitchen-glass": "🍷",
  "muddy-boots": "🥾",
  "london-crate": "📦",
  iou: "🃏",
  "study-lamp": "🕯️",
  "carriage-in-yard": "🐎",
  "vale-mixed-tonic": "🗣️",
  "henrys-letters": "✉️",
  "gate-ledger": "📒",
  "inn-closed": "🍺",
  "chemist-book": "⚗️",
  "maid-saw": "🤫",
};

export const CLUE_NAMES: Record<string, string> = {
  "gate-ledger": "The gate ledger",
  "inn-closed": "The landlord's word",
  "chemist-book": "The chemist's book",
  "maid-saw": "The maid's whisper",
};

export const PORTRAITS: Record<string, string> = {
  "thomas-reed": "thomas",
  "clara-ashgrave": "clara",
  "dr-vale": "vale",
  "mrs-holloway": "holloway",
  "ghost-of-verity": "ghost",
};

export const ACT_SUBTITLES: Record<number, string> = {
  1: "Search the house. Test what you find.",
  2: "Somebody here is lying. Prove it.",
  3: "The clock strikes twelve. Name the killer.",
};

export const ROMAN = ["", "I", "II", "III", "IV"];

/** The lab's four tests. Each reveals one kind of thing; the wrong one shows nothing. */
export const REAGENTS = [
  { id: "poison", name: "Keller's poison test", detects: "Heart poisons such as digitalis", color: "#5fbf8f", icon: "☠️" },
  { id: "soil", name: "Soil sieve", detects: "Earth, peat and plant matter", color: "#9b6b3c", icon: "🪴" },
  { id: "ink", name: "Ink-and-paper test", detects: "How old the writing is", color: "#4c6fd0", icon: "🖋️" },
  { id: "metal", name: "Metal-trace powder", detects: "Tool marks and residue", color: "#b8c0c8", icon: "🔩" },
] as const;

/** A rough read of a character's mood from their latest line. */
export type Mood = "composed" | "nervous" | "shaken" | "angry";
export function moodOf(text: string | undefined, justCracked: boolean): Mood {
  if (justCracked) return "shaken";
  if (!text) return "composed";
  if (/\b(how dare|insult|outrage|enough!|solicitor)\b/i.test(text)) return "angry";
  if (/\*(?:[^*]*\b(polish|wipes?|twists?|smooths?|looks away|swallow|trembl|fidget|glances)\b)[^*]*\*/i.test(text)) return "nervous";
  return "composed";
}
