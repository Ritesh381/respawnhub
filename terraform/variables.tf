variable "region" {
  description = "AWS region for the VPC and cluster"
  type        = string
  default     = "ap-south-1"
}

variable "aws_profile" {
  description = "Named AWS CLI profile to use. Leave null to use the default credential chain."
  type        = string
  default     = null
}

variable "cluster_name" {
  description = "Name of the EKS cluster (also used to name the VPC)"
  type        = string
  default     = "respawnhub-eks"
}

variable "kubernetes_version" {
  description = "EKS Kubernetes version. Keep it in standard support; extended support costs six times more."
  type        = string
  default     = "1.36"
}

variable "vpc_cidr" {
  description = "Address range for the VPC"
  type        = string
  default     = "10.30.0.0/16"
}

variable "node_instance_types" {
  description = "EC2 instance types for the worker node group"
  type        = list(string)
  default     = ["t3.large"]
}

variable "node_desired_size" {
  description = "Number of worker nodes to start with"
  type        = number
  default     = 2
}

variable "node_max_size" {
  description = "Upper limit for the worker node group"
  type        = number
  default     = 3
}
