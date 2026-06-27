-- Lead assignment: contacts get an assignee; deals.assigned_to normalized
-- to profiles.user_id (same convention as conversations.assigned_agent_id).

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to ON contacts(assigned_to);

-- deals.assigned_to previously referenced profiles(id); switch to user_id.
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_assigned_to_fkey;

UPDATE deals d
SET assigned_to = p.user_id
FROM profiles p
WHERE d.assigned_to IS NOT NULL
  AND d.assigned_to = p.id;

ALTER TABLE deals
  ADD CONSTRAINT deals_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES profiles(user_id) ON DELETE SET NULL;
