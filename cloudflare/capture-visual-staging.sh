#!/usr/bin/env bash
# Capturas públicas para revisión visual. No hace login y no cambia datos.
set -euo pipefail
export TZ=Europe/Paris
OUT="visual-evidence"
mkdir -p "$OUT"
CHROME="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
if [[ -z "$CHROME" ]]; then
  echo "Chrome/Chromium no disponible en el runner" >&2
  exit 1
fi
"$CHROME" --version
for kind in public staging; do
  if [[ "$kind" == public ]]; then
    url='https://bellaquitas.fr/'
  else
    url='https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev/espejo/'
  fi
  echo "$kind -> $url"
  for mode in desktop mobile; do
    if [[ "$mode" == desktop ]]; then
      viewport='1440,900'
    else
      viewport='390,844'
    fi
    target="$OUT/$kind-$mode.png"
    timeout 70s "$CHROME" --headless=new --disable-gpu --disable-dev-shm-usage \
      --no-sandbox --no-first-run --no-default-browser-check \
      --hide-scrollbars --force-device-scale-factor=1 \
      --window-size="$viewport" --virtual-time-budget=5000 \
      --screenshot="$PWD/$target" "$url" >/dev/null 2>"$OUT/$kind-$mode-browser.log"
    test -s "$target"
    echo "Captura creada: $target ($(wc -c < "$target") bytes)"
  done
done
echo "Chrome móvil no sustituye una prueba real de Safari en iPhone."
