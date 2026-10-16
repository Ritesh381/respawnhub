# Terraform: AWS VPC and EKS

Creates the AWS side of RespawnHub in `ap-south-1`:

- VPC across two availability zones with two public and two private subnets
- One NAT gateway so private nodes can pull images
- EKS cluster (Kubernetes 1.36) with a managed node group of `t3.large` workers
- Add-ons: VPC CNI, CoreDNS, kube-proxy, Pod Identity agent and the EBS CSI driver, which also sets up a default gp3 StorageClass for the Postgres volume

State is kept locally (`terraform.tfstate`, git ignored).

## Use

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # set aws_profile
terraform init
terraform plan -out tfplan
terraform apply tfplan
aws eks update-kubeconfig --region ap-south-1 --name respawnhub-eks
```

Then install the platform and hand the app to Argo CD with `scripts/eks-up.sh` from the repo root.

## Clean up

Delete anything that created AWS load balancers first, then destroy:

```bash
helm uninstall ingress-nginx -n ingress-nginx
terraform destroy
```

Rough cost while running: about USD 0.37 per hour (EKS control plane, two t3.large nodes, NAT gateway, load balancer).
