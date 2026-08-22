# Graphic reference

These are the house-style reference renders for the 4:5 social graphic. Compare
against them before and after any change to `src/design/og-graphic.tsx`.

| File | Case |
| --- | --- |
| `reference-long-title.jpg` | Long headline that wraps to four lines |
| `reference-medium-title.jpg` | Three-line headline |
| `reference-short-title.jpg` | Two-line headline with a lot of open image |

What a correct graphic looks like:

- The photo is **full-bleed**. It fills the whole 1080×1350 frame with no bars,
  no letterboxing, and no flat colour blocks.
- The dark scrim **starts fully transparent** around y=560 and only deepens
  toward the bottom. There is never a visible horizontal edge where it begins.
  A hard edge is the single most common regression, and it reads as a "black box
  covering the image".
- The topic heading, orange divider, and headline sit in the lower third, over
  the darkest part of the scrim.
- The headline is fully visible. Nothing is clipped at the bottom edge, and no
  line is cut off mid-word.

Regenerate a comparison without starting the app:

```bash
npx tsx -e '
  import("./src/design/og-graphic").then(async ({ renderTemplateGraphic }) => {
    const res = await renderTemplateGraphic({
      topicHeading: "Cyber Safety Tips for Families",
      articleTitle: "Think Before You Tap: The Hidden Danger of Random Links",
      imageUrl: "https://savvycyberkids.org/wp-content/uploads/2026/01/blog-think-before-you-tap.jpg"
    });
    require("fs").writeFileSync("/tmp/check.png", Buffer.from(await res.arrayBuffer()));
  })'
```

Reviewer guidance (the "Copy + graphic improvement" box) is parsed by
`src/design/graphic-intent.ts` and covered by `tests/graphic-intent.test.ts`.
If a phrasing is being ignored, add it there with a test rather than adding a
regex to the renderer.
