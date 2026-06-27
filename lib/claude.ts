// Single, thin wrapper around the official Anthropic SDK. This is the ONLY place
// the app talks to Claude. Every caller (transcript structuring, match
// explanations, smart search, translation) must provide its own non-Claude
// fallback so the whole app keeps working when ANTHROPIC_API_KEY is not set.
//
// Design rule: askClaude() never throws. It returns the response text, or null
// when there is no API key or the call fails for any reason.

import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

// Next.js auto-loads .env.local at runtime, but loading it here too means this
// module also works when imported from a plain `tsx` script. dotenv never
// overrides variables that are already set, so this is safe and idempotent.
dotenv.config({ path: ".env.local" });
dotenv.config();

const DEFAULT_MODEL = "claude-sonnet-4-6";

/** True when an API key is configured — used by routes to label fallback mode. */
export function claudeConfigured(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return !!key && key.trim() !== "" && key.trim() !== "your_key_here";
}

export function claudeModel(): string {
  return process.env.CLAUDE_MODEL || DEFAULT_MODEL;
}

/**
 * Sends a single-turn request to Claude. Returns the concatenated text content,
 * or null if no key is configured or the request fails.
 */
export async function askClaude(
  systemPrompt: string,
  userContent: string,
  maxTokens = 1000
): Promise<string | null> {
  if (!claudeConfigured()) return null;
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: claudeModel(),
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    });
    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    return text || null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Claude request failed — falling back:", err);
    return null;
  }
}

/**
 * Helper for callers that expect strict JSON back. Strips ```json fences and
 * extracts the first {...} object, then parses. Returns null on any failure so
 * the caller can use its deterministic fallback.
 */
export function parseClaudeJson<T = unknown>(text: string | null): T | null {
  if (!text) return null;
  let cleaned = text.trim();
  // Remove code fences if present.
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  // Extract the outermost JSON object if there is surrounding prose.
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    cleaned = cleaned.slice(first, last + 1);
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
