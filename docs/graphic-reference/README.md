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

## Approved baseline

`approved/` holds the graphics that were reviewed and approved as good, and
`baseline.json` records the exact inputs that produced each one.

```bash
npm run graphics:verify   # re-render those inputs and report drift
npm run graphics:record   # re-snapshot after approving new graphics
```

`verify` fails when any graphic drifts more than `differenceTolerance` percent
from its reference, so a renderer change that wrecks the composition is caught
before it reaches the review queue. Run it before and after touching
`src/design/og-graphic.tsx`. It fetches the original article images, so it needs
network access; that is why it is a script rather than part of `npm test`.

Around 1% drift is normal — the references are stored as JPEG. A real layout
regression shows up as several percent across every graphic at once.

`npm run graphics:record` reads approved posts out of `storage/workspace.json`,
which is local to your machine. Pass post ids to leave out:

```bash
npm run graphics:record -- post_954d1aa7
```

## Framing

Reviewer guidance (the "Copy + graphic improvement" box) is parsed by
`src/design/graphic-intent.ts` and covered by `tests/graphic-intent.test.ts`.
If a phrasing is being ignored, add it there with a test rather than adding a
regex to the renderer.

Framing is graded, not a switch. `GraphicIntent.zoom` runs 0 to 1: 1 crops to
the full frame (the default), 0 shows the whole source, and hedged wording
("zoom out **a tad**", "zoom it out **a little**") lands at `partialZoom` in
between. Satori's `objectFit` is all-or-nothing, so a partial crop is baked into
the pixels with sharp before rendering — see `cropRectForZoom`.

That middle setting exists because contained wide images look weak: The Verge's
Roblox banner is 1200x624 and fills only 42% of the canvas height when shown
whole. Partially cropped it fills about 61% and the logo still survives.

A partially cropped image is anchored to the top edge, so its only visible
transition is the bottom one, where the scrim already fades the photo into the
headline.

The full frame is shown instead of cropped when the reviewer asks for it, or
when the vision model sets `source_image_has_text` — a designed graphic such as
a news banner or title card, whose own words would be destroyed by the default
crop. Ordinary photographs stay full-bleed. Crop percentage is deliberately not
used as the signal: every Savvy Cyber Kids blog image is 800x533 and loses the
same 47% to the crop, so it separates nothing.
