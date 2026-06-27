-- Restrict chat/lead assignment to account owners and admins.
-- Agents and viewers may still update other conversation/contact fields.

CREATE OR REPLACE FUNCTION guard_conversation_assignee_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_agent_id IS DISTINCT FROM OLD.assigned_agent_id THEN
    IF NOT is_account_member(NEW.account_id, 'admin') THEN
      RAISE EXCEPTION 'Only account owners and admins can assign conversations'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conversations_assignee_guard ON conversations;
CREATE TRIGGER conversations_assignee_guard
  BEFORE UPDATE OF assigned_agent_id ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION guard_conversation_assignee_update();

CREATE OR REPLACE FUNCTION guard_contact_assignee_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    IF NOT is_account_member(NEW.account_id, 'admin') THEN
      RAISE EXCEPTION 'Only account owners and admins can assign leads'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_assignee_guard ON contacts;
CREATE TRIGGER contacts_assignee_guard
  BEFORE UPDATE OF assigned_to ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION guard_contact_assignee_update();

CREATE OR REPLACE FUNCTION guard_contact_assignee_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    IF NOT is_account_member(NEW.account_id, 'admin') THEN
      RAISE EXCEPTION 'Only account owners and admins can assign leads'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_assignee_insert_guard ON contacts;
CREATE TRIGGER contacts_assignee_insert_guard
  BEFORE INSERT ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION guard_contact_assignee_insert();

CREATE OR REPLACE FUNCTION guard_conversation_assignee_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_agent_id IS NOT NULL THEN
    IF NOT is_account_member(NEW.account_id, 'admin') THEN
      RAISE EXCEPTION 'Only account owners and admins can assign conversations'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conversations_assignee_insert_guard ON conversations;
CREATE TRIGGER conversations_assignee_insert_guard
  BEFORE INSERT ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION guard_conversation_assignee_insert();
