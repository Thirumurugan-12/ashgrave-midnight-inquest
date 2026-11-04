// Generates the game's art with Meta's Muse Image model, in one shared style so the
// scenes and portraits look like one game. Writes ui/public/art/<id>.webp.
//   npm run art               all missing images
//   npm run art -- vale study regenerate just these
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import OpenAI from "openai";

const STYLE =
  "Original artwork for a gothic Victorian mystery game. Painterly digital oil painting, rich brushwork, candlelit chiaroscuro, palette of deep green-black shadows, warm amber candlelight and cold moonlight blue, rain and mist, cinematic composition, highly detailed, atmospheric. No text, no letters, no watermark, no frame.";

const SCENE = "1792x1024";
const PORTRAIT = "768x1024";

export const ART: Record<string, { size: string; prompt: string }> = {
  title: { size: SCENE, prompt: "A vast gothic manor house on the Yorkshire moors at night in a violent storm, one tall glass conservatory glowing amber, lightning over the moors, a winding gravel drive, wet black trees." },
  conservatory: { size: SCENE, prompt: "Interior of a Victorian glass conservatory at night, rain streaming down tall arched glass panes, exotic palms and orchids in shadow, an empty velvet chaise longue with a fallen silk shawl, a silver tray on a side table, a small writing desk in an alcove, candles guttering, mist on the tiled floor. Eye-level view, wide." },
  study: { size: SCENE, prompt: "A dark wood-panelled Victorian gentleman's study at night, a dying fire in a stone fireplace with glowing embers and ash, a leather armchair, shelves of old botanical books, a desk with a doctor's black medical bag and small brown medicine bottles, a green banker's lamp. Wide, eye-level." },
  kitchen: { size: SCENE, prompt: "A Victorian manor kitchen and scullery below stairs at night, a deep stone sink, a wooden drying rack with a single crystal glass, copper pans on the wall, a black iron range with a faint glow, flagstone floor, a single oil lamp. Wide, eye-level." },
  greenhouse: { size: SCENE, prompt: "A Victorian glass greenhouse at night lit by one lantern, rows of potted rare orchids, a locked bed of tall purple foxglove flowers, a half-packed wooden crate with straw, gardening tools, rain on the glass roof. Wide, eye-level." },
  "back-door": { size: SCENE, prompt: "A Victorian servants' entrance and boot room at night, a heavy wooden door ajar to the rain, coats on hooks, a pair of mud-caked work boots on the stone floor, a lantern on a hook, puddles. Wide, eye-level." },
  "clara-room": { size: SCENE, prompt: "A young Victorian lady's bedroom in an east wing at night, a canopy bed, a dressing table with a mirror and perfume bottles, a dark rain-soaked cloak thrown over a chair, playing cards scattered, moonlight through a rain-streaked window. Wide, eye-level." },
  lab: { size: SCENE, prompt: "A Victorian forensic chemistry laboratory at night, a long wooden bench with glass retorts, test tubes, bubbling flasks over spirit lamps, a brass microscope, jars of reagents, warm lamplight and green chemical glow. Wide, eye-level." },
  thomas: { size: PORTRAIT, prompt: "Half-length portrait of a rugged Yorkshire head gardener aged about 41, weathered face, short beard, flat cap, rolled shirtsleeves, leather apron with soil stains, wary guarded eyes, standing in a dark greenhouse, lantern light from the side." },
  clara: { size: PORTRAIT, prompt: "Half-length portrait of a striking Victorian young woman aged 24, dark hair pinned up with loose strands, sharp clever eyes, a defiant half-smile hiding fear, dark green silk evening dress, a ring on her finger, candlelit drawing room behind her." },
  vale: { size: PORTRAIT, prompt: "Half-length portrait of a distinguished Victorian physician aged 50, silver-streaked hair, neatly trimmed beard, round gold-rimmed spectacles, black frock coat and waistcoat with a watch chain, calm courteous expression with cold eyes, a dark study behind him." },
  holloway: { size: PORTRAIT, prompt: "Half-length portrait of a stern devout Victorian housekeeper aged 58, grey hair in a tight bun under a white cap, black dress with a white apron, a ring of keys at her waist, anxious tight-lipped expression, servants' corridor with an oil lamp behind her." },
  ghost: { size: PORTRAIT, prompt: "Half-length portrait of the translucent ghost of an elegant Victorian lady botanist aged 62, silver hair, pale glowing blue-white figure fading into mist, sorrowful eyes, holding a single black orchid, the dark conservatory faintly visible through her." },
};

const client = new OpenAI({ baseURL: "https://api.meta.ai/v1", apiKey: process.env.MODEL_API_KEY });
const outDir = "ui/public/art";
mkdirSync(outDir, { recursive: true });

const only = process.argv.slice(2);
const todo = Object.entries(ART).filter(([id]) => (only.length ? only.includes(id) : !existsSync(`${outDir}/${id}.webp`)));
console.log(`Generating ${todo.length} image(s) with muse-image-1.0…`);

async function make(id: string, size: string, prompt: string): Promise<void> {
  const res = await client.images.generate({
    model: "muse-image-1.0",
    prompt: `${prompt} ${STYLE}`,
    n: 1,
    size: size as "1024x1024", // Meta only reads the aspect ratio
    response_format: "b64_json",
    output_format: "webp",
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error(`no image data for ${id}`);
  writeFileSync(`${outDir}/${id}.webp`, Buffer.from(b64, "base64"));
  console.log(`✓ ${id}`);
}

// A few at a time.
const queue = [...todo];
await Promise.all(
  Array.from({ length: 3 }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const [id, { size, prompt }] = job;
      try {
        await make(id, size, prompt);
      } catch (err) {
        console.error(`✗ ${id}: ${(err as Error).message}`);
      }
    }
  }),
);
