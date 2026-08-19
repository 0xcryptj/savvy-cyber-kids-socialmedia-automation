# Savvy Cyber Kids Social Media Automation

Savvy Cyber Kids Social Media Automation is a local, human-in-the-loop content workspace. It pulls articles from the Savvy Cyber Kids blog and news feed, turns a selected article into a review-ready social package, renders a branded 4:5 graphic, and keeps approval and outbound handoff visible.

The app is designed to run on your own computer at `http://localhost:3000`. It does not require a cloud deployment for local testing, and it does not auto-publish by default.

## What the tool does

1. Loads current blog and news articles into the Library.
2. Generates a social topic, caption, and hashtags using your selected AI provider, or a deterministic local fallback.
3. Preserves the original article title and applies the Savvy Cyber Kids hashtag rules.
4. Builds a branded social graphic from the article image.
5. Places the package in the Review queue.
6. Keeps approved posts visible until they are deliberately handed off.
7. Records a successful Make.com handoff in Published History with a timestamp and execution reference when available.

## Requirements

- Node.js `20.9` or newer
- npm (included with Node.js)
- Git, if cloning from GitHub
- A modern browser such as Chrome, Edge, Firefox, or Safari

Check your versions:

```bash
node --version
npm --version
git --version
```

If Node.js is missing, install the current LTS release from [nodejs.org](https://nodejs.org/). On Windows, Git can be installed from [git-scm.com](https://git-scm.com/). macOS users can install Git through Xcode Command Line Tools or Homebrew.

## Install on macOS or Linux

Open Terminal and run this one-liner:

```bash
git clone https://github.com/0xcryptj/savvy-cyber-kids-socialmedia-automation.git && cd savvy-cyber-kids-socialmedia-automation && npm install && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For a repeatable installer that clones the current `main` branch, installs dependencies, adds the `sck` command to your user PATH, and opens the dashboard automatically:

```bash
curl -fsSL https://raw.githubusercontent.com/0xcryptj/savvy-cyber-kids-socialmedia-automation/main/scripts/install.sh | sh
```

The installer stores the checkout under `~/.local/share/savvy-cyber-kids-socialmedia-automation` and the launcher under `~/.local/bin/sck`. Open a new terminal after installation if your shell does not reload its PATH automatically. Thereafter, run the tool from any directory with:

```bash
sck
```

Once the page opens, go to **Settings** and enter the provider, model, endpoint if needed, and API key. You do not need to edit a secrets file for the normal setup.

Leave the terminal running while you use the app. Stop the development server with `Ctrl+C`.

## Install on Windows

### PowerShell

Open PowerShell and run this one-liner:

```powershell
git clone https://github.com/0xcryptj/savvy-cyber-kids-socialmedia-automation.git; Set-Location savvy-cyber-kids-socialmedia-automation; npm install; npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Stop the server with `Ctrl+C`.

### Command Prompt

The equivalent Command Prompt one-liner is:

```bat
git clone https://github.com/0xcryptj/savvy-cyber-kids-socialmedia-automation.git && cd savvy-cyber-kids-socialmedia-automation && npm install && npm run dev
```

### Windows one-line installer

Run this in PowerShell. It installs the checkout under `%LOCALAPPDATA%`, adds `sck` to your user PATH, installs dependencies with the lockfile, and opens the dashboard:

```powershell
iwr -UseBasicParsing https://raw.githubusercontent.com/0xcryptj/savvy-cyber-kids-socialmedia-automation/main/scripts/install.ps1 | iex
```

Open a new PowerShell window if needed, then run `sck` from any directory. For security-sensitive environments, download the script first, inspect it, and execute the local file instead of piping a remote script directly.

The launcher binds only to `127.0.0.1`, opens the browser when the server is ready, forwards Ctrl+C to the child process, and cleans up its server process. When the launcher started the app, closing the last dashboard tab also requests a graceful shutdown after a short navigation/reload grace period. A manually started `npm run dev` server is not automatically stopped by browser tab events.

## Configure an AI provider

The app is provider-agnostic. The normal setup is to enter the key directly on the Settings page at [http://localhost:3000/settings](http://localhost:3000/settings). The server stores it in a local permission-restricted file, never returns it to the browser, and never logs it. Advanced users can still use environment variables in `.env`.

| Provider | Environment variable | Example model |
| --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o-mini` |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-3-5-haiku-latest` |
| OpenAI-compatible | `AI_API_KEY` and `AI_BASE_URL` | Provider-specific model name |

For an OpenAI-compatible provider, use its OpenAI-compatible API base URL, usually ending in `/v1`. Examples include OpenRouter, Groq, Together, and a local Ollama-compatible endpoint. Set `AI_PROVIDER=openai-compatible` in `.env`, enter the model name in Settings, and provide the endpoint URL when prompted.

Example `.env` choices:

```env
# OpenAI
OPENAI_API_KEY=your-key-here
AI_PROVIDER=openai
AI_MODEL=gpt-4o-mini

# Or Anthropic
# ANTHROPIC_API_KEY=your-key-here
# AI_PROVIDER=anthropic
# AI_MODEL=claude-3-5-haiku-latest

# Or an OpenAI-compatible service
# AI_API_KEY=your-key-here
# AI_PROVIDER=openai-compatible
# AI_BASE_URL=https://openrouter.ai/api/v1
# AI_MODEL=provider/model-name
```

Never commit `.env`, `storage/credentials.json`, or paste a real API key into an issue, pull request, screenshot, or chat. These files are ignored by Git. If a key is exposed, revoke it with the provider immediately.

If no usable provider key is configured, the app falls back to local copy generation so the library, review flow, and graphic renderer can still be tested.

## Optional integrations

The core local workflow works without these services:

```env
CANVA_CLIENT_ID=
CANVA_CLIENT_SECRET=
CANVA_TEMPLATE_URL=
MAKE_WEBHOOK_URL=
SOCIALBEE_WORKSPACE_ID=
AUTO_PUBLISH=false
```

- `MAKE_WEBHOOK_URL` enables the deliberate outbound handoff from the approved queue.
- Canva and SocialBee settings are reserved for their connector workflows.
- Keep `AUTO_PUBLISH=false` while testing. Approval remains required.

### Easiest SocialBee setup: Make.com

The supported path is a single Make scenario: **Custom webhook → SocialBee / Create a Post**. The app sends the approved caption, individual hashtags, generated graphic URL, post ID, and optional SocialBee workspace ID. Follow the complete field-mapping checklist in [`docs/connectors.md`](docs/connectors.md).

Because Make runs in the cloud, it cannot download an image from `localhost`. For image publishing during local testing, expose the development server through a temporary HTTPS tunnel and set `APP_PUBLIC_URL` to that tunnel origin. Keep the scenario in draft mode until the first test post is confirmed in SocialBee.

## Using the app

1. Open **Library** and choose Blog content or News feed.
2. Select **Create social post** on an article.
3. Wait for the writing and graphic processing indicators to finish.
4. Open **Review post**. The Pending Review card on the dashboard opens the complete review queue.
5. Edit the caption and all four hashtags together in the **Caption + hashtags** field, then approve, save for revision, or reject. Keep hashtags on the final line; the two required Savvy Cyber Kids tags must remain included.
6. Approved posts remain visible in the review log and appear in **Ready to post**.
7. Use **Mark as posted** only after the configured outbound handoff succeeds.
8. Review completed handoffs in **Published history**.

The quick-post controls can also copy the caption, hashtags, and graphic link for manual posting from a logged-in social account.

## Local data and settings

- `storage/workspace.json` contains local post state and is ignored by Git.
- `storage/settings.json` contains the selected provider, model, and compatible endpoint and is ignored by Git.
- `storage/credentials.json` contains locally entered provider keys with owner-only file permissions and is ignored by Git.
- `storage/generated/` contains generated local assets.
- `.env` contains local secrets and is ignored by Git.

This is intentionally file-backed local persistence. It is convenient for testing and single-user use; it is not a multi-user production credential vault. Do not expose this development server directly to the public internet.

## Template fidelity

The local renderer follows the specification recorded in `config/template.ts`: 1080×1350 (4:5), Asap, the supplied Savvy Cyber Kids logo, full-bleed article imagery, the black gradient treatment, and the exact black, white, orange, light-blue, medium-blue, and dark-blue color tokens. Dynamic topic headings and article titles are fitted into that same layout. Editable social copy remains separate from the branded image composition.

The connected Canva file contains 24 pages. The current local layout maps to the general article treatment; the source template also includes Online Behavior, Conversation Starters, and Breaking News variants. Those variants are documented in [`docs/connectors.md`](docs/connectors.md) so they can be added as explicit renderer choices without guessing at the design. Canva asset references are retained as source metadata rather than bulk-copied into Git because some images and fonts may be private or licensed for Canva-only use.

## Useful commands

```bash
npm run dev        # Start the local development server
npm run typecheck  # Check TypeScript
npm test           # Run the test suite
npm run build      # Create a production build
npm start          # Serve the production build locally
npm run db:generate
npm run db:migrate
```

For a production-style local check:

```bash
npm run build
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

## Troubleshooting

### `npm` or `node` is not recognized

Install Node.js 20.9+ and restart Terminal, PowerShell, or Command Prompt. Confirm with `node --version`.

### Port 3000 is already in use

Stop the other local app using port 3000, or start this app on another port:

macOS/Linux:

```bash
npm run dev -- -p 3001
```

Windows PowerShell:

```powershell
npm run dev -- -p 3001
```

Then open [http://localhost:3001](http://localhost:3001).

### The Library is empty or live sources fail

The Library reads the live Savvy Cyber Kids sources. Check your internet connection, then use **Refresh sources**. Source failures do not prevent the local UI from starting.

### AI generation falls back to local copy

Check that the selected provider in Settings matches the key you entered, that the model name is valid, and that the key has access to that model. Restart `npm run dev` after changing `.env`.

### Windows PowerShell blocks a command

Use PowerShell or Command Prompt from the project folder and run the commands individually. Do not run scripts downloaded from an unknown source; this project only requires the standard `npm` commands listed above.

### The browser shows an old page

Stop and restart the dev server, then hard-refresh the browser. The workspace uses short-lived caching for local state and invalidates it after app updates.

## Project map

```text
app/                  Next.js pages and API routes
app/library/          Live source library and article selection
app/review/           Review queue and social package editor
app/settings/         Provider and connector settings
src/content/          AI and local copy generation plus validation
src/ingest/           RSS, WordPress, HTML, and OpenGraph ingestion
src/workflow/         Approval state machine and post transitions
src/workspace/        Local file-backed workspace state
src/integrations/     Make.com, Canva, SocialBee, and provider boundaries
config/               Source URLs, feed rules, platform links, and content rules
docs/                 Architecture, connector, and workflow notes
```

## Integration status

- AI writing: configurable OpenAI, Anthropic, or OpenAI-compatible provider.
- Canva: connected template specifications documented; local renderer remains deterministic and human-reviewable.
- Make.com: implemented approved-post webhook handoff with SocialBee-ready payload fields.
- SocialBee: no direct public API client is assumed; use Make’s supported SocialBee module.

## Safety defaults

- `AUTO_PUBLISH=false` by default.
- Human approval is required before outbound handoff.
- Article titles are validated for exact preservation.
- Generated content receives exactly two topical hashtags plus `#savvycyberkids` and `#cyberhero`.
- Secrets remain environment-only and are never stored in the workspace JSON.

## Further reading

- [Architecture](docs/architecture.md)
- [Connector boundaries](docs/connectors.md)
- [Workflow state machine](docs/workflow-state-machine.md)
- [Development plan](docs/development-plan.md)
