#!/usr/bin/env node
// Golden-file guard for the social graphic.
//
// `record` snapshots the graphics you have approved — the ones you looked at and
// said were good — as reference images plus the exact inputs that produced them.
// `verify` re-renders those same inputs and reports how far the output has
// drifted. A renderer change that quietly wrecks the composition shows up here
// as a large pixel difference instead of as a surprise in the review queue.
//
//   npm run graphics:record   # after approving graphics you are happy with
//   npm run graphics:verify   # before and after touching the renderer
//
// Verify fetches the original article images, so it needs network access. It is
// deliberately a script rather than a unit test for that reason.

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const root = process.cwd();
const referenceDir = path.join(root, "docs/graphic-reference/approved");
const manifestPath = path.join(root, "docs/graphic-reference/baseline.json");
const workspacePath = path.join(root, "storage/workspace.json");

// Reference images are stored downscaled: they exist to be looked at and
// diffed, not to be published.
const referenceWidth = 540;
const referenceHeight = 675;
// Re-encoding through JPEG costs a little fidelity, so allow a small floor.
const differenceTolerance = 1.5;

async function loadRenderer() {
  const { renderTemplateGraphic } = await import("../src/design/og-graphic.tsx");
  return renderTemplateGraphic;
}

function renderInput(post) {
  return {
    topicHeading: post.topicHeading,
    articleTitle: post.articleTitle,
    imageUrl: post.generatedImageUrl || post.featuredImageUrl,
    graphicGuidance: post.graphicGuidance,
    sourceImageHasText: post.sourceImageHasText
  };
}

async function renderToPng(renderTemplateGraphic, input) {
  const response = await renderTemplateGraphic(input);
  return Buffer.from(await response.arrayBuffer());
}

async function toReference(png) {
  return sharp(png).resize(referenceWidth, referenceHeight, { fit: "fill" }).jpeg({ quality: 88 }).toBuffer();
}

/** Mean per-channel difference as a percentage of full scale. */
async function differencePercent(pngA, pngB) {
  const raw = (buffer) => sharp(buffer).resize(referenceWidth, referenceHeight, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const [a, b] = await Promise.all([raw(pngA), raw(pngB)]);
  if (a.length !== b.length) return 100;
  let total = 0;
  for (let index = 0; index < a.length; index += 1) total += Math.abs(a[index] - b[index]);
  return (total / a.length / 255) * 100;
}

async function record(excluded) {
  const { posts } = JSON.parse(await readFile(workspacePath, "utf8"));
  const approved = posts.filter((post) => post.status === "APPROVED" && !excluded.includes(post.id));
  if (!approved.length) throw new Error("No approved posts found in storage/workspace.json");

  const renderTemplateGraphic = await loadRenderer();
  await mkdir(referenceDir, { recursive: true });
  const entries = [];

  for (const post of approved) {
    const input = renderInput(post);
    const png = await renderToPng(renderTemplateGraphic, input);
    const file = `${post.id}.jpg`;
    await writeFile(path.join(referenceDir, file), await toReference(png));
    entries.push({ id: post.id, category: post.category, reference: file, input });
    console.log(`recorded ${post.id}  ${post.articleTitle.slice(0, 58)}`);
  }

  await writeFile(manifestPath, `${JSON.stringify({
    description: "Approved graphics accepted as the house standard. Regenerate with npm run graphics:record.",
    recordedAt: new Date().toISOString().slice(0, 10),
    referenceSize: { width: referenceWidth, height: referenceHeight },
    differenceTolerance,
    excluded,
    entries
  }, null, 2)}\n`);
  console.log(`\n${entries.length} reference graphics written to docs/graphic-reference/approved/`);
  if (excluded.length) console.log(`excluded: ${excluded.join(", ")}`);
}

async function verify() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const renderTemplateGraphic = await loadRenderer();
  const failures = [];

  for (const entry of manifest.entries) {
    const expected = await readFile(path.join(referenceDir, entry.reference));
    let difference;
    try {
      difference = await differencePercent(await renderToPng(renderTemplateGraphic, entry.input), expected);
    } catch (error) {
      failures.push({ id: entry.id, difference: "render failed", detail: error.message });
      console.log(`FAIL  ${entry.id}  render failed: ${error.message}`);
      continue;
    }
    const ok = difference <= manifest.differenceTolerance;
    if (!ok) failures.push({ id: entry.id, difference });
    console.log(`${ok ? "ok  " : "DRIFT"}  ${entry.id}  ${difference.toFixed(2)}% different`);
  }

  console.log("");
  if (failures.length) {
    console.log(`${failures.length} of ${manifest.entries.length} graphics drifted beyond ${manifest.differenceTolerance}%.`);
    console.log("Compare against docs/graphic-reference/approved/ and confirm the change is intended.");
    process.exitCode = 1;
    return;
  }
  console.log(`All ${manifest.entries.length} approved graphics still render as recorded.`);
}

const [mode, ...rest] = process.argv.slice(2);
const excluded = rest.filter((value) => value.startsWith("post_"));

if (mode === "record") await record(excluded);
else if (mode === "verify") await verify();
else {
  console.log("Usage: node scripts/graphics-baseline.mjs record [post_id_to_exclude...]");
  console.log("       node scripts/graphics-baseline.mjs verify");
  process.exitCode = 1;
}

// Keep the reference directory listing visible when nothing has been recorded.
if (mode === "record") {
  const files = await readdir(referenceDir);
  console.log(`${files.length} files in docs/graphic-reference/approved/`);
}
