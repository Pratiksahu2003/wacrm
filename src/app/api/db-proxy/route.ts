import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createEmulatorClient } from '@/lib/supabase/emulator';
import { query } from '@/lib/mysql';

const JWT_SECRET = process.env.ENCRYPTION_KEY || 'wacrm-secret-default-encryption-key-32-chars';

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

export async function POST(request: Request) {
  try {
    // 1. Authenticate user from session cookie
    const cookiesHeader = request.headers.get('cookie') || '';
    const sessionCookie = cookiesHeader
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('wacrm_session='));

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized: No session cookie' }, { status: 401 });
    }

    const token = sessionCookie.split('=')[1];
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const userId = decoded.userId;

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
