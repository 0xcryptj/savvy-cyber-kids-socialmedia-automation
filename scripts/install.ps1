$ErrorActionPreference = "Stop"

$repoUrl = if ($env:SCK_REPO_URL) { $env:SCK_REPO_URL } else { "https://github.com/0xcryptj/savvy-cyber-kids-socialmedia-automation.git" }
$repoDir = if ($env:SCK_HOME) { $env:SCK_HOME } else { Join-Path $env:LOCALAPPDATA "SavvyCyberKids\socialmedia-automation" }
$binDir = if ($env:SCK_BIN_DIR) { $env:SCK_BIN_DIR } else { Join-Path $HOME "bin" }
$branch = if ($env:SCK_REF) { $env:SCK_REF } else { "main" }

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Git is required. Install it from https://git-scm.com/" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js 20.9+ is required. Install it from https://nodejs.org/" }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm is required and normally ships with Node.js." }

if (Test-Path (Join-Path $repoDir ".git")) {
  git -C $repoDir fetch --depth=1 origin $branch
  git -C $repoDir pull --ff-only origin $branch
} else {
  New-Item -ItemType Directory -Force -Path (Split-Path $repoDir) | Out-Null
  git clone --depth=1 --branch $branch $repoUrl $repoDir
}

npm --prefix $repoDir ci --no-audit --no-fund
New-Item -ItemType Directory -Force -Path $binDir | Out-Null
$cmdPath = Join-Path $binDir "sck.cmd"
"@echo off`r`nnode `"$repoDir\scripts\sck.mjs`" %*`r`n" | Set-Content -Encoding ascii $cmdPath

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (-not (($userPath -split ";") -contains $binDir)) {
  [Environment]::SetEnvironmentVariable("Path", "$binDir;$userPath", "User")
}
$env:Path = "$binDir;$env:Path"

Write-Host "SCK installed. Starting the local dashboard…"
& node (Join-Path $repoDir "scripts/sck.mjs")
