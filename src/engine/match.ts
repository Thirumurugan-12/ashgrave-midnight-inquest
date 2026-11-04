// Finding which evidence a player's message refers to.

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when `keyword` appears in `text` as whole words (case-insensitive). */
export function mentions(text: string, keyword: string): boolean {
  const k = keyword.trim().toLowerCase();
  if (!k) return false;
  // Allow simple plurals ("boot" matches "boots").
  const re = new RegExp(`(^|[^a-z0-9])${escape(k)}(s|es)?($|[^a-z0-9])`, "i");
  return re.test(text.toLowerCase());
}

export interface Matchable {
  id: string;
  name?: string;
  keywords: string[];
}

/** Ids of the items the text refers to, by id, name or keyword. */
export function matchItems<T extends Matchable>(text: string, items: Iterable<T>): T[] {
  const out: T[] = [];
  for (const item of items) {
    const words = [item.id, item.id.replace(/-/g, " "), ...(item.name ? [item.name] : []), ...item.keywords];
    if (words.some((w) => mentions(text, w))) out.push(item);
  }
  return out;
}

/** Strip leading @mentions so "@game-master search study" becomes "search study". */
export function stripMentions(text: string): string {
  return text.replace(/@[a-z0-9._-]+/gi, " ").replace(/\s+/g, " ").trim();
}
