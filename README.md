# Savvy Cyber Kids Social Media Automation

Human-in-the-loop content operations for turning Savvy Cyber Kids articles into review-ready social posts.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000. `/review` and `/queue` are seeded with mock posts so the control room can be exercised without third-party credentials.

## Safety defaults

- `AUTO_PUBLISH=false` and approval is mandatory.
- The original article title is validated for exact preservation.
- The model supplies exactly two topical hashtags; application logic appends `#savvycyberkids` and `#cyberhero` for exactly four total.
- Make.com, SocialBee, Canva, and OpenAI are connector seams, not assumed-live services.

## Commands

`npm run typecheck` · `npm test` · `npm run build` · `npm run db:generate` · `npm run db:migrate`

See `docs/` for architecture, state transitions, connector boundaries, and the next implementation phases.
