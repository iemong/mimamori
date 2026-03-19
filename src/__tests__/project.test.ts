import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  loadProject,
  loadProjects,
  findProjectByChannel,
  getProjectKnowledgeDir,
  getProjectsDir,
} from "../project";

const projectsDir = getProjectsDir();
const testSlug = "_test-proj";
const testProjectDir = join(projectsDir, testSlug);

beforeAll(async () => {
  await mkdir(join(testProjectDir, "knowledge"), { recursive: true });
  const config = `
import type { ProjectConfig } from "../../src/project";

const config = {
  name: "Test Project",
  channelId: "C_TEST_PROJ",
  channelName: "#test-proj",
  description: "テスト用プロジェクト",
  github: {
    owner: "test-owner",
    repo: "test-repo",
  },
  createdAt: "2026-01-01T00:00:00.000Z",
} as const satisfies ProjectConfig;

export default config;
`;
  await writeFile(join(testProjectDir, "project.ts"), config);
});

afterAll(async () => {
  await rm(testProjectDir, { recursive: true, force: true });
});

describe("loadProject", () => {
  test("プロジェクト設定を読み込める", async () => {
    const project = await loadProject(testSlug);
    expect(project.slug).toBe(testSlug);
    expect(project.config.name).toBe("Test Project");
    expect(project.config.channelId).toBe("C_TEST_PROJ");
    expect(project.config.channelName).toBe("#test-proj");
    expect(project.config.github?.owner).toBe("test-owner");
    expect(project.config.github?.repo).toBe("test-repo");
  });

  test("存在しないスラッグはエラー", async () => {
    expect(loadProject("nonexistent")).rejects.toThrow();
  });
});

describe("loadProjects", () => {
  test("全プロジェクトを読み込める", async () => {
    const projects = await loadProjects();
    const found = projects.find((p) => p.slug === testSlug);
    expect(found).toBeDefined();
    expect(found!.config.name).toBe("Test Project");
  });
});

describe("findProjectByChannel", () => {
  test("チャンネルIDからプロジェクトを逆引きできる", async () => {
    const project = await findProjectByChannel("C_TEST_PROJ");
    expect(project).toBeDefined();
    expect(project!.slug).toBe(testSlug);
  });

  test("存在しないチャンネルIDはundefined", async () => {
    const project = await findProjectByChannel("C_NONEXISTENT");
    expect(project).toBeUndefined();
  });
});

describe("getProjectKnowledgeDir", () => {
  test("knowledgeディレクトリのパスを返す", () => {
    const dir = getProjectKnowledgeDir("my-app");
    expect(dir).toContain("projects/my-app/knowledge");
  });
});
