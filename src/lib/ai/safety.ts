/**
 * Lightweight originality guardrail. This is not a substitute for legal
 * review — it exists to catch the obvious case (someone typing "Pokemon
 * coloring book") before we spend AI credits and to remind the user that
 * KDP Book Builder only generates original content. Every AI prompt built
 * in this app also carries an explicit "no copyrighted characters/brands"
 * instruction (see `ORIGINALITY_INSTRUCTION` below) so the model itself is
 * steered away from infringing output even if a topic slips past this list.
 */
const FLAGGED_TERMS = [
  "disney",
  "pixar",
  "marvel",
  "dc comics",
  "pokemon",
  "pokémon",
  "star wars",
  "harry potter",
  "hogwarts",
  "nintendo",
  "mario",
  "zelda",
  "minecraft",
  "roblox",
  "barbie",
  "hello kitty",
  "sanrio",
  "spongebob",
  "paw patrol",
  "peppa pig",
  "frozen (disney)",
  "avengers",
  "batman",
  "superman",
  "spider-man",
  "spiderman",
  "sesame street",
  "looney tunes",
  "warner bros",
  "hbo",
  "netflix original",
  "taylor swift",
  "nfl",
  "nba",
  "fifa",
  "olympics",
];

export interface OriginalityCheckResult {
  flagged: boolean;
  matchedTerms: string[];
  message?: string;
}

export function checkOriginality(...inputs: (string | undefined | null)[]): OriginalityCheckResult {
  const haystack = inputs.filter(Boolean).join(" ").toLowerCase();
  const matchedTerms = FLAGGED_TERMS.filter((term) => haystack.includes(term));
  if (matchedTerms.length === 0) {
    return { flagged: false, matchedTerms: [] };
  }
  return {
    flagged: true,
    matchedTerms,
    message:
      `Your input mentions a third-party brand or character (${matchedTerms.join(", ")}). ` +
      `KDP Book Builder only generates original content — please describe the theme in your own words ` +
      `(e.g. "a friendly cartoon wizard" instead of a specific trademarked character) and try again.`,
  };
}

export const ORIGINALITY_INSTRUCTION =
  "You must only generate wholly original content. Do not reproduce, reference, or imitate " +
  "copyrighted text, trademarks, brand names, or recognizable fictional characters from existing " +
  "media. If the topic resembles a copyrighted property, generate a generic, original alternative " +
  "inspired by the general theme instead.";
