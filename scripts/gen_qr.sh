#!/bin/bash
HEIGHT=$1
QR_STR=$2
OUT_FILE=$3
if [[ -z $HEIGHT ]]; then
  echo "[ERROR] Missing HEIGHT (arg1)!"; exit 1
fi
if [[ -z $QR_STR ]]; then
  echo "[ERROR] Missing QR_STR (arg2)"; exit 2
fi

WIDTH=$((2 * HEIGHT))
if [[ -z $OUT_FILE ]]; then
  OUT_FILE=/dev/stdout
  qrencode -s 3 -l H $QR_STR -o $OUT_FILE | viu - -w $WIDTH -h $HEIGHT
else
  qrencode -s 3 -l H $QR_STR -o $OUT_FILE
fi
