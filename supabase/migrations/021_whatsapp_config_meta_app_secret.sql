-- whatsapp_config: per-account Meta App Secret for webhook HMAC verification.
-- Stored encrypted (same ENCRYPTION_KEY as access_token / verify_token).
-- Lets each logged-in account use their own Meta app without a global env var.

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS meta_app_secret TEXT;
