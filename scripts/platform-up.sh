#!/usr/bin/env bash
# Installs the cluster platform (ingress-nginx, metrics-server, Prometheus +
# Grafana, Argo CD) and hands the app to Argo CD.
# Usage: scripts/platform-up.sh kind|eks   (uses the current kubectl context)
set -euo pipefail
cd "$(dirname "$0")/.."
target=${1:?usage: platform-up.sh kind|eks}

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

helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx --force-update >/dev/null
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/ --force-update >/dev/null
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts --force-update >/dev/null
helm repo add argo https://argoproj.github.io/argo-helm --force-update >/dev/null

echo "Installing ingress-nginx"
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx --version 4.15.1 \
  -n ingress-nginx --create-namespace -f "k8s/ingress-nginx-$target-values.yaml" --wait

echo "Installing metrics-server"
metrics_values=()
[ "$target" = kind ] && metrics_values=(-f monitoring/metrics-server-values.yaml)
helm upgrade --install metrics-server metrics-server/metrics-server --version 3.14.0 \
  -n kube-system "${metrics_values[@]}" --wait

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
if [ "$target" = kind ]; then
  kubectl apply -f argocd/application.yaml
else
  kubectl apply -f argocd/application-eks.yaml
fi

cat <<'MSG'

Platform ready. Argo CD is syncing the app from GitHub.
  Grafana:  kubectl -n monitoring port-forward svc/monitoring-grafana 3001:80
            password: kubectl -n monitoring get secret grafana-admin -o jsonpath='{.data.admin-password}' | base64 -d
  Argo CD:  kubectl -n argocd port-forward svc/argocd-server 8081:80
            password: kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d
MSG
