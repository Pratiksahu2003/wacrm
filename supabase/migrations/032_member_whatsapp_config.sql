-- Optional per-member WhatsApp / Meta credentials. Team members share
-- the account whatsapp_config by default; they may save personal creds
-- and opt in to send from their own number instead.

CREATE TABLE member_whatsapp_config (
  user_id UUID PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  use_personal BOOLEAN NOT NULL DEFAULT false,
  phone_number_id TEXT,
  waba_id TEXT,
  access_token TEXT,
  verify_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_member_whatsapp_config_account ON member_whatsapp_config(account_id);

ALTER TABLE member_whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY member_whatsapp_config_select ON member_whatsapp_config FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_account_member(account_id, 'admin')
  );

CREATE POLICY member_whatsapp_config_insert ON member_whatsapp_config FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND is_account_member(account_id, 'agent')
  );

CREATE POLICY member_whatsapp_config_update ON member_whatsapp_config FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY member_whatsapp_config_delete ON member_whatsapp_config FOR DELETE
  USING (user_id = auth.uid());
