# Local launcher

The supported local entry point is `sck`.

## What it does

- Keeps the checkout and dependencies in a user-owned directory.
- Uses `npm ci` and `package-lock.json` for repeatable dependency installation.
- Binds the Next.js development server to `127.0.0.1` instead of exposing it to the LAN.
- Opens the dashboard only after the health check succeeds.
- Forwards Ctrl+C and termination signals to the child server.
- Uses a launcher-only shutdown token and browser heartbeats so closing the last dashboard tab can stop a launcher-started server.

The browser shutdown behavior is intentionally opt-in. It activates only when `sck` starts the server and injects `SCK_SHUTDOWN_TOKEN`; developers who run `npm run dev` manually retain normal Next.js behavior.

## Stable and dev branches

`sck` runs the installed `main` checkout. To run the development branch, use:

```bash
sck -dev
```

The first `sck -dev` invocation creates a separate Git worktree beside the main checkout and runs the `dev` branch from there. The two checkouts share the Git history but have independent files, dependencies, and local workspace data. Keep the normal `sck` process stopped before starting `sck -dev`, since both use `http://localhost:3000` by default. Set `SCK_PORT=3001` if you need both running at once.

Create the branch before using the dev launcher:

```bash
git switch -c dev
```

After the branch is pushed to the remote, new installations can use the same command. Set `SCK_DEV_HOME` to choose a different location for the dev worktree.

## Install commands

macOS/Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/0xcryptj/savvy-cyber-kids-socialmedia-automation/main/scripts/install.sh | sh
```

Windows PowerShell:

```powershell
iwr -UseBasicParsing https://raw.githubusercontent.com/0xcryptj/savvy-cyber-kids-socialmedia-automation/main/scripts/install.ps1 | iex
```

Remote script piping is convenient but has supply-chain risk. In a higher-assurance environment, download the script, inspect it, and run it from disk. The installer can be pinned to a reviewed branch or commit with `SCK_REF`.
