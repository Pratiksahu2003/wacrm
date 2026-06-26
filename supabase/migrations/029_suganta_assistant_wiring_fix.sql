-- ============================================================
-- SuGanta Assistant — restore broken node wiring + entry node.
-- Fixes editor saves that cleared next_node_key on buttons/rows.
-- Also breaks post_ai_action ↔ msg_ai_platform cycle so activation
-- validation passes (link is already in the message body).
-- Flow: 9799fb41-aed1-4bb6-94e1-854d909a3666
-- ============================================================

UPDATE flows SET
  entry_node_id = 'start',
  updated_at = NOW()
WHERE id = '9799fb41-aed1-4bb6-94e1-854d909a3666';

UPDATE flow_nodes SET config = '{"text":"Kaalo AI hub \u2014 what do you need help with?","button_label":"AI menu","footer_text":"Free at ai.suganta.com","sections":[{"title":"Kaalo AI","rows":[{"reply_id":"open","title":"Open Kaalo AI","description":"Start chatting now","next_node_key":"msg_ai_platform"},{"reply_id":"homework","title":"Homework Help","description":"Solve any doubt","next_node_key":"msg_ai_homework"},{"reply_id":"exam","title":"Exam Prep","description":"Boards & competitive","next_node_key":"msg_ai_exam"},{"reply_id":"career","title":"Career Guide","description":"Courses & colleges","next_node_key":"msg_ai_career"},{"reply_id":"features","title":"AI Features","description":"Full capabilities","next_node_key":"msg_ai_features"},{"reply_id":"register","title":"Register FREE","description":"Unlock full access","next_node_key":"collect_lead_student"},{"reply_id":"app","title":"Download App","description":"AI on mobile","next_node_key":"msg_download"},{"reply_id":"main","title":"Main Menu","description":"Start over","next_node_key":"hook"}]}]}'::jsonb
WHERE flow_id = '9799fb41-aed1-4bb6-94e1-854d909a3666' AND node_key = 'ai_menu';

UPDATE flow_nodes SET config = '{"text":"Ready to experience India''s smartest AI tutor? \uD83E\uDD16","footer_text":"Free forever at ai.suganta.com","buttons":[{"reply_id":"open","title":"Open Kaalo AI","next_node_key":"msg_ai_platform"},{"reply_id":"register","title":"Register FREE","next_node_key":"collect_lead_student"},{"reply_id":"menu","title":"Main Menu","next_node_key":"hook"}]}'::jsonb
WHERE flow_id = '9799fb41-aed1-4bb6-94e1-854d909a3666' AND node_key = 'post_ai_action';

UPDATE flow_nodes SET config = '{"text":"You''re almost there! What''s next? \uD83D\uDE80","footer_text":"AI free at ai.suganta.com","buttons":[{"reply_id":"ai","title":"Open Kaalo AI","next_node_key":"msg_ai_platform"},{"reply_id":"app","title":"Download App","next_node_key":"msg_download"},{"reply_id":"expert","title":"Talk to Expert","next_node_key":"agent_handoff"}]}'::jsonb
WHERE flow_id = '9799fb41-aed1-4bb6-94e1-854d909a3666' AND node_key = 'join_followup';

UPDATE flow_nodes SET config = '{"text":"What would you like to do next? \uD83D\uDE80","footer_text":"AI free at ai.suganta.com","buttons":[{"reply_id":"ai","title":"Open Kaalo AI","next_node_key":"msg_ai_platform"},{"reply_id":"menu","title":"Main Menu","next_node_key":"hook"},{"reply_id":"done","title":"All Done","next_node_key":"end"}]}'::jsonb
WHERE flow_id = '9799fb41-aed1-4bb6-94e1-854d909a3666' AND node_key = 'post_action';
