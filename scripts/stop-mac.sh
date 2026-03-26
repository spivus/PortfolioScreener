#!/bin/bash
# Stoppt Backend + Frontend

PID_FILE="/tmp/portfolio-analyzer.pids"

if [ ! -f "$PID_FILE" ]; then
    echo "Keine laufenden Prozesse gefunden."
    exit 0
fi

while read -r pid; do
    if kill -0 "$pid" 2>/dev/null; then
        kill "$pid"
        echo "Prozess $pid gestoppt."
    fi
done < "$PID_FILE"

rm -f "$PID_FILE"
echo "Alle Prozesse gestoppt."
