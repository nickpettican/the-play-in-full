#!/bin/sh
# Serve the game at http://localhost:8433
exec python -m http.server 8433 --directory "$(dirname "$0")"
