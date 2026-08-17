# Architecture

The local Next.js application is the source of truth. Content flows from RSS or a manual URL into typed article records, then through validated generation and a pluggable renderer before entering `PENDING_REVIEW`. Human approval is required before `APPROVED`, `QUEUED`, `SCHEDULED`, or `PUBLISHED` states.

The domain is split into `ingest`, `content`, `design`, `workflow`, `integrations`, and `db`. Connectors are interfaces or small adapters so Canva, Make.com, SocialBee, and OpenAI can be introduced without coupling UI components to vendor APIs. The current workspace uses file-backed persistence while SQLite/Drizzle remains the next persistence layer. The dashboard loads the live Savvy Cyber Kids blog and news feed, then stores generated packages locally for human review.
