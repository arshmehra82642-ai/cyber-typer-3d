#!/usr/bin/env bash
set -e

DIR="/root/cyber-typer-3d"
PORT=8080

# 1. Kill any existing instances of server on 8080 or cloudflared
pkill -f "python3 -m http.server 8080" 2>/dev/null || true
pkill -f "cloudflared tunnel --url" 2>/dev/null || true
sleep 1

# 2. Start HTTP Server
echo "Starting local HTTP server on port $PORT..."
nohup python3 -m http.server $PORT --directory "$DIR" > "$DIR/server.log" 2>&1 &
SERVER_PID=$!
echo "Server started with PID: $SERVER_PID"

# Wait a moment for server to bind
sleep 1

# 3. Start Cloudflare Tunnel
echo "Starting Cloudflare public tunnel..."
rm -f "$DIR/tunnel.log"
nohup cloudflared tunnel --url http://127.0.0.1:$PORT > "$DIR/tunnel.log" 2>&1 &
TUNNEL_PID=$!
echo "Tunnel started with PID: $TUNNEL_PID"

# 4. Wait for tunnel URL to appear in logs (up to 20 seconds)
echo "Waiting for public URL..."
URL=""
for i in {1..20}; do
  if [ -f "$DIR/tunnel.log" ]; then
    URL=$(grep -o 'https://[-a-zA-Z0-9@:%._\+~#=]\+\.trycloudflare\.com' "$DIR/tunnel.log" | head -n 1 || true)
    if [ -n "$URL" ]; then
      break
    fi
  fi
  sleep 1
done

if [ -n "$URL" ]; then
  echo "========================================="
  echo "🚀 LIVE PUBLIC URL: $URL"
  echo "========================================="
  echo "$URL" > "$DIR/public_url.txt"
else
  echo "⚠️ Could not extract tunnel URL yet. Check $DIR/tunnel.log"
fi
