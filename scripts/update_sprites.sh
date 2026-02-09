#!/bin/bash
SPRITE_NAME=$1
cp ./sprites/${SPRITE_NAME}*.json ./public/assets
cp ./sprites/${SPRITE_NAME}*.png ./public/assets
