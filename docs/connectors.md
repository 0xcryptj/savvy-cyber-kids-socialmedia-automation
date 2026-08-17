# Connector boundaries

- RSS/WordPress: standard HTTP, with feed discovery and future HTML/OpenGraph normalization in `src/ingest`.
- OpenAI: structured content generation is represented by `ContentGenerator`; no API key is required for the seeded local experience.
- Canva: `DesignRenderer`/`CanvaClient` leaves room for template autofill; exact SCK template access is still pending.
- Make.com: `MakeHandoff` accepts only approved packages. `MAKE_WEBHOOK_URL` is not configured by default.
- SocialBee: `SocialBeeClient` is intentionally downstream of Make.com.
- Local renderer: deterministic fallback and safe manual-post asset path.

No connector is claimed as live until credentials and an end-to-end test are completed.
