import Anthropic from "@anthropic-ai/sdk";

export interface AIScene {
  text: string;
  searchTerms: string[];
}

export interface AIVideoScript {
  scenes: AIScene[];
  config: {
    voice: string;
    music: string;
    captionPosition: "top" | "center" | "bottom";
    captionBackgroundColor: string;
    orientation: "portrait" | "landscape";
    paddingBack: number;
    musicVolume: "muted" | "low" | "medium" | "high";
  };
}

export async function generateScriptWithAI(
  topic: string,
): Promise<AIVideoScript> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["scenes", "config"],
          properties: {
            scenes: {
              type: "array",
              minItems: 2,
              maxItems: 6,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["text", "searchTerms"],
                properties: {
                  text: { type: "string" },
                  searchTerms: {
                    type: "array",
                    minItems: 1,
                    maxItems: 3,
                    items: { type: "string" },
                  },
                },
              },
            },
            config: {
              type: "object",
              additionalProperties: false,
              required: [
                "voice",
                "music",
                "captionPosition",
                "captionBackgroundColor",
                "orientation",
                "paddingBack",
                "musicVolume",
              ],
              properties: {
                voice: { type: "string" },
                music: { type: "string" },
                captionPosition: {
                  type: "string",
                  enum: ["top", "center", "bottom"],
                },
                captionBackgroundColor: { type: "string" },
                orientation: {
                  type: "string",
                  enum: ["portrait", "landscape"],
                },
                paddingBack: { type: "number" },
                musicVolume: {
                  type: "string",
                  enum: ["muted", "low", "medium", "high"],
                },
              },
            },
          },
        },
      },
    },
    system: `You write scripts for short-form social media videos (TikTok / YouTube Shorts / Reels).
Each scene is 1–2 sentences of natural spoken narration (not too long — each scene is ~5–10 seconds of speech).
searchTerms are 1–3 keywords used to find background stock video footage — keep them concrete and visual (e.g. "ocean waves", "city skyline at night").

Available voices: af_heart, af_bella, af_nicole, af_sarah, af_sky, am_adam, am_michael, bf_emma, bf_isabella, bm_george, bm_lewis
Available music tags: action, adventure, ambient, calm, cheerful, cinematic, corporate, dramatic, electronic, emotional, energetic, epic, fun, happy, inspiring, jazz, lo-fi, melancholic, motivational, peaceful, playful, pop, relaxing, romantic, sad, suspense, uneasy, upbeat, uplifting

Pick voice, music, and colors that match the topic's mood.
Respond with valid JSON only.`,
    messages: [
      {
        role: "user",
        content: `Create a short video script about: ${topic}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  return JSON.parse(textBlock.text) as AIVideoScript;
}
