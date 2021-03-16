#!/usr/bin/env bash
set -e

## Run startup command 
echo "Running Start Up Script__"

case $UPDATE_CLOUD_PROVIDER in

  "All")
	  npm run update
    ;;

  "AWS" | "Amazon" | "AmazonWebServices")
    npm run update -- --only=aws:bulk
    npm run update -- --only=aws:spot
    ;;

  "Azure" | "AzureRM")
    npm run update -- --only=azure:retail
    ;;

  "GCP" | "Google")
    npm run update -- --only=gcp:catalog
	  npm run update -- --only=gcp:machineTypes
    ;;

  *)
    echo -n "Unknown/No Updater Selected"
    ;;
esac

## Running passed command
if [[ "$1" ]]; then
	eval "$@"
fi
