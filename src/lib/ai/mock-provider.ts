import { createRng, seedFromString, shuffle } from "../engines/rng";
import type {
  AIImageOptions,
  AIImageResult,
  AIProvider,
  AITextOptions,
  AITextResult,
  AIUsage,
} from "./types";

const WORD_BANKS: Record<string, string[]> = {
  sports: [
    "BASKETBALL", "SOCCER", "TENNIS", "HOCKEY", "BASEBALL", "DRIBBLE", "HOOPS", "COURT",
    "REFEREE", "DEFENSE", "OFFENSE", "STADIUM", "COACH", "CHAMPION", "MEDAL", "SPRINT",
    "GOALIE", "TOURNAMENT", "ATHLETE", "SCOREBOARD",
  ],
  animals: [
    "ELEPHANT", "GIRAFFE", "PENGUIN", "DOLPHIN", "TIGER", "ZEBRA", "KOALA", "RABBIT",
    "OTTER", "FALCON", "TURTLE", "LEOPARD", "GORILLA", "OCTOPUS", "BEAVER", "MEERKAT",
    "FLAMINGO", "PANTHER", "HEDGEHOG", "WALRUS",
  ],
  ocean: [
    "CORAL", "STARFISH", "SEAHORSE", "LOBSTER", "PLANKTON", "TIDEPOOL", "LAGOON", "CURRENT",
    "SUBMARINE", "ANCHOR", "LIGHTHOUSE", "SEASHELL", "TSUNAMI", "HARBOR", "SNORKEL",
    "STINGRAY", "JELLYFISH", "SHIPWRECK", "SEAWEED", "HORIZON",
  ],
  space: [
    "GALAXY", "COMET", "ASTEROID", "NEBULA", "ROCKET", "ASTRONAUT", "TELESCOPE", "ORBIT",
    "METEOR", "SATELLITE", "GRAVITY", "STARDUST", "ECLIPSE", "COSMOS", "LAUNCHPAD",
    "SPACESHIP", "PLANET", "CONSTELLATION", "MOONWALK", "SOLARWIND",
  ],
  food: [
    "PANCAKE", "AVOCADO", "PRETZEL", "CUPCAKE", "NOODLE", "PEPPER", "WAFFLE", "BURRITO",
    "OATMEAL", "PUMPKIN", "MUFFIN", "SANDWICH", "BISCUIT", "CASSEROLE", "SMOOTHIE",
    "DUMPLING", "PANINI", "MEATBALL", "BROCCOLI", "LEMONADE",
  ],
  nature: [
    "FOREST", "MOUNTAIN", "WATERFALL", "MEADOW", "CANYON", "GLACIER", "VOLCANO", "PRAIRIE",
    "BOULDER", "SUNRISE", "RAINBOW", "THUNDER", "BREEZE", "BLOSSOM", "HARVEST",
    "WILDFLOWER", "RIVERBANK", "EVERGREEN", "HORIZON", "DRIZZLE",
  ],
  general: [
    "PUZZLE", "JOURNEY", "ADVENTURE", "MYSTERY", "TREASURE", "COMPASS", "LANTERN", "JOURNAL",
    "CASTLE", "GARDEN", "FESTIVAL", "MELODY", "PAINTING", "SCULPTURE", "LIBRARY",
    "ORCHARD", "WORKSHOP", "CARNIVAL", "MARKET", "BAKERY",
  ],
};

function resolveTopicCategory(topic: string): keyof typeof WORD_BANKS {
  const key = topic.toLowerCase();
  for (const bank of Object.keys(WORD_BANKS) as (keyof typeof WORD_BANKS)[]) {
    if (key.includes(bank)) return bank;
  }
  if (/(basketball|soccer|football|tennis|golf|athlete)/.test(key)) return "sports";
  if (/(animal|zoo|pet|wildlife)/.test(key)) return "animals";
  if (/(sea|beach|fish|marine)/.test(key)) return "ocean";
  if (/(star|planet|astro|galax)/.test(key)) return "space";
  if (/(cook|recipe|kitchen|eat|meal)/.test(key)) return "food";
  if (/(garden|hike|outdoor|camp)/.test(key)) return "nature";
  return "general";
}

