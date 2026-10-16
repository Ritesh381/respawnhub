#!/usr/bin/env bash
# Points kubectl at the EKS cluster made by terraform/, then installs the
# platform and the app. Run after terraform apply.
set -euo pipefail
cd "$(dirname "$0")/.."

# Use the same AWS profile as Terraform unless one is already set.
profile=${AWS_PROFILE:-$(sed -n 's/^aws_profile *= *"\(.*\)"/\1/p' terraform/terraform.tfvars 2>/dev/null || true)}
if [ -n "$profile" ]; then export AWS_PROFILE=$profile; fi

region=$(terraform -chdir=terraform output -raw region)
cluster=$(terraform -chdir=terraform output -raw cluster_name)
aws eks update-kubeconfig --region "$region" --name "$cluster"
./scripts/platform-up.sh eks

echo "Waiting for the load balancer hostname"
host=""
for _ in $(seq 1 60); do
  host=$(kubectl -n ingress-nginx get svc ingress-nginx-controller \
    -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || true)
  [ -n "$host" ] && break
  sleep 10
done
if [ -z "$host" ]; then
  echo "No load balancer hostname after 10 minutes. Check: kubectl -n ingress-nginx get svc" >&2
  exit 1
fi
echo "App: http://$host/"
