#!/usr/bin/env bash
# Removes everything on AWS. Load balancers created by Kubernetes are deleted
# first, otherwise they keep the VPC from being destroyed.
set -euo pipefail
cd "$(dirname "$0")/.."

kubectl delete -f argocd/application-eks.yaml --ignore-not-found --wait=true || true
helm uninstall ingress-nginx -n ingress-nginx --wait || true
kubectl delete pvc --all -n respawnhub --wait=true || true
terraform -chdir=terraform destroy -auto-approve
