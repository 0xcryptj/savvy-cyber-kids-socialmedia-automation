# Savvy Cyber Kids Social Media Automation

Human-in-the-loop content operations for turning Savvy Cyber Kids articles into review-ready social posts.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000. `/library` loads the live blog and news sources. Select an article to generate a review-ready social package; no mock posts are loaded.

AI providers are selected from `/settings`. OpenAI and Anthropic use `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`; OpenRouter, Groq, Together, Ollama, and other OpenAI-compatible services use `AI_API_KEY` plus `AI_BASE_URL`. The selected model is saved locally in `storage/settings.json`.

## Safety defaults

- `AUTO_PUBLISH=false` and approval is mandatory.
- The original article title is validated for exact preservation.
- The model supplies exactly two topical hashtags; application logic appends `#savvycyberkids` and `#cyberhero` for exactly four total.
- Make.com, SocialBee, Canva, and OpenAI require their configured credentials. Without OpenAI, local copy generation and the branded template renderer remain available.

## Commands

`npm run typecheck` · `npm test` · `npm run build` · `npm run db:generate` · `npm run db:migrate`

See `docs/` for architecture, state transitions, connector boundaries, and the next implementation phases.
