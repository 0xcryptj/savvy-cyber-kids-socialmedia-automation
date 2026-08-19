# Connector boundaries

- RSS/WordPress: standard HTTP with RSS first, WordPress REST second, and page/OpenGraph scraping fallback in `src/ingest`. The configured sources are the Savvy Cyber Kids blog archive and Cyber Safety News Feed.
- AI providers: OpenAI, Anthropic, and OpenAI-compatible endpoints can generate structured social copy. Provider, model, and compatible endpoint are selected in `/settings`; otherwise the local generator derives a safe package from the live article. Images always come from the source blog/news article and are composed into the branded 4:5 template.
- Canva: the connected template has 24 pages at 1080×1350. The relevant variants are the general article layout (page 2), Online Behavior (pages 3–4), Conversation Starters (pages 5–7), and Breaking News (pages 8–9). `DesignRenderer`/`CanvaClient` leaves room for template autofill. The shared template URL is configured in `config/urls.ts`.
- Make.com: the approved queue has a deliberate one-click webhook handoff. `MAKE_WEBHOOK_URL` is required and the post advances to `PUBLISHED` after a successful response, with the handoff timestamp and execution reference recorded when available. The payload includes the combined caption, separate hashtags, `mediaUrl`, `graphicUrl`, post ID, and optional SocialBee workspace ID for direct field mapping in Make.
- SocialBee: SocialBee currently has no public API. Keep `SocialBeeClient` downstream of Make.com and use SocialBee's supported automation integrations (Make, Zapier, Pabbly, or Boost.space), or its Buffer publishing integration. Canva import and direct Instagram/Pinterest publishing are separate supported paths. The app does not claim a direct SocialBee API connection.
- Local renderer: deterministic fallback and safe manual-post asset path.

No connector is claimed as live until credentials and an end-to-end test are completed.

## Canva assets and licensing

The connected Canva design exposes page previews, layout metadata, and asset references. The local app intentionally keeps the supplied SCK logo and uses the source article image at render time rather than copying every Canva image/video into the repository. Many Canva assets may be private, premium, or licensed only for use inside Canva. Export or download additional assets only after the design owner confirms the license and intended distribution.

## Recommended SocialBee integration

Use one Make scenario:

1. In Make, create a **Webhooks → Custom webhook** trigger and copy its URL into `MAKE_WEBHOOK_URL`.
2. Run the app locally, approve a post, and click **Mark as posted** once to send a sample payload. In Make, choose **Re-determine data structure** when prompted.
3. Add **SocialBee → Create a Post** as the next module and connect the SocialBee account.
4. Map `caption` to the post text, `mediaUrl` to the media URL, and select the SocialBee workspace, social profiles, category, and approval status. Keep the first run as a draft for verification.
5. Turn the scenario on only after checking the draft in SocialBee. The app marks the post `PUBLISHED` only when Make returns a successful response.

For a local app, Make cannot fetch `http://localhost:3000`. Set `APP_PUBLIC_URL` to a temporary HTTPS tunnel that points at the app, then restart the dev server. Without it, the text handoff still works but `mediaUrl` remains empty and the SocialBee media field must be omitted or supplied separately.

## Current workflow references

- Content: `https://savvycyberkids.org/tech-talk/blog/` and `https://savvycyberkids.org/tech-talk/savvy-cyber-kids-news-feed/`
- Design template: `https://www.canva.com/design/DAGlY0QolDE/W2OZJohpR3FCSN7P9e__aw/edit`
- Scheduler: `https://app.socialbee.com/`
- Managed channels: Instagram, Facebook, LinkedIn, and X links are centralized in `config/urls.ts`.
