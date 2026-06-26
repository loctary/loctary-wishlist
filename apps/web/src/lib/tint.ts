/**
 * Purely visual: pick a warm cover tint deterministically from an id so cards
 * without an image still feel branded and varied. No data is stored — same id
 * always yields the same tint.
 */
export type Tint = { bg: string; fg: string };

const TINTS: Tint[] = [
  { bg: "var(--amber-1)", fg: "var(--amber-7)" },
  { bg: "var(--moss-1)", fg: "var(--moss-8)" },
  { bg: "var(--honey-1)", fg: "var(--honey-7)" },
  { bg: "var(--clay-2)", fg: "var(--clay-7)" },
];

export function tintFor(id: string): Tint {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return TINTS[hash % TINTS.length]!;
}
