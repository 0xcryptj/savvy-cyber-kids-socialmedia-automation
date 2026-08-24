import { documents } from "@/src/storage";

export type PipelineState = { status: "IDLE" | "RUNNING" | "COMPLETE" | "FAILED"; lastRunAt?: string; error?: string };

export async function getPipelineState(): Promise<PipelineState> {
  return (await documents.read<PipelineState>("pipeline")) ?? { status: "IDLE" };
}

export async function setPipelineState(state: PipelineState): Promise<void> {
  await documents.write("pipeline", state);
}
