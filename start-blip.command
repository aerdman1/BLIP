#!/bin/bash
#
# BLIP — double-click to run the game's dev server.
# Keeps running until you close this window; auto-restarts if it ever crashes.
#
cd "/Users/aerdman/Beamline-Game" || {
  echo "Could not find the BLIP project folder. Did it move?"
  echo "Press Return to close."; read _; exit 1
}

# Ctrl-C = quit cleanly (do NOT auto-restart)
trap 'echo ""; echo "BLIP server stopped. You can close this window."; exit 0' INT

# First run only: install dependencies
if [ ! -d node_modules ]; then
  echo "First run - installing dependencies (this happens once)..."
  npm install || { echo "npm install failed."; read _; exit 1; }
fi

clear
echo "============================================"
echo "   ((.))  BLIP - dev server"
echo "   PLAY:  http://localhost:5173"
echo "   STOP:  close this window (or Ctrl-C)"
echo "============================================"
echo ""

# open the game in your browser once the server has booted
( sleep 4; open "http://localhost:5173" >/dev/null 2>&1 ) &

# keep the server alive: restart automatically if it stops on its own
while true; do
  npm run dev
  echo ""
  echo "Server stopped - restarting in 2s...  (close this window to quit)"
  sleep 2
done
