#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-.}"
OUT_FILE="${2:-tombola_bundle_src.txt}"

ROOT_DIR="$(cd "$ROOT_DIR" && pwd)"

# Estensioni che vogliamo includere
ALLOW_EXT_REGEX='\.(html|css|js|jsx|ts|tsx|json|yml|yaml|md|txt|env|example|conf|nginx|sh|dockerfile)$'

# Cartelle da escludere (pesanti / generate / segreti)
EXCLUDE_DIRS_REGEX='(^|/)(\.git|node_modules|dist|build|coverage|\.cache|\.vite|\.next|\.nuxt|certbot|letsencrypt|data|logs|tmp|\.idea|\.vscode)($|/)'

# File da escludere (bundle, log, lock, roba inutile)
EXCLUDE_FILES_REGEX='(^|/)(tombola_bundle.*\.txt|.*\.log|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)($|/)'

{
  echo "=== TOMBOLA PROJECT BUNDLE (SOURCE ONLY) ==="
  echo "ROOT: $ROOT_DIR"
  echo "DATE: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo
  echo "=== MANIFEST ==="
} > "$OUT_FILE"

# Trova file inclusi
mapfile -d '' FILES < <(
  find "$ROOT_DIR" -type f -print0 | while IFS= read -r -d '' f; do
    rel="${f#$ROOT_DIR/}"

    # escludi cartelle
    if [[ "$rel" =~ $EXCLUDE_DIRS_REGEX ]]; then
      continue
    fi

    # escludi file specifici
    if [[ "$rel" =~ $EXCLUDE_FILES_REGEX ]]; then
      continue
    fi

    # include solo estensioni consentite (case-insensitive)
    shopt -s nocasematch
    if [[ "$rel" =~ $ALLOW_EXT_REGEX ]]; then
      printf '%s\0' "$f"
    fi
    shopt -u nocasematch
  done
)

# Scrivi manifest ordinato
printf '%s\n' "${FILES[@]#$ROOT_DIR/}" | sort >> "$OUT_FILE"

{
  echo
  echo "=== FILE CONTENTS ==="
} >> "$OUT_FILE"

# Dump contenuti
for f in "${FILES[@]}"; do
  rel="${f#$ROOT_DIR/}"
  {
    echo
    echo "===== FILE: $rel ====="
  } >> "$OUT_FILE"
  cat "$f" >> "$OUT_FILE"
  echo >> "$OUT_FILE"
  echo "----- END FILE -----" >> "$OUT_FILE"
done

echo "✅ Bundle creato: $OUT_FILE"
echo "📌 Files inclusi: ${#FILES[@]}"
echo "📌 Dimensione: $(du -h "$OUT_FILE" | awk '{print $1}')"
