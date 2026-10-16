#!/usr/bin/env bash
# Creates the local kind cluster, then installs the platform and the app.
# App: http://respawnhub.localhost/   Safe to run again.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! kind get clusters | grep -qx respawnhub; then
  kind create cluster --config k8s/kind-config.yaml
fi
kubectl config use-context kind-respawnhub
./scripts/platform-up.sh kind
