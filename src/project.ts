import { z } from "zod";
import { readdir } from "node:fs/promises";
import { resolve, join } from "node:path";

// --------------------------------------------------
// Schema
// --------------------------------------------------

export const projectConfigSchema = z.object({
  name: z.string(),
  channelId: z.string(),
  channelName: z.string().optional(),
  description: z.string().optional(),
  github: z
    .object({
      owner: z.string(),
      repo: z.string(),
    })
    .optional(),
  notion: z
    .object({
      databaseId: z.string(),
    })
    .optional(),
  createdAt: z.string(),
});

// --------------------------------------------------
// Types
// --------------------------------------------------

export type ProjectConfig = z.infer<typeof projectConfigSchema>;

export interface Project {
  slug: string;
  config: ProjectConfig;
}

// --------------------------------------------------
// Paths
// --------------------------------------------------

const PROJECTS_DIR =
  process.env.AIPM_PROJECTS_DIR ||
  resolve(import.meta.dir, "..", "projects");

export function getProjectsDir(): string {
  return PROJECTS_DIR;
}

export function getProjectKnowledgeDir(slug: string): string {
  return join(PROJECTS_DIR, slug, "knowledge");
}

// --------------------------------------------------
// Loaders
// --------------------------------------------------

export async function loadProject(slug: string): Promise<Project> {
  const modPath = join(PROJECTS_DIR, slug, "project.ts");
  const mod = await import(modPath);
  const raw = mod.default ?? mod;
  const config = projectConfigSchema.parse(raw);
  return { slug, config };
}

export async function loadProjects(): Promise<Project[]> {
  let entries: string[];
  try {
    entries = await readdir(PROJECTS_DIR);
  } catch {
    return [];
  }

  const projects: Project[] = [];
  for (const entry of entries) {
    try {
      const project = await loadProject(entry);
      projects.push(project);
    } catch {
      // skip invalid directories
    }
  }
  return projects;
}

export async function findProjectByChannel(
  channelId: string,
): Promise<Project | undefined> {
  const projects = await loadProjects();
  return projects.find((p) => p.config.channelId === channelId);
}
