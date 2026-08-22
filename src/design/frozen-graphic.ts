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
    graphicGuidance: post.graphicGuidance,
    sourceImageHasText: post.sourceImageHasText
  };
}

export async function freezePostGraphic(post: WorkspacePost): Promise<string> {
  await mkdir(generatedDirectory, { recursive: true });
  const filename = `${post.id}.png`;
  await writeFile(path.join(generatedDirectory, filename), Buffer.from(await (await renderTemplateGraphic(graphicInput(post))).arrayBuffer()));
  return `storage/generated/${filename}`;
}

export async function readFrozenGraphic(relativePath: string): Promise<Uint8Array<ArrayBuffer>> {
  const filename = path.basename(relativePath);
  if (relativePath !== `storage/generated/${filename}`) throw new Error("Invalid frozen graphic path");
  const file = await readFile(path.join(generatedDirectory, filename));
  // A Node Buffer is not structurally a BodyInit/BlobPart, and a view onto its
  // pooled backing store types as ArrayBufferLike. Copy into a plain array.
  return Uint8Array.from(file);
}
