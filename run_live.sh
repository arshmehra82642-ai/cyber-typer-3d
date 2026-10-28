#!/usr/bin/env bash

# Terminate existing
pkill -9 -f "http.server 8080" 2>/dev/null || true
pkill -9 -f "cloudflared tunnel" 2>/dev/null || true
sleep 1

# Start local server
python3 -m http.server 8080 --directory /root/cyber-typer-3d --bind 127.0.0.1 &
HTTP_PID=$!

cleanup() {
  kill -9 $HTTP_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

sleep 1
echo "HTTP Server active on 8080. Initializing Cloudflare Tunnel..."
exec cloudflared tunnel --url http://127.0.0.1:8080
