#!/usr/bin/env npx ts-node
/**
 * AI-powered short video generator
 * Usage: ANTHROPIC_API_KEY=... npx ts-node scripts/make-video.ts "your topic here"
 *
 * Generates a script with Claude, renders it via the short-video-maker API,
 * and downloads the finished video.
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

const SERVER_URL = process.env.VIDEO_SERVER_URL ?? "http://localhost:3123";
const OUTPUT_DIR = path.join(process.cwd(), "output");

// ─── Types ────────────────────────────────────────────────────────────────────

interface Scene {
  text: string;
  searchTerms: string[];
}

interface VideoConfig {
  voice: string;
  music: string;
  captionPosition: "top" | "center" | "bottom";
  captionBackgroundColor: string;
  orientation: "portrait" | "landscape";
  paddingBack: number;
  musicVolume: "muted" | "low" | "medium" | "high";
}

interface VideoScript {
  scenes: Scene[];
  config: VideoConfig;
}

// ─── Step 1: Generate script with Claude ──────────────────────────────────────

async function generateScript(topic: string): Promise<VideoScript> {
  const client = new Anthropic();

  console.log(`\n📝 Generating script for: "${topic}"...`);

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
                captionPosition: { type: "string", enum: ["top", "center", "bottom"] },
                captionBackgroundColor: { type: "string" },
                orientation: { type: "string", enum: ["portrait", "landscape"] },
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

  return JSON.parse(textBlock.text) as VideoScript;
}

// ─── Step 2: Submit to short-video-maker API ──────────────────────────────────

async function submitVideo(script: VideoScript): Promise<string> {
  console.log(`\n🎬 Submitting ${script.scenes.length} scenes to renderer...`);

  const res = await fetch(`${SERVER_URL}/api/short-video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(script),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Submission failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { videoId: string };
  console.log(`   Video ID: ${data.videoId}`);
  return data.videoId;
}

// ─── Step 3: Poll until done ──────────────────────────────────────────────────

type VideoStatus = "queued" | "processing" | "done" | "error";

async function waitForVideo(videoId: string): Promise<void> {
  const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const POLL_MS = 3000;

  while (true) {
    await new Promise((r) => setTimeout(r, POLL_MS));

    const res = await fetch(`${SERVER_URL}/api/short-video/${videoId}/status`);
    if (!res.ok) throw new Error(`Status check failed: ${res.status}`);

    const data = (await res.json()) as { status: VideoStatus; progress?: number };
    const pct = data.progress != null ? ` ${Math.round(data.progress * 100)}%` : "";
    process.stdout.write(`\r   ${spinner[i++ % spinner.length]} ${data.status}${pct}   `);

    if (data.status === "done") {
      process.stdout.write("\r   ✅ done              \n");
      return;
    }
    if (data.status === "error") {
      throw new Error("Renderer reported an error — check server logs.");
    }
  }
}

// ─── Step 4: Download the video ───────────────────────────────────────────────

async function downloadVideo(videoId: string, topic: string): Promise<string> {
  const res = await fetch(`${SERVER_URL}/api/short-video/${videoId}/download`);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const filename = path.join(OUTPUT_DIR, `${slug}-${videoId.slice(-6)}.mp4`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filename, buffer);
  return filename;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const topic = process.argv.slice(2).join(" ").trim();
  if (!topic) {
    console.error("Usage: npx ts-node scripts/make-video.ts <topic>");
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is not set.");
    process.exit(1);
  }

  try {
    // 1. Generate script
    const script = await generateScript(topic);
    console.log("\nGenerated script preview:");
    script.scenes.forEach((s, i) => {
      console.log(`  Scene ${i + 1}: "${s.text.slice(0, 60)}..." [${s.searchTerms.join(", ")}]`);
    });
    console.log(`  Voice: ${script.config.voice} | Music: ${script.config.music} | Orientation: ${script.config.orientation}`);

    // 2. Submit
    const videoId = await submitVideo(script);

    // 3. Wait
    console.log("\n⏳ Rendering (this takes ~1–3 minutes)...");
    await waitForVideo(videoId);

    // 4. Download
    console.log("\n⬇️  Downloading...");
    const outputPath = await downloadVideo(videoId, topic);
    console.log(`\n✨ Done! Video saved to:\n   ${outputPath}\n`);
  } catch (err) {
    console.error("\n❌ Error:", (err as Error).message);
    process.exit(1);
  }
}

main();
