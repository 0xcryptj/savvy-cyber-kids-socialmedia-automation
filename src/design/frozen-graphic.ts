import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { renderTemplateGraphic } from "./og-graphic";
import { WorkspacePost } from "@/src/workspace/types";
import { blobs } from "@/src/storage";

const generatedDirectory = path.join(process.cwd(), "storage/generated");

function graphicInput(post: WorkspacePost) {
  return {
    topicHeading: post.topicHeading,
    articleTitle: post.articleTitle,
    imageUrl: post.generatedImageUrl || post.featuredImageUrl,
    graphicGuidance: post.graphicGuidance,
    sourceImageHasText: post.sourceImageHasText,
    adjustments: post.graphicAdjustments
  };
}

export async function freezePostGraphic(post: WorkspacePost): Promise<string> {
  const filename = `${post.id}.png`;
  const bytes = Buffer.from(await (await renderTemplateGraphic(graphicInput(post))).arrayBuffer());
  if (process.env.NODE_ENV === "production" && (process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN)) {
    await blobs.write(`generated/${filename}`, bytes, "image/png");
  } else {
    await mkdir(generatedDirectory, { recursive: true });
    await writeFile(path.join(generatedDirectory, filename), bytes);
  }
  return `storage/generated/${filename}`;
}

export async function readFrozenGraphic(relativePath: string): Promise<Uint8Array<ArrayBuffer>> {
  const filename = path.basename(relativePath);
  if (relativePath !== `storage/generated/${filename}`) throw new Error("Invalid frozen graphic path");
  const file = process.env.NODE_ENV === "production" && (process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN)
    ? await blobs.read(`generated/${filename}`)
    : await readFile(path.join(generatedDirectory, filename));
  if (!file) throw new Error("Frozen graphic not found");
  // A Node Buffer is not structurally a BodyInit/BlobPart, and a view onto its
  // pooled backing store types as ArrayBufferLike. Copy into a plain array.
  return Uint8Array.from(file);
}
