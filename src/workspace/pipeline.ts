import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type PipelineState = { status: "IDLE" | "RUNNING" | "COMPLETE" | "FAILED"; lastRunAt?: string; error?: string };

const filePath = path.join(process.cwd(), "storage/pipeline.json");

export async function getPipelineState(): Promise<PipelineState> {
  try { return JSON.parse(await readFile(filePath, "utf8")) as PipelineState; }
  catch { return { status: "IDLE" }; }
}

export async function setPipelineState(state: PipelineState): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(state, null, 2));
}
