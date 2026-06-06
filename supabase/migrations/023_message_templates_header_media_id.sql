-- Cache WhatsApp Cloud API media id resolved from Meta upload handles.
-- Media ids expire after ~30 days; send path re-resolves from header_handle
-- when the cached id is missing or rejected.
ALTER TABLE message_templates
  ADD COLUMN IF NOT EXISTS header_media_id TEXT;
