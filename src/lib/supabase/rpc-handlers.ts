import { query, transaction } from '@/lib/mysql';
import crypto from 'crypto';

export async function executeRpc(fnName: string, args: any, currentUserId?: string) {
  try {
    switch (fnName) {
      case 'increment_flow_execution_count': {
        const { id } = args || {};
        await query('UPDATE flows SET execution_count = COALESCE(execution_count, 0) + 1 WHERE id = ?', [id]);
        return { data: null, error: null };
      }

      case 'increment_automation_execution_count': {
        const { id } = args || {};
        await query('UPDATE automations SET execution_count = COALESCE(execution_count, 0) + 1 WHERE id = ?', [id]);
        return { data: null, error: null };
      }

      case 'peek_invitation': {
        const { p_token_hash } = args || {};
        const invs = await query('SELECT * FROM account_invitations WHERE token_hash = ?', [p_token_hash]);
        const inv = invs[0];
        if (!inv) return { data: { ok: false, reason: 'not_found' }, error: null };
        if (inv.accepted_at) return { data: { ok: false, reason: 'used' }, error: null };
        if (new Date(inv.expires_at) <= new Date()) return { data: { ok: false, reason: 'expired' }, error: null };

        const accounts = await query('SELECT name FROM accounts WHERE id = ?', [inv.account_id]);
        return {
          data: {
            ok: true,
            account_name: accounts[0]?.name || 'Unknown',
            role: inv.role,
            expires_at: inv.expires_at
          },
          error: null
        };
      }

      case 'redeem_invitation': {
        if (!currentUserId) {
          return { data: null, error: { message: 'Unauthorized' } };
        }
        const { p_token_hash } = args || {};

        return await transaction(async (conn) => {
          // Lock invite row
          const [invs] = await conn.query('SELECT * FROM account_invitations WHERE token_hash = ? FOR UPDATE', [p_token_hash]);
          const inv = (invs as any[])[0];
          if (!inv) {
            throw new Error('Invitation not found');
          }
          if (inv.accepted_at) {
            throw new Error('Invitation already used');
          }
          if (new Date(inv.expires_at) <= new Date()) {
            throw new Error('Invitation expired');
          }

          // Get caller profile details
          const [profiles] = await conn.query('SELECT account_id FROM profiles WHERE user_id = ?', [currentUserId]);
          const profile = (profiles as any[])[0];
          if (!profile) {
            throw new Error('Caller profile not found');
          }

          const oldAccountId = profile.account_id;

          // Check if caller is owner of their old account
          const [accounts] = await conn.query('SELECT owner_user_id FROM accounts WHERE id = ?', [oldAccountId]);
          const account = (accounts as any[])[0];
          
          if (account && account.owner_user_id === currentUserId) {
            // Verify there are no domain rows in old account to prevent data loss
            const [contacts] = await conn.query('SELECT id FROM contacts WHERE account_id = ? LIMIT 1', [oldAccountId]);
            if ((contacts as any[]).length > 0) {
              throw new Error('Cannot redeem invitation: Your current account contains data that would be lost.');
            }
          }

          // Move profile to target account
          await conn.query('UPDATE profiles SET account_id = ?, account_role = ? WHERE user_id = ?', [
            inv.account_id, inv.role, currentUserId
          ]);

          // Stamp invitation accepted
          await conn.query('UPDATE account_invitations SET accepted_at = NOW(), accepted_by_user_id = ? WHERE id = ?', [
            currentUserId, inv.id
          ]);

          // Cleanup old personal account
          if (account && account.owner_user_id === currentUserId && oldAccountId !== inv.account_id) {
            await conn.query('DELETE FROM accounts WHERE id = ?', [oldAccountId]);
          }

          return { data: inv.account_id, error: null };
        });
      }

      case 'set_member_role': {
        if (!currentUserId) {
          return { data: null, error: { message: 'Unauthorized' } };
        }
        const { p_user_id, p_new_role } = args || {};

        if (p_user_id === currentUserId) {
          return { data: null, error: { message: 'Cannot change your own role' } };
        }

        const callerProfiles = await query('SELECT account_id, account_role FROM profiles WHERE user_id = ?', [currentUserId]);
        const caller = callerProfiles[0];
        if (!caller || !['owner', 'admin'].includes(caller.account_role)) {
          return { data: null, error: { message: 'Only account owners and admins can edit member roles' } };
        }

        const targetProfiles = await query('SELECT account_id, account_role FROM profiles WHERE user_id = ?', [p_user_id]);
        const target = targetProfiles[0];
        if (!target || target.account_id !== caller.account_id) {
          return { data: null, error: { message: 'Target user not found or not in your account' } };
        }

        if (target.account_role === 'owner' || p_new_role === 'owner') {
          return { data: null, error: { message: 'Use transfer_account_ownership to promote/demote owners' } };
        }

        await query('UPDATE profiles SET account_role = ? WHERE user_id = ?', [p_new_role, p_user_id]);
        return { data: null, error: null };
      }

      case 'remove_account_member': {
        if (!currentUserId) {
          return { data: null, error: { message: 'Unauthorized' } };
        }
        const { p_user_id } = args || {};

        if (p_user_id === currentUserId) {
          return { data: null, error: { message: 'Cannot remove yourself' } };
        }

        const callerProfiles = await query('SELECT account_id, account_role FROM profiles WHERE user_id = ?', [currentUserId]);
        const caller = callerProfiles[0];
        if (!caller || !['owner', 'admin'].includes(caller.account_role)) {
          return { data: null, error: { message: 'Only account owners and admins can remove members' } };
        }

        const targetProfiles = await query('SELECT account_id, account_role, full_name, email FROM profiles WHERE user_id = ?', [p_user_id]);
        const target = targetProfiles[0];
        if (!target || target.account_id !== caller.account_id) {
          return { data: null, error: { message: 'Target user not found or not in your account' } };
        }

        if (target.account_role === 'owner') {
          return { data: null, error: { message: 'Cannot remove the account owner' } };
        }

        const newAccountId = crypto.randomUUID();

        await transaction(async (conn) => {
          // Create fresh personal account for target
          await conn.query('INSERT INTO accounts (id, name, owner_user_id) VALUES (?, ?, ?)', [
            newAccountId, target.full_name || target.email || 'My account', p_user_id
          ]);
          // Reassign target profile to their own account as owner
          await conn.query('UPDATE profiles SET account_id = ?, account_role = "owner" WHERE user_id = ?', [
            newAccountId, p_user_id
          ]);
        });

        return { data: newAccountId, error: null };
      }

      case 'transfer_account_ownership': {
        if (!currentUserId) {
          return { data: null, error: { message: 'Unauthorized' } };
        }
        const { p_new_owner_user_id } = args || {};

        if (p_new_owner_user_id === currentUserId) {
          return { data: null, error: { message: 'You are already the owner' } };
        }

        const callerProfiles = await query('SELECT account_id, account_role FROM profiles WHERE user_id = ?', [currentUserId]);
        const caller = callerProfiles[0];
        if (!caller || caller.account_role !== 'owner') {
          return { data: null, error: { message: 'Only the account owner can transfer ownership' } };
        }

        const targetProfiles = await query('SELECT account_id, account_role FROM profiles WHERE user_id = ?', [p_new_owner_user_id]);
        const target = targetProfiles[0];
        if (!target || target.account_id !== caller.account_id) {
          return { data: null, error: { message: 'Target user not found or not in your account' } };
        }

        await transaction(async (conn) => {
          // Demote current owner to admin
          await conn.query('UPDATE profiles SET account_role = "admin" WHERE user_id = ?', [currentUserId]);
          // Promote target to owner
          await conn.query('UPDATE profiles SET account_role = "owner" WHERE user_id = ?', [p_new_owner_user_id]);
          // Update accounts.owner_user_id
          await conn.query('UPDATE accounts SET owner_user_id = ? WHERE id = ?', [p_new_owner_user_id, caller.account_id]);
        });

        return { data: null, error: null };
      }

      case 'leave_team': {
        if (!currentUserId) {
          return { data: null, error: { message: 'Unauthorized' } };
        }

        return await transaction(async (conn) => {
          const [profiles] = await conn.query('SELECT account_id, account_role, full_name, email FROM profiles WHERE user_id = ?', [currentUserId]);
          const profile = (profiles as any[])[0];
          if (!profile) {
            throw new Error('Caller profile not found');
          }

          if (profile.account_role === 'owner') {
            throw new Error('Account owners cannot leave their team. Transfer ownership first.');
          }

          const oldAccountId = profile.account_id;

          // Check if user already owns an empty personal account
          const [accounts] = await conn.query('SELECT id FROM accounts WHERE owner_user_id = ?', [currentUserId]);
          let newAccountId = (accounts as any[])[0]?.id;

          if (!newAccountId) {
            newAccountId = crypto.randomUUID();
            await conn.query('INSERT INTO accounts (id, name, owner_user_id) VALUES (?, ?, ?)', [
              newAccountId, profile.full_name || profile.email || 'My account', currentUserId
            ]);
          }

          // Move profile to personal account
          await conn.query('UPDATE profiles SET account_id = ?, account_role = "owner" WHERE user_id = ?', [
            newAccountId, currentUserId
          ]);

          // Clear personal whatsapp config
          await conn.query('DELETE FROM member_whatsapp_config WHERE user_id = ?', [currentUserId]);

          // Unassign conversations, contacts and deals on the team left behind
          await conn.query('UPDATE contacts SET assigned_to = NULL WHERE account_id = ? AND assigned_to = ?', [oldAccountId, currentUserId]);
          await conn.query('UPDATE conversations SET assigned_agent_id = NULL WHERE account_id = ? AND assigned_agent_id = ?', [oldAccountId, currentUserId]);
          await conn.query('UPDATE deals SET assigned_to = NULL WHERE account_id = ? AND assigned_to = ?', [oldAccountId, currentUserId]);

          return { data: newAccountId, error: null };
        });
      }

      default:
        return { data: null, error: { message: `Unknown RPC function: ${fnName}` } };
    }
  } catch (err: any) {
    console.error(`[RPC ${fnName}] execution error:`, err);
    return { data: null, error: { message: err.message || err.toString() } };
  }
}
