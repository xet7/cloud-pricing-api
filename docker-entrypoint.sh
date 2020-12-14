#!/usr/bin/env bash
set -e

## Run startup command 
echo "Running Start Up Script__"

if [[ -z "${CLOUD_PROVIDER}" ]]; then
  UPDATE_PARAM="All"
else
  UPDATE_PARAM="${CLOUD_PROVIDER}"
fi

if [ "${UPDATE_PARAM}" == "All" ]; then
	npm run update
fi

if [ "${UPDATE_PARAM}" == "AWS" ]; then
	npm run update -- --only=aws:bulk
	npm run update -- --only=aws:spot
fi

if [ "${UPDATE_PARAM}" == "Azure" ]; then
	npm run update -- --only=azure:retail
fi

if [ "${UPDATE_PARAM}" == "GCP" ]; then
	npm run update -- --only=gcp:catalog
	npm run update -- --only=gcp:machineTypes
fi

## Running passed command
if [[ "$1" ]]; then
	eval "$@"
fi