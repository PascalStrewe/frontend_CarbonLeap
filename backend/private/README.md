# Private Keys Directory

This directory contains sensitive cryptographic keys used for PDF document signing.
- private.pem: RSA private key
- public.pem: RSA public key

**Important:**
- Never commit these keys to version control
- Keep secure backups of these keys
- If keys are compromised, generate new ones and revoke old ones
- Keys are automatically generated on first use if they don't exist

Note: In a production environment, consider using a proper key management service 
(like AWS KMS, Azure Key Vault, or HashiCorp Vault) instead of file-based keys.