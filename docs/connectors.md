# Connector boundaries

- RSS/WordPress: standard HTTP with RSS first, WordPress REST second, and page/OpenGraph scraping fallback in `src/ingest`. The configured sources are the Savvy Cyber Kids blog archive and Cyber Safety News Feed.
- AI providers: OpenAI, Anthropic, and OpenAI-compatible endpoints can generate structured social copy. Provider, model, and compatible endpoint are selected in `/settings`; otherwise the local generator derives a safe package from the live article. Images always come from the source blog/news article and are composed into the branded 4:5 template.
- Canva: `DesignRenderer`/`CanvaClient` leaves room for template autofill. The shared template URL is configured in `config/urls.ts`; API/access still needs an end-to-end test.
- Make.com: the approved queue has a deliberate one-click webhook handoff. `MAKE_WEBHOOK_URL` is required and the post advances to `PUBLISHED` after a successful response, with the handoff timestamp and execution reference recorded when available.
- SocialBee: `SocialBeeClient` is intentionally downstream of Make.com.
- Local renderer: deterministic fallback and safe manual-post asset path.

No connector is claimed as live until credentials and an end-to-end test are completed.

## Current workflow references

- Content: `https://savvycyberkids.org/tech-talk/blog/` and `https://savvycyberkids.org/tech-talk/savvy-cyber-kids-news-feed/`
- Design template: `https://www.canva.com/design/DAGlY0QolDE/W2OZJohpR3FCSN7P9e__aw/edit`
- Scheduler: `https://app.socialbee.com/`
- Managed channels: Instagram, Facebook, LinkedIn, and X links are centralized in `config/urls.ts`.
