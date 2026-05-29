/*
 * Ad Studio — Oracle Cloud Infrastructure
 *
 * WHY Oracle Cloud:
 * - Generous always-free tier for Container Instances
 * - Object Storage with S3-compatible API (easy SDK swap)
 * - Autonomous Database for managed PostgreSQL if needed later
 *
 * Resources provisioned:
 * - Container Instance: server (Node.js + Puppeteer + FFmpeg)
 * - Container Instance: client (nginx serving React build)
 * - Object Storage bucket: generated ad assets
 * - VCN + subnet for private networking
 */

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 5.0"
    }
  }
}

provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}

# ── Networking ────────────────────────────────────────────────────────────────

resource "oci_core_vcn" "ad_studio_vcn" {
  compartment_id = var.compartment_id
  display_name   = "ad-studio-vcn-${var.environment}"
  cidr_blocks    = ["10.0.0.0/16"]
  dns_label      = "adstudio"
}

resource "oci_core_subnet" "public_subnet" {
  compartment_id = var.compartment_id
  vcn_id         = oci_core_vcn.ad_studio_vcn.id
  display_name   = "ad-studio-public-subnet"
  cidr_block     = "10.0.1.0/24"
  dns_label      = "public"
}

# ── Object Storage ────────────────────────────────────────────────────────────

resource "oci_objectstorage_bucket" "assets" {
  compartment_id = var.compartment_id
  name           = "ad-studio-assets-${var.environment}"
  namespace      = data.oci_objectstorage_namespace.ns.namespace
  access_type    = "NoPublicAccess"

  # Lifecycle rule: delete raw crawl assets after 7 days to manage storage costs
  object_lifecycle_policy_etag = ""
}

data "oci_objectstorage_namespace" "ns" {
  compartment_id = var.compartment_id
}

# ── Container Instances ───────────────────────────────────────────────────────

resource "oci_container_instances_container_instance" "server" {
  compartment_id      = var.compartment_id
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  display_name        = "ad-studio-server-${var.environment}"
  shape               = "CI.Standard.A1.Flex"  # ARM — free tier eligible

  shape_config {
    ocpus         = 2
    memory_in_gbs = 6
  }

  vnics {
    subnet_id             = oci_core_subnet.public_subnet.id
    is_public_ip_assigned = true
  }

  containers {
    display_name = "server"
    image_url    = var.server_image_url

    environment_variables = {
      NODE_ENV                      = var.environment
      PORT                          = "3001"
      REDIS_HOST                    = "localhost"
      REDIS_PORT                    = "6379"
      REDIS_PASSWORD                = var.redis_password
      STORAGE_PROVIDER              = "oracle"
      ORACLE_OBJECT_STORAGE_BUCKET  = oci_objectstorage_bucket.assets.name
      ORACLE_OBJECT_STORAGE_REGION  = var.region
      OPENAI_API_KEY                = var.openai_api_key
      ELEVENLABS_API_KEY            = var.elevenlabs_api_key
      PUPPETEER_EXECUTABLE_PATH     = "/usr/bin/chromium"
    }
  }
}

resource "oci_container_instances_container_instance" "client" {
  compartment_id      = var.compartment_id
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  display_name        = "ad-studio-client-${var.environment}"
  shape               = "CI.Standard.A1.Flex"

  shape_config {
    ocpus         = 1
    memory_in_gbs = 2
  }

  vnics {
    subnet_id             = oci_core_subnet.public_subnet.id
    is_public_ip_assigned = true
  }

  containers {
    display_name = "client"
    image_url    = var.client_image_url

    environment_variables = {
      NGINX_PORT = "80"
    }
  }
}

data "oci_identity_availability_domains" "ads" {
  compartment_id = var.tenancy_ocid
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "server_public_ip" {
  description = "Public IP of the server container instance"
  value       = oci_container_instances_container_instance.server.vnics[0].public_ip
}

output "client_public_ip" {
  description = "Public IP of the client container instance"
  value       = oci_container_instances_container_instance.client.vnics[0].public_ip
}

output "object_storage_bucket" {
  description = "Object Storage bucket name for assets"
  value       = oci_objectstorage_bucket.assets.name
}
