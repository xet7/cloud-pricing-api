#!/usr/bin/env bash
set -e

## Run startup command 
echo "Running Start Up Script__"
npm run update -- --only=azure:retail

## Running passed command
if [[ "$1" ]]; then
	eval "$@"
fi