function pickWordBank(topic: string): string[] {
  return WORD_BANKS[resolveTopicCategory(topic)];
}

/** Whimsical, kid-friendly scene ideas per topic category, used so the mock provider's coloring pages vary page to page instead of just changing a number. */
const COLORING_SUBJECTS: Record<keyof typeof WORD_BANKS, string[]> = {
  sports: [
    "a kid shooting a basketball hoop", "a puppy chasing a soccer ball", "a bear swinging a tennis racket",
    "a robot playing hockey", "a squirrel at bat", "a fox dribbling a ball", "a turtle running a race",
    "a rabbit holding a trophy",
  ],
  animals: [
    "a bunny hopping through daisies", "a friendly dragon reading a book", "a bear fishing by a river",
    "a giraffe wearing a scarf", "a penguin sledding downhill", "a fox flying a kite",
    "an elephant blowing bubbles", "a koala napping in a tree",
  ],
  ocean: [
    "a seahorse riding a wave", "a crab building a sandcastle", "an octopus playing a guitar",
    "a dolphin jumping through a hoop", "a starfish sunbathing on a rock", "a turtle wearing a snorkel",
    "a lobster having a picnic", "a whale spouting a fountain",
  ],
  space: [
    "an astronaut planting a flag on the moon", "a rocket ship blasting off", "a friendly alien waving hello",
    "a robot exploring a crater", "a comet zooming past stars", "a spaceship docking at a station",
    "a rover collecting moon rocks", "a satellite orbiting a planet",
  ],
  food: [
    "a smiling pancake stack", "a dancing ice cream cone", "a cupcake wearing a party hat",
    "a happy watermelon slice", "a taco riding a skateboard", "a strawberry family picnic",
    "a pizza wearing a superhero cape", "a donut floating on a cloud",
  ],
  nature: [
    "a squirrel gathering acorns", "a butterfly landing on a flower", "a family of ducks on a pond",
    "a treehouse in a big oak", "a rainbow over a meadow", "a hedgehog under a mushroom",
    "a deer drinking from a stream", "a beehive with busy bees",
  ],
  general: [
    "a knight riding a friendly dragon", "a wizard casting sparkly stars", "a pirate ship sailing to treasure",
    "a fairy dancing on a mushroom", "a train chugging through the hills", "a hot air balloon over a village",
    "a unicorn jumping over a rainbow", "a robot building a sandcastle",
  ],
};

function pickColoringSubject(topic: string, ordinal: number, usedSubjects: string[], rng: () => number): string {
  const bank = COLORING_SUBJECTS[resolveTopicCategory(topic)];
  const used = new Set(usedSubjects.map((s) => s.toLowerCase()));
  const shuffled = shuffle(rng, bank);
  return shuffled.find((s) => !used.has(s.toLowerCase())) ?? `${topic} scene ${ordinal + 1}`;
}

function textUsage(prompt: string, output: string): AIUsage {
  const inputTokens = Math.max(1, Math.round(prompt.length / 4));
  const outputTokens = Math.max(1, Math.round(output.length / 4));
  return { inputTokens, outputTokens };
}

/**
 * Zero-cost, zero-network provider used by default in development and in
 * tests, and automatically as a fallback whenever no real API key is
 * configured — so the rest of the app (job pipeline, editor, export) keeps
 * working even without an AI vendor set up.
 */
export class MockProvider implements AIProvider {
  readonly name = "mock";

  async generateText(prompt: string, options?: AITextOptions): Promise<AITextResult> {
    const seed = seedFromString(prompt + (options?.mockKind ?? ""));
    const rng = createRng(seed);
    const text = `[mock output for: ${prompt.slice(0, 80)}...] token=${Math.floor(rng() * 1000)}`;
    return { text, usage: textUsage(prompt, text) };
  }

