-- ============================================================
-- Fix unreachable nodes in SuGanta Assistant v2:
--   msg_market  → add Marketplace row on hub_list
--   agent_handoff → wire Talk to Expert buttons
--   end         → add All Done button on post_action
-- ============================================================

UPDATE flow_nodes SET config = '{"text":"\uD83C\uDF10 *Everything SuGanta offers* \u2014 pick any service:","button_label":"Open menu","sections":[{"title":"Platform","rows":[{"reply_id":"join","title":"Join Free Now","description":"Sign up in 2 min","next_node_key":"msg_join"},{"reply_id":"students","title":"Students","description":"Find tutors & more","next_node_key":"student_intro"},{"reply_id":"teachers","title":"Teachers","description":"Grow your career","next_node_key":"teacher_intro"},{"reply_id":"institutes","title":"Institutes","description":"Partner with us","next_node_key":"msg_institutes"},{"reply_id":"market","title":"Marketplace","description":"Buy & sell resources","next_node_key":"msg_market"},{"reply_id":"kaalo","title":"Kaalo AI","description":"Free AI assistant","next_node_key":"msg_kaalo"},{"reply_id":"live","title":"Live Support","description":"Chat with team","next_node_key":"support_ask"}]}]}'::jsonb
WHERE flow_id = '9799fb41-aed1-4bb6-94e1-854d909a3666' AND node_key = 'hub_list';

UPDATE flow_nodes SET config = '{"text":"What interests you most?","button_label":"Student menu","footer_text":"Join free at app.suganta.com","sections":[{"title":"For Students","rows":[{"reply_id":"join","title":"Join Free Now","description":"Create account free","next_node_key":"msg_join"},{"reply_id":"tutor","title":"Find Tutor","description":"Top-rated teachers","next_node_key":"msg_tutor"},{"reply_id":"institute","title":"Institutes","description":"Verified academies","next_node_key":"msg_institute"},{"reply_id":"store","title":"Study Store","description":"Notes & guides","next_node_key":"msg_store"},{"reply_id":"market","title":"Marketplace","description":"Buy & sell resources","next_node_key":"msg_market"},{"reply_id":"kaalo","title":"Kaalo AI","description":"AI study buddy","next_node_key":"msg_kaalo"},{"reply_id":"main","title":"Main Menu","description":"Start over","next_node_key":"hook"}]}]}'::jsonb
WHERE flow_id = '9799fb41-aed1-4bb6-94e1-854d909a3666' AND node_key = 'student_menu';

UPDATE flow_nodes SET config = '{"text":"Ready to take the next step? \uD83D\uDE80","footer_text":"Free to join \u00b7 Cancel anytime","buttons":[{"reply_id":"join","title":"Join Free Now","next_node_key":"msg_join"},{"reply_id":"menu","title":"Main Menu","next_node_key":"hook"},{"reply_id":"done","title":"All Done","next_node_key":"end"}]}'::jsonb
WHERE flow_id = '9799fb41-aed1-4bb6-94e1-854d909a3666' AND node_key = 'post_action';

UPDATE flow_nodes SET config = '{"text":"Did you sign up? We''re excited to have you! \uD83C\uDF8A","footer_text":"Need help? Tap Talk to Expert","buttons":[{"reply_id":"app","title":"Download App","next_node_key":"msg_download"},{"reply_id":"menu","title":"Main Menu","next_node_key":"hook"},{"reply_id":"expert","title":"Talk to Expert","next_node_key":"agent_handoff"}]}'::jsonb
WHERE flow_id = '9799fb41-aed1-4bb6-94e1-854d909a3666' AND node_key = 'join_followup';
