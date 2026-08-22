import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const installedRepo = join(import.meta.dirname, "..");
const args = process.argv.slice(2);
const devMode = args[0] === "-dev";
const launcherArgs = devMode ? args.slice(1) : args;
const devRepo = process.env.SCK_DEV_HOME || join(dirname(installedRepo), `${basename(installedRepo)}-dev`);
const repo = devMode ? devRepo : installedRepo;
const configuredPort = process.env.SCK_PORT || "3000";
const configuredPortNumber = Number(configuredPort);
const port = Number.isInteger(configuredPortNumber) && configuredPortNumber >= 1024 && configuredPortNumber <= 65535
  ? String(configuredPortNumber)
  : "3000";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const token = randomBytes(32).toString("hex");
const url = `http://127.0.0.1:${port}`;

if (configuredPort !== port) console.warn(`Ignoring invalid SCK_PORT=${configuredPort}; using ${port}.`);

if (args.some((arg) => arg === "-dev" && arg !== args[0])) {
  console.error("Use `sck -dev` with -dev as the first argument.");
  process.exit(1);
}

function gitBranch(checkout) {
  const gitEntry = join(checkout, ".git");
  const gitFile = existsSync(gitEntry) && statSync(gitEntry).isFile() ? readFileSync(gitEntry, "utf8").trim() : "";
  const gitDir = gitFile.startsWith("gitdir:") ? join(checkout, gitFile.slice("gitdir: ".length)) : gitEntry;
  const head = readFileSync(join(gitDir, "HEAD"), "utf8").trim();
  return head.startsWith("ref: refs/heads/") ? head.slice("ref: refs/heads/".length) : "";
}

function addDevWorktree() {
  return new Promise((resolve, reject) => {
    const worktree = spawn("git", ["-C", installedRepo, "worktree", "add", "--quiet", repo, "dev"], { stdio: "inherit" });
    worktree.on("error", reject);
    worktree.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Unable to create the dev worktree (Git exited with code ${code}).`)));
  });
}

async function ensureDevWorktree() {
  if (existsSync(join(repo, ".git"))) {
    try {
      const branch = gitBranch(repo);
      if (branch !== "dev") throw new Error(`SCK_DEV_HOME must be checked out to dev (currently ${branch || "detached HEAD"}).`);
      return;
    } catch (error) {
      throw error instanceof Error ? error : new Error("Unable to verify the dev checkout.");
    }
  }

  if (existsSync(repo)) throw new Error(`SCK dev checkout path already exists but is not a Git checkout: ${repo}`);
  await addDevWorktree();
}

if (devMode) {
  try {
    await ensureDevWorktree();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Unable to prepare the dev checkout.");
    process.exit(1);
  }
  console.log(`SCK dev mode is using the dev branch at ${repo}.`);
}

function openBrowser() {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd.exe" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const browser = spawn(command, args, { detached: true, stdio: "ignore" });
  browser.unref();
}

async function waitForServer() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return;
    } catch {
      // The development server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`SCK did not become ready at ${url}`);
}

if (!existsSync(join(repo, "node_modules"))) {
  const install = spawn(npmCommand, ["ci", "--no-audit", "--no-fund"], { cwd: repo, stdio: "inherit" });
  await new Promise((resolve, reject) => {
    install.on("error", reject);
    install.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Dependency installation failed with code ${code}`)));
  });
}

const server = spawn(npmCommand, ["run", "dev", ...launcherArgs, "--", "-p", port, "-H", "127.0.0.1"], {
  cwd: repo,
  env: { ...process.env, SCK_SHUTDOWN_TOKEN: token },
  stdio: "inherit"
});
let stopping = false;

function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  if (!server.killed) server.kill(signal);
  setTimeout(() => { if (!server.killed) server.kill("SIGKILL"); }, 5_000).unref();
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));
server.once("error", (error) => { console.error(error.message); process.exitCode = 1; });
server.once("exit", (code, signal) => {
  if (!stopping && code !== 0) console.error(`SCK server exited with ${signal || code}`);
  process.exitCode = code ?? 1;
});

try {
  await waitForServer();
  console.log(`SCK is running at ${url}. Press Ctrl+C to stop it.`);
  openBrowser();
} catch (error) {
  console.error(error instanceof Error ? error.message : "SCK failed to start");
  stop();
  process.exitCode = 1;
}

await new Promise((resolve) => server.once("exit", resolve));
