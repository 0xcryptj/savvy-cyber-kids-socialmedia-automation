import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const repo = join(import.meta.dirname, "..");
const configuredPort = process.env.SCK_PORT || "3000";
const configuredPortNumber = Number(configuredPort);
const port = Number.isInteger(configuredPortNumber) && configuredPortNumber >= 1024 && configuredPortNumber <= 65535
  ? String(configuredPortNumber)
  : "3000";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const token = randomBytes(32).toString("hex");
const url = `http://127.0.0.1:${port}`;

if (configuredPort !== port) console.warn(`Ignoring invalid SCK_PORT=${configuredPort}; using ${port}.`);

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

const server = spawn(npmCommand, ["run", "dev", "--", "-p", port, "-H", "127.0.0.1"], {
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
