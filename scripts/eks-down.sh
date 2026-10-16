#!/usr/bin/env bash
# Removes everything on AWS. The load balancer and the EBS volume are created
# by Kubernetes, not Terraform, so they are deleted first and waited for;
# otherwise they block the VPC from being destroyed and keep costing money.
set -euo pipefail
cd "$(dirname "$0")/.."

# Use the same AWS profile as Terraform unless one is already set.
profile=${AWS_PROFILE:-$(sed -n 's/^aws_profile *= *"\(.*\)"/\1/p' terraform/terraform.tfvars 2>/dev/null || true)}
if [ -n "$profile" ]; then export AWS_PROFILE=$profile; fi

region=$(terraform -chdir=terraform output -raw region)
cluster=$(terraform -chdir=terraform output -raw cluster_name)
aws eks update-kubeconfig --region "$region" --name "$cluster"

kubectl delete -f argocd/application-eks.yaml --ignore-not-found --wait=true
helm uninstall ingress-nginx -n ingress-nginx --wait --ignore-not-found
kubectl delete pvc --all -n respawnhub --wait=true

echo "Waiting for the load balancer and the EBS volume to be released"
until [ -z "$(kubectl get svc -A -o jsonpath='{.items[?(@.spec.type=="LoadBalancer")].metadata.name}')" ]; do
  sleep 5
done
if [ -n "$(kubectl get pv -o name)" ]; then
  kubectl wait --for=delete pv --all --timeout=5m
fi

terraform -chdir=terraform destroy -auto-approve
