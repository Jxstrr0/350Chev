#!/usr/bin/env bash
# Trims the drag announcer's raw ElevenLabs clips into sounds/announcer/.
# For each raw clip it: cuts the silence at the start and end, speeds it up
# a little (TEMPO, without changing the pitch), evens out the loudness, and
# writes a small mono MP3 with the game's file name.
#
#   bash tools/trim-announcer.sh RAW_DIR [TEMPO]
#
# RAW_DIR holds the downloads named PEW-ANN-0001.mp3 / PEW-CALL-0001.mp3
# (the ids in docs/announcer-script.csv). TEMPO defaults to 1.15.
# Needs ffmpeg. The output is committed; players never run this.
set -euo pipefail
RAW=${1:?usage: trim-announcer.sh RAW_DIR [TEMPO]}
TEMPO=${2:-1.15}
OUT="$(dirname "$0")/../sounds/announcer"
# Silence below -45 dB is cut from the front, then the clip is reversed so
# the same filter cuts the tail, then reversed back.
TRIM="silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02"
FILTER="$TRIM,areverse,$TRIM,areverse,atempo=$TEMPO,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=32000"
n=0
for f in "$RAW"/PEW-*.mp3; do
  id=$(basename "$f" .mp3)                         # PEW-ANN-0001
  name="pew_announcer_$(echo "$id" | tr 'A-Z' 'a-z').mp3"
  ffmpeg -loglevel error -y -i "$f" -af "$FILTER" -ac 1 -ar 32000 \
    -c:a libmp3lame -b:a 48k "$OUT/$name"
  n=$((n+1))
done
echo "trimmed $n clips at tempo $TEMPO into sounds/announcer/"
