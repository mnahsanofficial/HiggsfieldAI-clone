// Seeds the public media library with real FLUX.1 [schnell] generations, through the same
// provider -> crop -> private Blob pipeline users get. Idempotent: each seed has a stable
// slug in its storage path (seed/<section>-<n>-...), and existing slugs are skipped.
// Stops cleanly on quota exhaustion; re-run later to finish.
// run: npx tsx --conditions react-server scripts/seed-library.ts [--limit N]
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

// Original prompts only: no real people, brands, logos or artist names.
const SEEDS: Record<string, { aspect: string; prompts: string[] }> = {
  portrait: {
    aspect: "3:4",
    prompts: [
      "editorial fashion portrait of a woman in an oversized silver puffer jacket, overcast rooftop, soft film grain",
      "close-up portrait of a man with freckles and a knitted beanie, warm window light, 35mm film look",
      "fashion photo of a model in a sculptural red dress against a pale blue studio wall, hard flash",
      "portrait of an elderly fisherman with a weathered face and yellow raincoat, harbour at dawn",
      "street style portrait of a young woman with bleached short hair and chrome sunglasses, neon reflections",
      "moody portrait of a dancer mid-turn, black background, motion blur on the fabric, rim light",
      "portrait of a skateboarder sitting on a concrete ledge at golden hour, candid, shallow depth of field",
      "high fashion portrait with a sheer white veil blowing in the wind, desert dunes, minimal",
      "portrait of a chef in a busy night kitchen, steam and orange light, documentary style",
      "portrait of a woman in a lime green trench coat on a rainy crosswalk, cinematic colour grade",
      "black and white portrait of a jazz trumpet player on a smoky stage, dramatic spotlight",
      "portrait of a teenager with a vintage film camera in a sunflower field, dreamy pastel tones",
    ],
  },
  cinema: {
    aspect: "16:9",
    prompts: [
      "cinematic wide shot of a lone astronaut walking across a red desert at sunset, anamorphic lens flare",
      "film still of a detective under a flickering streetlight in heavy rain, 1970s noir colour grade",
      "cinematic shot of a vintage train crossing a snowy mountain bridge at dawn, mist in the valley",
      "film still of two friends on a moped racing through a narrow coastal town, summer haze",
      "cinematic interior of an abandoned ballroom with a single chandelier lit, dust in light beams",
      "wide shot of a lighthouse on black volcanic rocks under a violet storm sky, epic scale",
      "film still of a diner at 3am, a waitress pouring coffee, neon sign glowing through the window",
      "cinematic aerial view of a winding road through an autumn forest, fog, soft morning light",
      "film still of a girl holding a red balloon in a grey brutalist housing estate, muted palette",
      "cinematic shot of a samurai standing in a bamboo forest during a windstorm, green tones",
      "film still of a crowded night market with lanterns and steam, shallow depth of field",
      "cinematic close shot of hands playing a grand piano on an empty theatre stage, blue light",
    ],
  },
  street: {
    aspect: "9:16",
    prompts: [
      "vertical street photo of a cyclist passing a graffiti wall in harsh afternoon light, bold shadows",
      "tokyo-style alley at night with vending machines glowing and wet pavement reflections",
      "vertical photo of a skateboarder mid-ollie over a stair set, fisheye lens, blue sky",
      "rainy city sidewalk from above, colourful umbrellas crossing a zebra crossing",
      "vertical photo of a vintage car parked in front of a pink stucco building, palm shadows",
      "subway platform with a train arriving, motion blur, commuters silhouetted",
      "rooftop basketball court at sunset with the city skyline behind, warm tones",
      "vertical photo of a flower stall on a foggy morning street, soft pastel colours",
      "night street with a food truck glowing orange and people queueing, candid",
      "vertical shot of laundry lines strung between old apartment buildings, blue hour",
    ],
  },
  product: {
    aspect: "1:1",
    prompts: [
      "product photo of a matte black perfume bottle on wet stone with water droplets, studio lighting",
      "product shot of colourful sneakers floating mid-air against a lime green background, playful",
      "minimal product photo of a ceramic coffee mug with steam, soft morning light, beige backdrop",
      "product photo of a glass skincare bottle surrounded by sliced citrus fruit, bright and fresh",
      "product shot of wireless headphones on a mirrored surface with purple gradient light",
      "product photo of a handmade chocolate bar broken in pieces with cocoa dust, dark moody",
      "product shot of a vintage film camera on a wooden desk with polaroid photos scattered",
      "product photo of an iced lemonade can in crushed ice with condensation, summer vibe",
      "product shot of a leather backpack on a mountain trail rock, adventure lifestyle",
      "product photo of a ceramic vase with dried flowers, terracotta and cream tones, editorial",
    ],
  },
  fantasy: {
    aspect: "16:9",
    prompts: [
      "giant jellyfish floating over a neon city at night, glowing tendrils, surreal",
      "a whale swimming through clouds above a small fishing village, magical realism",
      "explosion of colourful paint powder around a dancer frozen in time, high speed photo",
      "ancient temple overgrown with bioluminescent plants inside a cave, volumetric light",
      "a car made of liquid chrome melting on a desert highway, heat shimmer",
      "a floating island with a waterfall pouring into the sky, golden hour, epic fantasy",
      "a city street turning into a giant wave that curls over the buildings, surreal",
      "glass greenhouse on the moon with earth rising behind it, cinematic sci-fi",
      "a phoenix made of fire rising from a frozen lake at night, sparks and ice",
      "a mechanical dragon perched on a skyscraper during a thunderstorm, dramatic",
    ],
  },
  poster: {
    aspect: "16:9",
    prompts: [
      "moody key art of a lone rider on horseback in a dust storm, warm orange palette, film poster style without text",
      "key art of a crew of mismatched heroes on a stormy pirate ship deck, adventure film style without text",
      "key art of a girl and a giant robot sitting on a hill watching a sunset, animated film style without text",
      "key art of a detective silhouetted in a doorway with red light behind, thriller film style without text",
      "key art of wolves surrounding a child in a snowy forest, folk tale film style without text",
      "key art of dancers in a rain-soaked neon plaza, musical film style without text",
      "key art of an old lighthouse keeper and a sea monster, whimsical film style without text",
      "key art of a spaceship crashed in a jungle with explorers approaching, sci-fi film style without text",
    ],
  },
  nature: {
    aspect: "4:3",
    prompts: [
      "aerial photo of turquoise glacier rivers braiding across black sand, abstract patterns",
      "red fox in a snowy meadow at sunrise, soft backlight, wildlife photography",
      "misty pine forest with sunbeams breaking through, calm and quiet",
      "macro photo of a dew-covered spider web with rainbow refraction",
      "lavender field under a starry night sky with the milky way, long exposure",
      "tropical beach from above with a single yellow kayak on clear water",
    ],
  },
};

