#!/bin/sh
set -eu

REPO_URL="${SCK_REPO_URL:-https://github.com/0xcryptj/savvy-cyber-kids-socialmedia-automation.git}"
REPO_DIR="${SCK_HOME:-$HOME/.local/share/savvy-cyber-kids-socialmedia-automation}"
BIN_DIR="${SCK_BIN_DIR:-$HOME/.local/bin}"
BRANCH="${SCK_REF:-main}"

command -v git >/dev/null 2>&1 || { echo "Git is required. Install it from https://git-scm.com/" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js 20.9+ is required. Install it from https://nodejs.org/" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required and normally ships with Node.js." >&2; exit 1; }

if [ -d "$REPO_DIR/.git" ]; then
  git -C "$REPO_DIR" fetch --depth=1 origin "$BRANCH"
  git -C "$REPO_DIR" pull --ff-only origin "$BRANCH"
else
  mkdir -p "$(dirname "$REPO_DIR")"
  git clone --depth=1 --branch "$BRANCH" "$REPO_URL" "$REPO_DIR"
fi

npm --prefix "$REPO_DIR" ci --no-audit --no-fund
mkdir -p "$BIN_DIR"
cat > "$BIN_DIR/sck" <<EOF
#!/bin/sh
exec node "$REPO_DIR/scripts/sck.mjs" "\$@"
EOF
chmod 700 "$BIN_DIR/sck"

case ":${PATH}:" in
  *":${BIN_DIR}:"*) ;;
  *)
    shell_name=$(basename "${SHELL:-sh}")
    profile="$HOME/.profile"
    [ "$shell_name" = "zsh" ] && profile="$HOME/.zprofile"
    touch "$profile"
    grep -Fqx 'export PATH="$HOME/.local/bin:$PATH"' "$profile" 2>/dev/null || printf '\n# Savvy Cyber Kids launcher\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$profile"
    export PATH="$BIN_DIR:$PATH"
    ;;
esac

echo "SCK installed. Starting the local dashboard…"
exec "$BIN_DIR/sck"
