-- ============================================================
-- SuGanta Assistant flow — DB seed / upgrade (not app code).
--
-- Replaces the existing "Bot" flow row and its nodes in
-- `flows` + `flow_nodes`. The runtime reads flows from the DB
-- only; edit via Settings → Flows or PUT /api/flows/[id].
--
-- Idempotent: safe to re-run. Targets flow id
-- 9799fb41-aed1-4bb6-94e1-854d909a3666 (production Bot flow).
-- ============================================================

UPDATE flows SET
  name = 'SuGanta Assistant',
  description = 'Modern education chatbot - routes students, teachers, and institutes with menus, smart replies, and live-agent handoff.',
  trigger_type = 'keyword',
  trigger_config = '{"keywords":["hi","hello","hey","menu","start","bot","suganta","help","join"],"match_type":"contains"}'::jsonb,
  entry_node_id = 'start',
  fallback_policy = '{"on_unknown_reply":"reprompt","max_reprompts":2,"on_timeout_hours":24,"on_exhaust":"handoff"}'::jsonb,
  status = 'active',
  updated_at = NOW()
WHERE id = '9799fb41-aed1-4bb6-94e1-854d909a3666';
DELETE FROM flow_nodes WHERE flow_id = '9799fb41-aed1-4bb6-94e1-854d909a3666';
INSERT INTO flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
VALUES (
  '9799fb41-aed1-4bb6-94e1-854d909a3666',
  'start',
  'start',
  '{"next_node_key":"greet"}'::jsonb,
  0,
  0
);
INSERT INTO flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
VALUES (
  '9799fb41-aed1-4bb6-94e1-854d909a3666',
  'greet',
  'send_message',
  '{"text":"≡ƒÄô Welcome to *SuGanta* ΓÇö India''s smart education platform.\n\nConnect with tutors, institutes, study resources, and Kaalo AI ΓÇö all in one place.\n\nWho are you today?","next_node_key":"role_pick"}'::jsonb,
  0,
  0
);
INSERT INTO flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
VALUES (
  '9799fb41-aed1-4bb6-94e1-854d909a3666',
  'role_pick',
  'send_buttons',
  '{"text":"Pick the option that best describes you:","footer_text":"Tap a button to continue Γåô","buttons":[{"reply_id":"student","title":"I''m a Student","next_node_key":"student_intro"},{"reply_id":"teacher","title":"I''m a Teacher","next_node_key":"teacher_intro"},{"reply_id":"more","title":"More Options","next_node_key":"hub_list"}]}'::jsonb,
  0,
  0
);
INSERT INTO flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
VALUES (
  '9799fb41-aed1-4bb6-94e1-854d909a3666',
  'student_intro',
  'send_message',
  '{"text":"≡ƒôÜ *Student Hub*\n\nFind tutors, explore institutes, access study materials, and get AI-powered learning support.","next_node_key":"student_menu"}'::jsonb,
  0,
  0
);
INSERT INTO flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
VALUES (
  '9799fb41-aed1-4bb6-94e1-854d909a3666',
  'student_menu',
  'send_list',
  '{"text":"What would you like to explore?","button_label":"Student menu","footer_text":"SuGanta ΓÇö learn smarter","sections":[{"title":"Explore","rows":[{"reply_id":"tutor","title":"Find Tutor","description":"Qualified teachers","next_node_key":"msg_tutor"},{"reply_id":"institute","title":"Institutes","description":"Academies & coaching","next_node_key":"msg_institute"},{"reply_id":"store","title":"Study Store","description":"Notes & guides","next_node_key":"msg_store"},{"reply_id":"market","title":"Marketplace","description":"Buy & sell resources","next_node_key":"msg_market"},{"reply_id":"kaalo","title":"Kaalo AI","description":"AI study assistant","next_node_key":"msg_kaalo"},{"reply_id":"main","title":"Main Menu","description":"Start over","next_node_key":"greet"}]}]}'::jsonb,
  0,
  0
);
INSERT INTO flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
VALUES (
  '9799fb41-aed1-4bb6-94e1-854d909a3666',
  'teacher_intro',
  'send_message',
  '{"text":"≡ƒæ¿ΓÇì≡ƒÅ½ *Teacher Hub*\n\nBuild your profile, connect with students, and grow your teaching opportunities on SuGanta.","next_node_key":"teacher_menu"}'::jsonb,
  0,
  0
);
INSERT INTO flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
VALUES (
  '9799fb41-aed1-4bb6-94e1-854d909a3666',
  'teacher_menu',
  'send_list',
  '{"text":"How can we help you grow?","button_label":"Teacher menu","sections":[{"title":"Get started","rows":[{"reply_id":"benefits","title":"View Benefits","description":"Why join SuGanta","next_node_key":"msg_benefits"},{"reply_id":"profile","title":"Create Profile","description":"Start in minutes","next_node_key":"msg_profile"},{"reply_id":"website","title":"Visit Website","description":"Explore platform","next_node_key":"msg_website"},{"reply_id":"support","title":"Get Support","description":"Talk to our team","next_node_key":"support_ask"},{"reply_id":"main","title":"Main Menu","description":"Start over","next_node_key":"greet"}]}]}'::jsonb,
  0,
  0
);
INSERT INTO flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
VALUES (
  '9799fb41-aed1-4bb6-94e1-854d909a3666',
  'hub_list',
  'send_list',
  '{"text":"≡ƒîÉ *Explore SuGanta*\n\nBrowse all services and get the help you need.","button_label":"Open menu","sections":[{"title":"Services","rows":[{"reply_id":"students","title":"Students","description":"Student hub","next_node_key":"student_intro"},{"reply_id":"teachers","title":"Teachers","description":"Educator hub","next_node_key":"teacher_intro"},{"reply_id":"institutes","title":"Institutes","description":"Partner with us","next_node_key":"msg_institutes"},{"reply_id":"kaalo","title":"Kaalo AI","description":"AI-powered help","next_node_key":"msg_kaalo"},{"reply_id":"website","title":"Website","description":"Visit suganta.com","next_node_key":"msg_website"},{"reply_id":"live","title":"Live Support","description":"Chat with team","next_node_key":"support_ask"}]}]}'::jsonb,
  0,
  0
);
INSERT INTO flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
VALUES (
  '9799fb41-aed1-4bb6-94e1-854d909a3666',
  'msg_tutor',
  'send_message',
  '{"text":"≡ƒÄô Find qualified tutors for any subject:\nhttps://www.suganta.com/teachers","next_node_key":"post_action"}'::jsonb,
  0,
  0
);
INSERT INTO flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
VALUES (
  '9799fb41-aed1-4bb6-94e1-854d909a3666',
  'msg_institute',
  'send_message',
  '{"text":"≡ƒÅ½ Browse verified institutes, academies & coaching centers:\nhttps://www.suganta.com/institutes?order_by=recent","next_node_key":"post_action"}'::jsonb,
  0,
  0
);
INSERT INTO flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
VALUES (
  '9799fb41-aed1-4bb6-94e1-854d909a3666',
  'msg_institutes',
  'send_message',
  '{"text":"≡ƒÅ½ Partner your institute with SuGanta and reach more students:\nhttps://www.suganta.com/institutes","next_node_key":"post_action"}'::jsonb,
  0,
  0
);
INSERT INTO flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
VALUES (
  '9799fb41-aed1-4bb6-94e1-854d909a3666',
  'msg_store',
  'send_message',
  '{"text":"≡ƒôÜ Study materials, notes & educational resources:\nhttps://www.suganta.com/store","next_node_key":"post_action"}'::jsonb,
  0,
  0
);
INSERT INTO flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
VALUES (
  '9799fb41-aed1-4bb6-94e1-854d909a3666',
  'msg_market',
  'send_message',
  '{"text":"≡ƒ¢Æ SuGanta Marketplace ΓÇö educational resources & services:\nhttps://app.suganta.com","next_node_key":"post_action"}'::jsonb,
  0,
  0
);
INSERT INTO flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
VALUES (
  '9799fb41-aed1-4bb6-94e1-854d909a3666',
  'msg_kaalo',
  'send_message',
  '{"text":"≡ƒñû *Kaalo AI* ΓÇö instant study support, career guidance & smart answers:\nhttps://ai.suganta.com","next_node_key":"post_action"}'::jsonb,
  0,
  0
);
INSERT INTO flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
VALUES (
  '9799fb41-aed1-4bb6-94e1-854d909a3666',
  'msg_benefits',
  'send_message',
  '{"text":"≡ƒÄ» SuGanta helps educators connect with students, build profiles & expand reach:\nhttps://www.suganta.com","next_node_key":"post_action"}'::jsonb,
  0,
  0
);
INSERT INTO flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
VALUES (
  '9799fb41-aed1-4bb6-94e1-854d909a3666',
  'msg_profile',
  'send_message',
  '{"text":"≡ƒô¥ Create your teacher profile and start connecting with students:\nhttps://app.suganta.com","next_node_key":"post_action"}'::jsonb,
  0,
  0
);
INSERT INTO flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
VALUES (
  '9799fb41-aed1-4bb6-94e1-854d909a3666',
  'msg_website',
  'send_message',
  '{"text":"≡ƒîÉ Explore tutors, institutes, courses & AI learning on SuGanta:\nhttps://www.suganta.com","next_node_key":"post_action"}'::jsonb,
  0,
  0
);
INSERT INTO flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
VALUES (
  '9799fb41-aed1-4bb6-94e1-854d909a3666',
  'post_action',
  'send_buttons',
  '{"text":"What would you like to do next?","footer_text":"We''re here if you need help","buttons":[{"reply_id":"menu","title":"Main Menu","next_node_key":"greet"},{"reply_id":"agent","title":"Talk to Agent","next_node_key":"agent_handoff"},{"reply_id":"done","title":"All Done","next_node_key":"end"}]}'::jsonb,
  0,
  0
);
INSERT INTO flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
VALUES (
  '9799fb41-aed1-4bb6-94e1-854d909a3666',
  'support_ask',
  'collect_input',
  '{"prompt_text":"≡ƒÆ¼ *Live Support*\n\nPlease type your question or describe what you need help with. Our team will respond shortly.","var_key":"support_message","next_node_key":"support_handoff"}'::jsonb,
  0,
  0
);
INSERT INTO flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
VALUES (
  '9799fb41-aed1-4bb6-94e1-854d909a3666',
  'agent_handoff',
  'handoff',
  '{"note":"Customer requested live agent from SuGanta Assistant bot."}'::jsonb,
  0,
  0
);
INSERT INTO flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
VALUES (
  '9799fb41-aed1-4bb6-94e1-854d909a3666',
  'support_handoff',
  'handoff',
  '{"note":"Customer submitted support request via SuGanta Assistant (see flow vars)."}'::jsonb,
  0,
  0
);
INSERT INTO flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
VALUES (
  '9799fb41-aed1-4bb6-94e1-854d909a3666',
  'end',
  'end',
  '{}'::jsonb,
  0,
  0
);
UPDATE flow_runs SET
  status = 'failed',
  end_reason = 'flow_upgraded_to_suganta_assistant',
  ended_at = NOW()
WHERE flow_id = '9799fb41-aed1-4bb6-94e1-854d909a3666' AND status = 'active';