async function main() {
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;

  const { sql } = await import("drizzle-orm");
  const { db, pool } = await import("../src/db");
  const { assets } = await import("../src/db/schema");
  const { cloudflareProvider } = await import("../src/lib/jobs/providers/cloudflare");
  const { ProviderError } = await import("../src/lib/jobs/providers/types");
  const { cropToAspect } = await import("../src/lib/jobs/image");
  const { uploadMedia } = await import("../src/lib/storage");

  const existing = new Set(
    (await db.select({ url: assets.url }).from(assets).where(sql`${assets.url} LIKE '/media/seed/%' AND ${assets.userId} IS NULL`)).map(
      (r) => r.url.replace(/^\/media\/seed\//, "").replace(/-[A-Za-z0-9]{20,}\.jpg$/, ""),
    ),
  );

  const todo = Object.entries(SEEDS).flatMap(([section, { aspect, prompts }]) =>
    prompts.map((prompt, i) => ({ slug: `${section}-${String(i + 1).padStart(2, "0")}`, section, aspect, prompt })),
  ).filter((s) => !existing.has(s.slug)).slice(0, limit);

  console.log(`${existing.size} seeds exist, generating ${todo.length}`);
  let done = 0;
  let stop = false;

  const worker = async () => {
    while (!stop) {
      const item = todo.shift();
      if (!item) return;
      const t = Date.now();
      try {
        const image = await cloudflareProvider.generate({ modelRef: "@cf/black-forest-labs/flux-1-schnell", prompt: item.prompt });
        const cropped = await cropToAspect(image.bytes, item.aspect);
        const { url } = await uploadMedia(`seed/${item.slug}.jpg`, cropped.bytes, "image/jpeg");
        await db.insert(assets).values({
          userId: null,
          kind: "image",
          source: "generated",
          url,
          width: cropped.width,
          height: cropped.height,
          modelId: "flux_1_schnell",
          prompt: item.prompt,
          collection: "seed",
          topic: item.section,
          aspect: item.aspect,
          isPublic: true,
        });
        done++;
        console.log(`ok   ${item.slug} ${cropped.width}x${cropped.height} ${(cropped.bytes.length / 1024).toFixed(0)}KB ${Date.now() - t}ms`);
      } catch (err) {
        if (err instanceof ProviderError && (err.code === "quota_exhausted" || err.code === "rate_limited")) {
          console.log(`STOP ${item.slug}: ${err.code}. Re-run later to finish.`);
          stop = true;
        } else {
          console.log(`fail ${item.slug}: ${err instanceof ProviderError ? `${err.code} ${JSON.stringify(err.detail)}` : String(err)}`);
        }
      }
    }
  };

  await Promise.all([worker(), worker(), worker()]);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(assets).where(sql`${assets.url} LIKE '/media/seed/%' AND ${assets.userId} IS NULL`);
  console.log(`generated ${done}; library now has ${n} public seed images`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
