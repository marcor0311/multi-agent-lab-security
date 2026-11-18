#!/bin/sh
# Serves the 3D twin on http://localhost so the page can talk to Ollama (Ollama rejects file:// pages).
# Usage: ./serve.sh   (optional: PORT=9000 ./serve.sh)
cd "$(dirname "$0")" || exit 1
PORT="${PORT:-8000}"
URL="http://localhost:$PORT/masterplan_3d.html"
echo "Gemelo 3D en $URL  (Ctrl+C para detener)"
command -v ollama >/dev/null 2>&1 || echo "Aviso: Ollama no está instalado; la simulación usará solo reglas."
(sleep 1; open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null) &
exec python3 -m http.server "$PORT" --bind 127.0.0.1
