import { describe, test, expect, afterEach } from "bun:test";
import { startHitlBridge, stopHitlBridge } from "../hitl-bridge";
import { resolvePendingHitl } from "../hitl";

let nextPort = 13456;
function getPort() {
  return nextPort++;
}

afterEach(() => {
  stopHitlBridge();
});

describe("HITL Bridge", () => {
  test("POST /approve でHITLメッセージを送信し回答を返す", async () => {
    const port = getPort();
    const posted: { channel: string; text: string; blocks: unknown[] }[] = [];

    const mockClient = {
      chat: {
        postMessage: async (args: Record<string, unknown>) => {
          posted.push(args as { channel: string; text: string; blocks: unknown[] });
        },
      },
    };

    startHitlBridge(port, mockClient, "C_TEST_HITL");

    const fetchPromise = fetch(`http://localhost:${port}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "rm -rf /tmp/test" }),
    });

    // Wait for the HITL message to be posted
    while (posted.length === 0) {
      await new Promise((r) => setTimeout(r, 10));
    }

    expect(posted[0].channel).toBe("C_TEST_HITL");
    const blocks = posted[0].blocks as { type: string; elements?: { action_id?: string }[] }[];
    const actionsBlock = blocks.find((b) => b.type === "actions");
    const yesActionId = actionsBlock?.elements?.[0]?.action_id;
    expect(yesActionId).toBeDefined();
    const requestId = yesActionId!.split(":")[2];
    resolvePendingHitl(requestId, "はい");

    const res = await fetchPromise;
    const data = (await res.json()) as { approved: boolean; answer: string };
    expect(data.approved).toBe(true);
    expect(data.answer).toBe("はい");
  });

  test("POST /approve で拒否された場合", async () => {
    const port = getPort();
    const posted: Record<string, unknown>[] = [];
    const mockClient = {
      chat: {
        postMessage: async (args: Record<string, unknown>) => {
          posted.push(args);
        },
      },
    };

    startHitlBridge(port, mockClient, "C_TEST_HITL");

    const fetchPromise = fetch(`http://localhost:${port}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "danger" }),
    });

    while (posted.length === 0) {
      await new Promise((r) => setTimeout(r, 10));
    }

    const blocks = posted[0].blocks as { type: string; elements?: { action_id?: string }[] }[];
    const actionsBlock = blocks.find((b) => b.type === "actions");
    const noActionId = actionsBlock?.elements?.[1]?.action_id;
    const requestId = noActionId!.split(":")[2];
    resolvePendingHitl(requestId, "いいえ");

    const res = await fetchPromise;
    const data = (await res.json()) as { approved: boolean };
    expect(data.approved).toBe(false);
  });

  test("GET は405を返す", async () => {
    const port = getPort();
    startHitlBridge(port, { chat: { postMessage: async () => {} } }, "C");
    const res = await fetch(`http://localhost:${port}/approve`);
    expect(res.status).toBe(405);
  });

  test("存在しないパスは404", async () => {
    const port = getPort();
    startHitlBridge(port, { chat: { postMessage: async () => {} } }, "C");
    const res = await fetch(`http://localhost:${port}/other`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });
});
