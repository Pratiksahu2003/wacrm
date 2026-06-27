-- Allow account admins (and owners) to delete records — agents/viewers
-- remain view/send/edit only.

DROP POLICY IF EXISTS contacts_delete ON contacts;
CREATE POLICY contacts_delete ON contacts FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS tags_delete ON tags;
CREATE POLICY tags_delete ON tags FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS custom_fields_delete ON custom_fields;
CREATE POLICY custom_fields_delete ON custom_fields FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS contact_notes_delete ON contact_notes;
CREATE POLICY contact_notes_delete ON contact_notes FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS conversations_delete ON conversations;
CREATE POLICY conversations_delete ON conversations FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS whatsapp_config_delete ON whatsapp_config;
CREATE POLICY whatsapp_config_delete ON whatsapp_config FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS message_templates_delete ON message_templates;
CREATE POLICY message_templates_delete ON message_templates FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS pipelines_delete ON pipelines;
CREATE POLICY pipelines_delete ON pipelines FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS deals_delete ON deals;
CREATE POLICY deals_delete ON deals FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS broadcasts_delete ON broadcasts;
CREATE POLICY broadcasts_delete ON broadcasts FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS automations_delete ON automations;
CREATE POLICY automations_delete ON automations FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS flows_delete ON flows;
CREATE POLICY flows_delete ON flows FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS contact_tags_delete ON contact_tags;
CREATE POLICY contact_tags_delete ON contact_tags FOR DELETE USING (
  EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_tags.contact_id AND is_account_member(c.account_id, 'admin'))
);

DROP POLICY IF EXISTS contact_custom_values_delete ON contact_custom_values;
CREATE POLICY contact_custom_values_delete ON contact_custom_values FOR DELETE USING (
  EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_custom_values.contact_id AND is_account_member(c.account_id, 'admin'))
);

DROP POLICY IF EXISTS messages_delete ON messages;
CREATE POLICY messages_delete ON messages FOR DELETE USING (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND is_account_member(c.account_id, 'admin'))
);

DROP POLICY IF EXISTS pipeline_stages_delete ON pipeline_stages;
CREATE POLICY pipeline_stages_delete ON pipeline_stages FOR DELETE USING (
  EXISTS (SELECT 1 FROM pipelines p WHERE p.id = pipeline_stages.pipeline_id AND is_account_member(p.account_id, 'admin'))
);

DROP POLICY IF EXISTS broadcast_recipients_delete ON broadcast_recipients;
CREATE POLICY broadcast_recipients_delete ON broadcast_recipients FOR DELETE USING (
  EXISTS (SELECT 1 FROM broadcasts b WHERE b.id = broadcast_recipients.broadcast_id AND is_account_member(b.account_id, 'admin'))
);

DROP POLICY IF EXISTS automation_steps_delete ON automation_steps;
CREATE POLICY automation_steps_delete ON automation_steps FOR DELETE USING (
  EXISTS (SELECT 1 FROM automations a WHERE a.id = automation_steps.automation_id AND is_account_member(a.account_id, 'admin'))
);

DROP POLICY IF EXISTS flow_nodes_delete ON flow_nodes;
CREATE POLICY flow_nodes_delete ON flow_nodes FOR DELETE USING (
  EXISTS (SELECT 1 FROM flows f WHERE f.id = flow_nodes.flow_id AND is_account_member(f.account_id, 'admin'))
);

DROP POLICY IF EXISTS message_reactions_delete ON message_reactions;
CREATE POLICY message_reactions_delete ON message_reactions FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id = message_reactions.message_id
      AND is_account_member(c.account_id, 'admin')
  )
);
