import { appendFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const GUARD_LOGS_DIR =
  process.env.MIMAMORI_GUARD_LOGS_DIR ||
  resolve(import.meta.dir, "..", "guard-logs");

export interface GuardLogEntry {
  ts: string;
  channelId?: string;
  decision: "Y" | "N";
  message: string;
}

export async function logGuardDecision(
  decision: "Y" | "N",
  message: string,
  channelId?: string,
): Promise<void> {
  try {
    await mkdir(GUARD_LOGS_DIR, { recursive: true });

    const date = new Date().toISOString().split("T")[0];
    const filepath = join(GUARD_LOGS_DIR, `${date}.jsonl`);

    const entry: GuardLogEntry = {
      ts: new Date().toISOString(),
      channelId,
      decision,
      message: message.slice(0, 200),
    };

    await appendFile(filepath, JSON.stringify(entry) + "\n", "utf-8");
  } catch (error) {
    console.error("[guard-log] Write error:", error);
  }
}
