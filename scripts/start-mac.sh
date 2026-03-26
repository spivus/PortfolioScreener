#!/bin/bash
# Startet Backend + Frontend fuer lokale Entwicklung

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="/tmp/portfolio-analyzer.pids"

# Alte Prozesse stoppen falls vorhanden
if [ -f "$PID_FILE" ]; then
    "$SCRIPT_DIR/stop-mac.sh"
fi

echo "Starte Backend..."
cd "$PROJECT_DIR/backend"
uv run uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

echo "Starte Frontend..."
cd "$PROJECT_DIR/frontend"
npm run dev -- --port 3000 &
FRONTEND_PID=$!

echo "$BACKEND_PID" > "$PID_FILE"
echo "$FRONTEND_PID" >> "$PID_FILE"

echo "Backend PID: $BACKEND_PID (http://localhost:8000)"
echo "Frontend PID: $FRONTEND_PID (http://localhost:3000)"
echo "Stoppen mit: $SCRIPT_DIR/stop-mac.sh"
