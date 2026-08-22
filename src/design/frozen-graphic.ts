import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { renderTemplateGraphic } from "./og-graphic";
import { WorkspacePost } from "@/src/workspace/types";

const generatedDirectory = path.join(process.cwd(), "storage/generated");

function graphicInput(post: WorkspacePost) {
  return {
    topicHeading: post.topicHeading,
    articleTitle: post.articleTitle,
    imageUrl: post.generatedImageUrl || post.featuredImageUrl,
    graphicGuidance: post.graphicGuidance
  };
}

export async function freezePostGraphic(post: WorkspacePost): Promise<string> {
  await mkdir(generatedDirectory, { recursive: true });
  const filename = `${post.id}.png`;
  await writeFile(path.join(generatedDirectory, filename), Buffer.from(await (await renderTemplateGraphic(graphicInput(post))).arrayBuffer()));
  return `storage/generated/${filename}`;
}

export async function readFrozenGraphic(relativePath: string): Promise<Buffer> {
  const filename = path.basename(relativePath);
  if (relativePath !== `storage/generated/${filename}`) throw new Error("Invalid frozen graphic path");
  return readFile(path.join(generatedDirectory, filename));
}
