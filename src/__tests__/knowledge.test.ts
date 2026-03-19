import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { saveDecision, listDecisions, readDecision } from "../knowledge";
import { getProjectsDir } from "../project";

const testChannel = "C_TEST_CHANNEL";

describe("saveDecision", () => {
  test("ADRファイルをチャンネルディレクトリに作成する", async () => {
    const filepath = await saveDecision(testChannel, "質問?", "回答", "背景");
    expect(filepath).toMatch(/C_TEST_CHANNEL\/.*\.md$/);
    const content = await readFile(filepath, "utf-8");
    expect(content).toContain("## Question");
    expect(content).toContain("質問?");
    expect(content).toContain("## Decision");
    expect(content).toContain("回答");
    expect(content).toContain("## Context");
    expect(content).toContain("背景");
  });

  test("contextなし", async () => {
    const filepath = await saveDecision(testChannel, "Q", "A");
    const content = await readFile(filepath, "utf-8");
    expect(content).not.toContain("## Context");
  });

  test("タグ付き", async () => {
    const filepath = await saveDecision(testChannel, "Q", "A", undefined, ["t1", "t2"]);
    const content = await readFile(filepath, "utf-8");
    expect(content).toContain('"t1"');
    expect(content).toContain('"t2"');
  });
});

describe("listDecisions", () => {
  test("mdファイル一覧を降順で返す", async () => {
    await saveDecision(testChannel, "a", "b");
    const files = await listDecisions(testChannel);
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((f) => f.endsWith(".md"))).toBe(true);
    for (let i = 1; i < files.length; i++) {
      expect(files[i - 1] >= files[i]).toBe(true);
    }
  });

  test("別チャンネルのADRは含まない", async () => {
    await saveDecision("C_OTHER", "other", "other");
    const files = await listDecisions(testChannel);
    expect(files.every((f) => f.endsWith(".md"))).toBe(true);
    const otherFiles = await listDecisions("C_OTHER");
    expect(otherFiles.length).toBeGreaterThan(0);
  });
});

describe("readDecision", () => {
  test("ファイル内容を読める", async () => {
    await saveDecision(testChannel, "読み取り", "テスト");
    const files = await listDecisions(testChannel);
    const content = await readDecision(testChannel, files[0]);
    expect(content).toContain("読み取り");
  });
});

// --------------------------------------------------
// プロジェクトスコープ
// --------------------------------------------------

const projSlug = "_test-knowledge-proj";
const projChannelId = "C_KNOWLEDGE_PROJ";
const projectsDir = getProjectsDir();
const projDir = join(projectsDir, projSlug);

describe("project-scoped knowledge", () => {
  beforeAll(async () => {
    await mkdir(join(projDir, "knowledge"), { recursive: true });
    const config = `
import type { ProjectConfig } from "../../src/project";
const config = {
  name: "Knowledge Test",
  channelId: "${projChannelId}",
  createdAt: "2026-01-01T00:00:00.000Z",
} as const satisfies ProjectConfig;
export default config;
`;
    await writeFile(join(projDir, "project.ts"), config);
  });

  afterAll(async () => {
    await rm(projDir, { recursive: true, force: true });
  });

  test("プロジェクトのknowledgeディレクトリにADRを保存する", async () => {
    const filepath = await saveDecision(projChannelId, "PQ", "PA", "PC");
    expect(filepath).toContain(`${projSlug}/knowledge/`);
    const content = await readFile(filepath, "utf-8");
    expect(content).toContain("PQ");
    expect(content).toContain("PA");
  });

  test("プロジェクトスコープでlistDecisionsが動作する", async () => {
    const files = await listDecisions(projChannelId);
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((f) => f.endsWith(".md"))).toBe(true);
  });

  test("プロジェクトスコープでreadDecisionが動作する", async () => {
    const files = await listDecisions(projChannelId);
    const content = await readDecision(projChannelId, files[0]);
    expect(content).toContain("PQ");
  });
});
