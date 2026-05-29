variable "tenancy_ocid" {
  description = "Oracle Cloud tenancy OCID"
  type        = string
  sensitive   = true
}

variable "user_ocid" {
  description = "Oracle Cloud user OCID"
  type        = string
  sensitive   = true
}

variable "fingerprint" {
  description = "API key fingerprint"
  type        = string
  sensitive   = true
}

variable "private_key_path" {
  description = "Path to OCI API private key"
  type        = string
  default     = "~/.oci/oci_api_key.pem"
}

variable "region" {
  description = "Oracle Cloud region"
  type        = string
  default     = "us-ashburn-1"
}

variable "compartment_id" {
  description = "OCI compartment OCID"
  type        = string
}

variable "environment" {
  description = "Deployment environment (staging | production)"
  type        = string
  default     = "production"
}

variable "server_image_url" {
  description = "OCIR image URL for the server container"
  type        = string
}

variable "client_image_url" {
  description = "OCIR image URL for the client (nginx) container"
  type        = string
}

variable "redis_password" {
  description = "Redis auth password"
  type        = string
  sensitive   = true
}

variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "elevenlabs_api_key" {
  description = "ElevenLabs API key for voiceover"
  type        = string
  sensitive   = true
  default     = ""
}
