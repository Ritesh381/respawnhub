#!/usr/bin/env bash
# Points kubectl at the EKS cluster made by terraform/, then installs the
# platform and the app. Run after terraform apply.
set -euo pipefail
cd "$(dirname "$0")/.."

region=$(terraform -chdir=terraform output -raw region)
cluster=$(terraform -chdir=terraform output -raw cluster_name)
aws eks update-kubeconfig --region "$region" --name "$cluster" ${AWS_PROFILE:+--profile "$AWS_PROFILE"}
./scripts/platform-up.sh eks

echo "Waiting for the load balancer hostname"
for _ in $(seq 1 60); do
  host=$(kubectl -n ingress-nginx get svc ingress-nginx-controller \
    -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || true)
  [ -n "$host" ] && break
  sleep 10
done
echo "App: http://$host/"
