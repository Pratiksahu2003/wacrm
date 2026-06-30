-- Fix leave_team failing after admin-only assignee guards (035).
-- System RPCs must clear assignees without requiring admin role.

CREATE OR REPLACE FUNCTION public.assignee_guard_is_bypassed()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('vedmint_crm.bypass_assignee_guard', true) = 'true';
$$;

CREATE OR REPLACE FUNCTION guard_conversation_assignee_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF assignee_guard_is_bypassed() THEN
    RETURN NEW;
  END IF;
  IF NEW.assigned_agent_id IS DISTINCT FROM OLD.assigned_agent_id THEN
    IF NOT is_account_member(NEW.account_id, 'admin') THEN
      RAISE EXCEPTION 'Only account owners and admins can assign conversations'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION guard_contact_assignee_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF assignee_guard_is_bypassed() THEN
    RETURN NEW;
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    IF NOT is_account_member(NEW.account_id, 'admin') THEN
      RAISE EXCEPTION 'Only account owners and admins can assign leads'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_team()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role account_role_enum;
  v_old_account_id UUID;
  v_caller_name TEXT;
  v_caller_email TEXT;
  v_new_account_id UUID;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT account_id, account_role, full_name, email
  INTO v_old_account_id, v_caller_role, v_caller_name, v_caller_email
  FROM profiles
  WHERE user_id = v_caller_id;

  IF v_old_account_id IS NULL THEN
    RAISE EXCEPTION 'Caller has no account' USING ERRCODE = '42501';
  END IF;

  IF v_caller_role = 'owner' THEN
    RAISE EXCEPTION 'Account owners cannot leave their team. Transfer ownership or delete the account instead.'
      USING ERRCODE = '22023';
  END IF;

  -- Reuse an existing personal account when one already exists (e.g. the
  -- old row was not deleted when the user joined another team).
  SELECT id INTO v_new_account_id
  FROM accounts
  WHERE owner_user_id = v_caller_id;

  IF v_new_account_id IS NULL THEN
    INSERT INTO accounts (name, owner_user_id)
    VALUES (
      COALESCE(NULLIF(v_caller_name, ''), v_caller_email, 'My account'),
      v_caller_id
    )
    RETURNING id INTO v_new_account_id;
  END IF;

  UPDATE profiles
  SET account_id = v_new_account_id,
      account_role = 'owner'
  WHERE user_id = v_caller_id;

  DELETE FROM member_whatsapp_config WHERE user_id = v_caller_id;

  -- Bypass assignee guards while clearing stale assignments on the team
  -- the user is leaving (caller's JWT role is usually agent/viewer).
  PERFORM set_config('vedmint_crm.bypass_assignee_guard', 'true', true);

  UPDATE contacts
  SET assigned_to = NULL
  WHERE account_id = v_old_account_id
    AND assigned_to = v_caller_id;

  UPDATE conversations
  SET assigned_agent_id = NULL
  WHERE account_id = v_old_account_id
    AND assigned_agent_id = v_caller_id;

  UPDATE deals
  SET assigned_to = NULL
  WHERE account_id = v_old_account_id
    AND assigned_to = v_caller_id;

  RETURN v_new_account_id;
END;
$$;

ALTER FUNCTION public.leave_team() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.leave_team() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_team() TO authenticated;
