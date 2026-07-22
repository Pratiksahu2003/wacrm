import { NextResponse } from 'next/server';
import { createEmulatorClient } from '@/lib/supabase/emulator-server';
import { query } from '@/lib/mysql';
import { sessionUserFromRequest } from '@/lib/session-token';
import {
  assertCanPerform,
  PlanGateError,
  planGateResponse,
  type PlanCapability,
  type PlanLimitKey,
} from '@/lib/vedmint-subscription/server';

const TABLES_WITH_ACCOUNT_ID = [
  'profiles',
  'accounts',
  'contacts',
  'tags',
  'custom_fields',
  'contact_notes',
  'conversations',
  'whatsapp_config',
  'member_whatsapp_config',
  'message_templates',
  'pipelines',
  'deals',
  'broadcasts',
  'automations',
  'automation_logs',
  'automation_pending_executions',
  'flows',
  'flow_runs'
];

const INSERT_PLAN_GATES: Record<
  string,
  { capability: PlanCapability; limitKey?: PlanLimitKey }
> = {
  contacts: { capability: 'contacts', limitKey: 'max_contacts' },
  deals: { capability: 'pipelines' },
  pipelines: { capability: 'pipelines' },
  message_templates: { capability: 'templates' },
  broadcasts: { capability: 'broadcasts', limitKey: 'max_broadcasts_per_month' },
  automations: { capability: 'automations', limitKey: 'max_automations' },
  flows: { capability: 'flows', limitKey: 'max_flows' },
};

export async function POST(request: Request) {
  try {
    // 1. Authenticate user from session cookie
    const sessionUser = await sessionUserFromRequest(request);

    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized: No session cookie' }, { status: 401 });
    }

    const userId = sessionUser.id;

    // 2. Fetch user's account_id and role
    const profiles = await query('SELECT account_id, account_role FROM profiles WHERE user_id = ?', [userId]);
    const profile = profiles[0];
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized: Profile not found' }, { status: 401 });
    }

    const { account_id: accountId, account_role: accountRole } = profile;

    // 3. Parse query state
    const body = await request.json();
    const {
      tableName,
      selectFields,
      conditions,
      orderColumns,
      limitCount,
      offsetCount,
      orFilter,
      countOption,
      singleResult,
      maybeSingleResult,
      isInsert,
      isUpdate,
      isDelete,
      isUpsert,
      dataToSet
    } = body;

    // 4. Enforce Tenancy Isolation (RLS Emulator)
    const finalConditions = [...(conditions || [])];
    if (TABLES_WITH_ACCOUNT_ID.includes(tableName)) {
      // Filter out any client-provided account_id filter to prevent override
      const filtered = finalConditions.filter(c => c.column !== 'account_id');
      finalConditions.length = 0;
      finalConditions.push(...filtered, { column: 'account_id', operator: '=', value: accountId });
    }

    // Tenancy isolation for profiles (only see profiles in own account)
    if (tableName === 'profiles') {
      const filtered = finalConditions.filter(c => c.column !== 'account_id');
      finalConditions.length = 0;
      finalConditions.push(...filtered, { column: 'account_id', operator: '=', value: accountId });
    }

    // Tenancy check for inserts
    let finalDataToSet = dataToSet;
    if (isInsert && finalDataToSet) {
      const isArray = Array.isArray(finalDataToSet);
      const rows = isArray ? finalDataToSet : [finalDataToSet];
      for (const row of rows) {
        if (TABLES_WITH_ACCOUNT_ID.includes(tableName)) {
          row.account_id = accountId;
        }
      }
      finalDataToSet = isArray ? rows : rows[0];

      const gate = INSERT_PLAN_GATES[tableName];
      if (gate) {
        try {
          await assertCanPerform(userId, accountId, gate.capability, {
            limitKey: gate.limitKey,
            adding: rows.length,
          });
        } catch (err) {
          if (err instanceof PlanGateError) return planGateResponse(err);
          throw err;
        }
      }
    }

    // Tenancy check for updates
    if (isUpdate && finalDataToSet) {
      if (TABLES_WITH_ACCOUNT_ID.includes(tableName)) {
        finalDataToSet.account_id = accountId;
      }
    }

    // 5. Instantiate server-side emulator and build query
    const client = createEmulatorClient();
    let builder = client.from(tableName);

    // Reconstruct builder state
    builder['selectFields'] = selectFields || '*';
    builder['conditions'] = finalConditions;
    builder['orderColumns'] = orderColumns || [];
    builder['limitCount'] = limitCount;
    builder['offsetCount'] = offsetCount ?? null;
    builder['orFilter'] = orFilter ?? null;
    builder['countOption'] = countOption;
    builder['singleResult'] = singleResult;
    builder['maybeSingleResult'] = maybeSingleResult;
    builder['isInsert'] = isInsert;
    builder['isUpdate'] = isUpdate;
    builder['isDelete'] = isDelete;
    builder['isUpsert'] = isUpsert;
    builder['dataToSet'] = finalDataToSet;

    // 6. Execute query on server and return response
    const result = await builder;
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[POST /api/db-proxy] unexpected error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