  async generateJSON<T>(
    prompt: string,
    options?: AITextOptions
  ): Promise<{ data: T; usage: AIUsage }> {
    const kind = options?.mockKind ?? "page_text";
    const ctx = options?.mockContext ?? {};
    const seed = seedFromString(prompt + kind + JSON.stringify(ctx));
    const rng = createRng(seed);

    let data: unknown;
    switch (kind) {
      case "word_list":
      case "crossword_words": {
        const topic = String(ctx.topic ?? "general");
        const count = Number(ctx.count ?? 12);
        const bank = pickWordBank(topic);
        const usedWords = (ctx.usedWords as string[] | undefined) ?? [];
        const used = new Set(usedWords.map((w) => w.toUpperCase()));
        const fresh = shuffle(rng, bank.filter((w) => !used.has(w)));
        // Bank exhausted (book has more pages than unique bank words) — top up with
        // already-used words rather than erroring; still better than a hard cap.
        const fallback = shuffle(rng, bank.filter((w) => used.has(w)));
        data = [...fresh, ...fallback].slice(0, Math.min(count, bank.length));
        break;
      }
      case "crossword_clues": {
        const words = (ctx.words as string[] | undefined) ?? [];
        const clues: Record<string, string> = {};
        for (const w of words) {
          const key = String(w);
          clues[key] = `A term related to today's puzzle theme (${key.length} letters).`;
        }
        data = clues;
        break;
      }
      case "metadata": {
        const title = String(ctx.title ?? "My New Book");
        const topic = String(ctx.topic ?? "a fun theme");
        data = {
          title,
          subtitle: `A Large Print Activity Book for ${String(ctx.audience ?? "All Ages")}`,
          description:
            `Enjoy hours of original, ${topic}-themed activities in this specially designed ` +
            `book. Every puzzle is crafted for the whole family and includes a full answer key.`,
          keywords: [
            topic.toLowerCase(),
            "activity book",
            "puzzle book",
            "large print",
            "gift idea",
            "brain games",
            "for adults",
          ].slice(0, 7),
          categories: ["Puzzles & Games / General", "Games & Activities / Puzzles"],
          features: [
            "Large, easy-to-read print",
            "Complete answer key included",
            "Original, family-friendly content",
            "High-quality print-ready layout",
          ],
          backCoverText: `A delightful collection of ${topic}-themed puzzles for hours of entertainment.`,
        };
        break;
      }
      case "cover_copy": {
        data = {
          tagline: `Original ${String(ctx.topic ?? "puzzle")} fun for everyone`,
        };
        break;
      }
      case "coloring_prompt": {
        const topic = String(ctx.topic ?? "a friendly scene");
        const audience = String(ctx.audience ?? "all ages");
        const ordinal = Number(ctx.ordinal ?? 0);
        const usedSubjects = (ctx.usedSubjects as string[] | undefined) ?? [];
        const subject = pickColoringSubject(topic, ordinal, usedSubjects, rng);
        data = {
          subject,
          prompt: `Simple black-and-white line art coloring page of ${subject}, bold clean outlines, no shading, ` +
            `no text, original non-copyrighted design suitable for ${audience}.`,
        };
        break;
      }
      default: {
        data = { text: `Mock content for: ${prompt.slice(0, 120)}` };
      }
    }

    const json = JSON.stringify(data);
    return { data: data as T, usage: textUsage(prompt, json) };
  }

  async generateImage(prompt: string, options?: AIImageOptions): Promise<AIImageResult> {
    const width = options?.width ?? 800;
    const height = options?.height ?? 800;
    const seed = seedFromString(prompt);
    const rng = createRng(seed);
    const hue = Math.floor(rng() * 360);
    // A tiny inline SVG placeholder stands in for real generated artwork in dev/mock mode.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="white"/>
      <circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 3}" fill="none" stroke="hsl(${hue},60%,40%)" stroke-width="6"/>
      <text x="50%" y="95%" font-size="14" text-anchor="middle" fill="#999">Mock illustration placeholder</text>
    </svg>`;
    const url = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    return { url, usage: { inputTokens: Math.round(prompt.length / 4), outputTokens: 0 } };
  }
}
