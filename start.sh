#!/bin/bash
# Startet den Ausgangsfinder: baut die App, startet den Server und einen öffentlichen Tunnel.
#   ./start.sh            bauen + lokal + Tunnel (von überall erreichbar)
#   ./start.sh --lokal    nur lokal, ohne Tunnel
#   ./start.sh --stop     alles beenden
cd "$(dirname "$0")" || exit 1
PORT=8777
LOG=/tmp/vag-tunnel.log

beenden() {
  pkill -f "vite preview --host 0.0.0.0 --port $PORT" 2>/dev/null
  lsof -ti tcp:$PORT 2>/dev/null | xargs kill 2>/dev/null
  pkill -f "nokey@localhost.run" 2>/dev/null
}

if [ "$1" = "--stop" ]; then
  beenden; echo "Gestoppt."; exit 0
fi

echo "Alte Prozesse beenden ..."
beenden
sleep 1

echo "App bauen ..."
npm run build >/tmp/vag-build.log 2>&1 || { echo "FEHLER beim Bauen:"; tail -20 /tmp/vag-build.log; exit 1; }

echo "Server starten ..."
nohup caffeinate -i npx vite preview --host 0.0.0.0 --port $PORT >/tmp/vag-server.log 2>&1 &
for i in $(seq 1 20); do
  curl -sf -m 2 -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done

IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
echo
echo "  Auf diesem Mac:   http://localhost:$PORT/"
[ -n "$IP" ] && echo "  Im selben WLAN:   http://$IP:$PORT/"

if [ "$1" != "--lokal" ]; then
  echo
  echo "Öffentlichen Tunnel starten ..."
  rm -f "$LOG"
  nohup caffeinate -i ssh -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 \
    -o ExitOnForwardFailure=yes -R 80:localhost:$PORT nokey@localhost.run >"$LOG" 2>&1 &
  URL=""
  for i in $(seq 1 30); do
    URL=$(grep -o "https://[a-z0-9.-]*lhr\.life" "$LOG" 2>/dev/null | tail -1)
    [ -n "$URL" ] && break
    sleep 1
  done
  if [ -n "$URL" ]; then
    echo "  Von überall:      $URL"
    command -v qrencode >/dev/null && qrencode -t ANSIUTF8 "$URL"
    command -v pbcopy >/dev/null && printf '%s' "$URL" | pbcopy && echo "  (Adresse ist in der Zwischenablage)"
  else
    echo "  Tunnel kam nicht zustande – siehe $LOG"
  fi
fi

echo
echo "Läuft im Hintergrund. Beenden mit: ./start.sh --stop"
