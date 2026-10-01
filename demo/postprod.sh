#!/usr/bin/env bash
# TenderPilot - post-production du demo video.
#
# Coupe les trois attentes LLM de l'enregistrement brut et produit
# demo/TenderPilot_Demo_Final.mp4.
#
# Usage :
#   ./demo/postprod.sh "/c/Users/yassi/Videos/Captures/mon-enregistrement.mp4"
#
# Reperer d'abord les bornes des attentes dans le brut (lecteur video, en secondes),
# puis renseigner les six variables ci-dessous. Chaque attente est remplacee par
# KEEP secondes de panneau "Running" - on ne masque pas le fait que l'agent travaille.

set -euo pipefail

RAW="${1:-}"
OUT="$(dirname "$0")/TenderPilot_Demo_Final.mp4"
KEEP=4  # secondes de "Running" conservees par attente

if [ -z "$RAW" ] || [ ! -f "$RAW" ]; then
  echo "Usage: $0 <fichier-brut.mp4>" >&2
  exit 1
fi

# --- Bornes a renseigner apres visionnage du brut (secondes) -------------------
EXTRACT_START=15   # clic sur AO-2026-001
EXTRACT_END=61     # matrice affichee            (~46 s)
QUALIFY_START=75   # clic sur Run qualification
QUALIFY_END=102    # resultat Go/No-Go affiche   (~27 s)
WRITE_START=145    # clic sur Generate proposal
WRITE_END=173      # sections affichees          (~28 s)
# ------------------------------------------------------------------------------

DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$RAW")
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Brut      : $RAW (${DURATION}s)"
echo "Decoupage : 3 attentes reduites a ${KEEP}s chacune"

cut() { # cut <index> <debut> <fin>
  ffmpeg -nostdin -v error -y -ss "$2" -to "$3" -i "$RAW" \
    -c:v libx264 -preset veryfast -crf 20 -c:a aac -movflags +faststart \
    "$WORK/part$1.mp4"
}

cut 0 0                             "$EXTRACT_START"
cut 1 "$EXTRACT_START"              "$((EXTRACT_START + KEEP))"
cut 2 "$EXTRACT_END"                "$QUALIFY_START"
cut 3 "$QUALIFY_START"              "$((QUALIFY_START + KEEP))"
cut 4 "$QUALIFY_END"                "$WRITE_START"
cut 5 "$WRITE_START"                "$((WRITE_START + KEEP))"
cut 6 "$WRITE_END"                  "$DURATION"

for i in 0 1 2 3 4 5 6; do echo "file 'part$i.mp4'"; done > "$WORK/list.txt"

ffmpeg -nostdin -v error -y -f concat -safe 0 -i "$WORK/list.txt" -c copy \
  -movflags +faststart "$OUT"

FINAL=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")
echo "Resultat  : $OUT (${FINAL}s)"
awk -v d="$FINAL" 'BEGIN { if (d > 120) print "ATTENTION : depasse 2 min - couper la sequence AO-2026-004 (etape 14)."; else print "OK : sous les 2 minutes." }'
