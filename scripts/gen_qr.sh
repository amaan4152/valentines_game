#!/bin/bash
HEIGHT=$1
QR_STR=$2
if [[ -z $HEIGHT ]]; then
  echo "[ERROR] Missing HEIGHT (arg1)!"; exit 1
fi
if [[ -z $QR_STR ]]; then
  echo "[ERROR] Missing QR_STR (arg2)"; exit 2
fi
WIDTH=$((2 * HEIGHT))
qrencode -s $HEIGHT -l H $QR_STR -o /dev/stdout | viu - -w $WIDTH -h $HEIGHT
