#!/usr/bin/env bash
# Creates the local kind cluster and installs everything RespawnHub runs on:
# ingress-nginx, metrics-server, Prometheus + Grafana, Argo CD, then hands
# the app itself to Argo CD. Safe to run again.
set -euo pipefail
cd "$(dirname "$0")/.."

# Creates a Secret with random values once and leaves it alone afterwards.
make_secret() {
  local namespace=$1 name=$2; shift 2
  if ! kubectl -n "$namespace" get secret "$name" >/dev/null 2>&1; then
    local args=()
    for pair in "$@"; do
      local key=${pair%%=*} value=${pair#*=}
      [ "$value" = "random" ] && value=$(openssl rand -hex 16)
      args+=(--from-literal="$key=$value")
    done
    kubectl -n "$namespace" create secret generic "$name" "${args[@]}"
  fi
}

if ! kind get clusters | grep -qx respawnhub; then
  kind create cluster --config k8s/kind-config.yaml
fi
kubectl config use-context kind-respawnhub

helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx --force-update >/dev/null
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/ --force-update >/dev/null
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts --force-update >/dev/null
helm repo add argo https://argoproj.github.io/argo-helm --force-update >/dev/null

echo "Installing ingress-nginx"
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx --version 4.15.1 \
  -n ingress-nginx --create-namespace -f k8s/ingress-nginx-kind-values.yaml --wait

echo "Installing metrics-server"
helm upgrade --install metrics-server metrics-server/metrics-server --version 3.14.0 \
  -n kube-system -f monitoring/metrics-server-values.yaml --wait

echo "Installing Prometheus and Grafana"
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
make_secret monitoring grafana-admin admin-user=admin admin-password=random
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack --version 92.9.0 \
  -n monitoring -f monitoring/kube-prometheus-stack-values.yaml --wait --timeout 10m

echo "Preparing the app namespace"
kubectl apply -f k8s/namespace.yaml
make_secret respawnhub respawnhub-db password=random

echo "Installing Argo CD"
helm upgrade --install argocd argo/argo-cd --version 10.10.5 \
  -n argocd --create-namespace -f argocd/argocd-values.yaml --wait
kubectl apply -f argocd/application.yaml

cat <<MSG

Cluster ready. Argo CD is now syncing the app from GitHub.
  App:      http://respawnhub.localhost/
  Grafana:  kubectl -n monitoring port-forward svc/monitoring-grafana 3001:80
            user admin, password: kubectl -n monitoring get secret grafana-admin -o jsonpath='{.data.admin-password}' | base64 -d
  Argo CD:  kubectl -n argocd port-forward svc/argocd-server 8081:80
            password: kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d
MSG
