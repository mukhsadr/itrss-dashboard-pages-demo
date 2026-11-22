#!/usr/bin/env bash
# Exact linked cross-filtering for V3 using local categorical Mill data.
# All local records remain on this computer, served only via 127.0.0.1.
set -euo pipefail

SOURCE="${MILL_SOURCE:-$HOME/Projects/mill-user-analyzer/output/callie_mill_report/09_callie_5columns_clean.csv}"
PAPERS="${PAPERS_SOURCE:-$HOME/Projects/itrss-metrics-dashboard/data/publications.json}"
DEST="${ITRSS_V3_LOCAL_DIR:-$HOME/.local/share/itrss-v3-linked-preview}"
PORT="${ITRSS_V3_PORT:-8766}"
BASE="https://raw.githubusercontent.com/mukhsadr/itrss-dashboard-pages-demo/main"
umask 077

if [[ ! -f "$SOURCE" ]]; then
  echo "Mill CSV not found: $SOURCE" >&2
  exit 1
fi
mkdir -p "$DEST/v3/data" "$DEST/v2/data"
chmod 700 "$DEST" "$DEST/v3" "$DEST/v3/data" "$DEST/v2" "$DEST/v2/data"

echo "Fetching public V3 frontend and public summary counts..."
curl -fsSL "$BASE/v3/index.html" -o "$DEST/v3/index.html"
curl -fsSL "$BASE/v2/data/user_aggregates.json" -o "$DEST/v2/data/user_aggregates.json"
curl -fsSL "$BASE/v2/data/publication_aggregates.json" -o "$DEST/v2/data/publication_aggregates.json"

# Do not copy usernames or other source columns. Keep four relational categories
# solely within this loopback preview. Advisor labels may still be sensitive.
python3 - "$SOURCE" "$DEST/v3/data/callie.csv" <<'PY'
import csv
import os
import sys
from pathlib import Path

source, target = map(Path, sys.argv[1:])
names = ("Descr", "Classficiation", "Status", "Advisor")
with source.open(newline="", encoding="utf-8-sig") as handle:
    reader = csv.DictReader(handle)
    if not reader.fieldnames or not set(names).issubset(reader.fieldnames):
        raise SystemExit("Missing required category columns: " + ", ".join(names))
    rows = [{k: row.get(k, "") for k in names} for row in reader]

if not rows:
    raise SystemExit("Source has no user rows")

with target.open("w", newline="", encoding="utf-8") as handle:
    writer = csv.DictWriter(handle, fieldnames=names)
    writer.writeheader()
    writer.writerows(rows)
target.chmod(0o600)
print(f"Private linked rows ready locally: {len(rows):,}")
PY

if [[ -f "$PAPERS" ]]; then
  cp "$PAPERS" "$DEST/v3/data/publications.json"
  chmod 600 "$DEST/v3/data/publications.json"
  echo "Local publications linked preview available."
fi

echo
echo "V3 linked chart: http://127.0.0.1:$PORT/v3/"
echo "Your original dashboard on port 8765 is unchanged."
echo "Private relational category data must not be uploaded to GitHub."
echo "Press Ctrl+C to stop."
exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$DEST"
