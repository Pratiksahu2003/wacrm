import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Central mapping of relation names to tables and foreign keys
const RELATIONSHIPS: Record<string, string> = {
  conversations: 'conversations',
  contacts: 'contacts',
  profiles: 'profiles',
  accounts: 'accounts',
  automations: 'automations',
  stage: 'pipeline_stages',
  pipeline_stages: 'pipeline_stages',
  pipelines: 'pipelines',
  messages: 'messages',
  broadcasts: 'broadcasts',
  flows: 'flows',
  flow_runs: 'flow_runs'
};

const JSON_COLUMNS = [
  'beta_features',
  'field_options',
  'components',
  'trigger_config',
  'steps',
  'step_config',
  'variables',
  'payload',
  'error_breakdown',
  'fallback_policy',
  'nodes',
  'edges'
];

function parseJsonFields(row: any) {
  if (!row) return row;
  const copy = { ...row };
  for (const col of JSON_COLUMNS) {
    if (col in copy && typeof copy[col] === 'string') {
      try {
        copy[col] = JSON.parse(copy[col]);
      } catch {
        // ignore
      }
    }
  }
  return copy;
}

function parseSelect(selectStr: string) {
  const fields: string[] = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < selectStr.length; i++) {
    const char = selectStr[i];
    if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    fields.push(current.trim());
  }

  const flatColumns: string[] = [];
  const nestedRelations: { name: string; alias: string; select: string }[] = [];

  for (const field of fields) {
    const match = field.match(/^([a-zA-Z0-9_:]+)\((.*)\)$/);
    if (match) {
      let nameWithAlias = match[1];
      let selectBody = match[2];
      let name = nameWithAlias;
      let alias = nameWithAlias;
      if (nameWithAlias.includes(':')) {
        const parts = nameWithAlias.split(':');
        alias = parts[0];
        name = parts[1];
      }
      nestedRelations.push({ name, alias, select: selectBody });
    } else {
      let name = field;
      let alias = field;
      if (field.includes(':')) {
        const parts = field.split(':');
        alias = parts[0];
        name = parts[1];
      }
      flatColumns.push(name);
    }
  }

  return { flatColumns, nestedRelations };
}

function getForeignKeyColumn(parentTable: string, relationName: string): { parentKey: string; childKey: string; isArray: boolean } {
  const relationshipMap: Record<string, Record<string, { parentKey: string; childKey: string; isArray: boolean }>> = {
    messages: {
      conversations: { parentKey: 'conversation_id', childKey: 'id', isArray: false }
    },
    conversations: {
      contacts: { parentKey: 'contact_id', childKey: 'id', isArray: false },
      profiles: { parentKey: 'assigned_agent_id', childKey: 'user_id', isArray: false },
      messages: { parentKey: 'id', childKey: 'conversation_id', isArray: true }
    },
    deals: {
      pipeline_stages: { parentKey: 'stage_id', childKey: 'id', isArray: false },
      stage: { parentKey: 'stage_id', childKey: 'id', isArray: false },
      contacts: { parentKey: 'contact_id', childKey: 'id', isArray: false }
    },
    contact_notes: {
      contacts: { parentKey: 'contact_id', childKey: 'id', isArray: false },
      profiles: { parentKey: 'user_id', childKey: 'user_id', isArray: false }
    },
    contact_tags: {
      contacts: { parentKey: 'contact_id', childKey: 'id', isArray: false },
      tags: { parentKey: 'tag_id', childKey: 'id', isArray: false }
    },
    automation_logs: {
      automations: { parentKey: 'automation_id', childKey: 'id', isArray: false },
      contacts: { parentKey: 'contact_id', childKey: 'id', isArray: false }
    },
    flow_runs: {
      flows: { parentKey: 'flow_id', childKey: 'id', isArray: false },
      contacts: { parentKey: 'contact_id', childKey: 'id', isArray: false }
    },
    flow_run_events: {
      flow_runs: { parentKey: 'flow_run_id', childKey: 'id', isArray: false }
    },
    profiles: {
      accounts: { parentKey: 'account_id', childKey: 'id', isArray: false }
    }
  };

  const parentMap = relationshipMap[parentTable];
  if (parentMap && parentMap[relationName]) {
    return parentMap[relationName];
  }

  const singularRelation = relationName.replace(/s$/, '');
  return {
    parentKey: `${singularRelation}_id`,
    childKey: 'id',
    isArray: false
  };
}

const JWT_SECRET = process.env.ENCRYPTION_KEY || 'VedMint Crm-secret-default-encryption-key-32-chars';

export class EmulatorQueryBuilder {
  private tableName: string;
  private selectFields: string = '*';
  private conditions: { column: string; operator: string; value: any }[] = [];
  private orderColumns: { column: string; ascending: boolean }[] = [];
  private limitCount: number | null = null;
  private countOption: string | null = null;
  private singleResult: boolean = false;
  private maybeSingleResult: boolean = false;
  private isInsert: boolean = false;
  private isUpdate: boolean = false;
  private isDelete: boolean = false;
  private isUpsert: boolean = false;
  private dataToSet: any = null;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(fields: string = '*', options?: { count?: string; head?: boolean }) {
    this.selectFields = fields;
    if (options?.count) {
      this.countOption = options.count;
    }
    return this;
  }

  insert(data: any) {
    this.isInsert = true;
    this.dataToSet = data;
    return this;
  }

  upsert(data: any, options?: any) {
    this.isInsert = true;
    this.isUpsert = true;
    this.dataToSet = data;
    return this;
  }

  update(data: any) {
    this.isUpdate = true;
    this.dataToSet = data;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  eq(column: string, value: any) {
    this.conditions.push({ column, operator: '=', value });
    return this;
  }

  neq(column: string, value: any) {
    this.conditions.push({ column, operator: '!=', value });
    return this;
  }

  gt(column: string, value: any) {
    this.conditions.push({ column, operator: '>', value });
    return this;
  }

  gte(column: string, value: any) {
    this.conditions.push({ column, operator: '>=', value });
    return this;
  }

  lt(column: string, value: any) {
    this.conditions.push({ column, operator: '<', value });
    return this;
  }

  lte(column: string, value: any) {
    this.conditions.push({ column, operator: '<=', value });
    return this;
  }

  like(column: string, pattern: string) {
    this.conditions.push({ column, operator: 'LIKE', value: pattern });
    return this;
  }

  ilike(column: string, pattern: string) {
    this.conditions.push({ column, operator: 'LIKE', value: pattern });
    return this;
  }

  in(column: string, values: any[]) {
    this.conditions.push({ column, operator: 'IN', value: values });
    return this;
  }

  is(column: string, value: any) {
    if (value === null) {
      this.conditions.push({ column, operator: 'IS NULL', value: null });
    } else {
      this.conditions.push({ column, operator: '=', value });
    }
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderColumns.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.singleResult = true;
    return this;
  }

  maybeSingle() {
    this.maybeSingleResult = true;
    return this;
  }

  async then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    try {
      const res = await this.execute();
      if (onfulfilled) return onfulfilled(res);
      return res;
    } catch (err) {
      if (onrejected) return onrejected(err);
      throw err;
    }
  }

  private compileConditions() {
    const whereParts: string[] = [];
    const whereParams: any[] = [];
    for (const cond of this.conditions) {
      if (cond.operator === 'IS NULL') {
        whereParts.push(`\`${cond.column}\` IS NULL`);
      } else if (cond.operator === 'IN') {
        if (cond.value && cond.value.length > 0) {
          const placeholders = cond.value.map(() => '?').join(', ');
          whereParts.push(`\`${cond.column}\` IN (${placeholders})`);
          whereParams.push(...cond.value);
        } else {
          // Empty in clause, force false
          whereParts.push('1 = 0');
        }
      } else {
        whereParts.push(`\`${cond.column}\` ${cond.operator} ?`);
        whereParams.push(cond.value);
      }
    }
    return {
      whereSql: whereParts.join(' AND '),
      whereParams
    };
  }

  private async execute() {
    if (typeof window !== 'undefined') {
      // Browser side: Proxy to HTTP endpoint
      const response = await fetch('/api/db-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableName: this.tableName,
          selectFields: this.selectFields,
          conditions: this.conditions,
          orderColumns: this.orderColumns,
          limitCount: this.limitCount,
          countOption: this.countOption,
          singleResult: this.singleResult,
          maybeSingleResult: this.maybeSingleResult,
          isInsert: this.isInsert,
          isUpdate: this.isUpdate,
          isDelete: this.isDelete,
          isUpsert: this.isUpsert,
          dataToSet: this.dataToSet
        })
      });
      return await response.json();
    } else {
      // Server side: Execute directly on MySQL
      const { query } = await import('@/lib/mysql');
      const crypto = await import('crypto');

      try {
        let totalCount: number | null = null;

        // Handle INSERT
        if (this.isInsert) {
          const isArray = Array.isArray(this.dataToSet);
          const rowsToInsert = isArray ? this.dataToSet : [this.dataToSet];
          const insertedRows: any[] = [];

          for (const row of rowsToInsert) {
            const rowCopy = { ...row };
            if (!rowCopy.id) {
              rowCopy.id = crypto.randomUUID();
            }
            const keys = Object.keys(rowCopy);
            const values = keys.map(k => {
              const val = rowCopy[k];
              if (val !== null && typeof val === 'object') {
                return JSON.stringify(val);
              }
              return val;
            });
             let sql = `INSERT INTO \`${this.tableName}\` (${keys.map(k => `\`${k}\``).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
             if (this.isUpsert) {
               const updateClause = keys.map(k => `\`${k}\` = VALUES(\`${k}\`)`).join(', ');
               sql += ` ON DUPLICATE KEY UPDATE ${updateClause}`;
             }
             await query(sql, values);
             insertedRows.push(rowCopy);

            // Publish realtime event to pubsub
            try {
              const { realtimePubSub } = await import('@/lib/realtime-pubsub');
              realtimePubSub.publish('db_changes', {
                table: this.tableName,
                record: rowCopy,
                type: 'INSERT'
              });
            } catch (err) {
              console.error('[Realtime Publish] Insert pubsub error:', err);
            }
          }
          return { data: isArray ? insertedRows : insertedRows[0], error: null };
        }

        // Handle UPDATE
        if (this.isUpdate) {
          const keys = Object.keys(this.dataToSet);
          const values = keys.map(k => {
            const val = this.dataToSet[k];
            if (val !== null && typeof val === 'object') {
              return JSON.stringify(val);
            }
            return val;
          });
          let sql = `UPDATE \`${this.tableName}\` SET ${keys.map(k => `\`${k}\` = ?`).join(', ')}`;
          const params = [...values];
          if (this.conditions.length > 0) {
            const { whereSql, whereParams } = this.compileConditions();
            sql += ` WHERE ${whereSql}`;
            params.push(...whereParams);
          }
          await query(sql, params);

          let updatedRows: any[] = [];
          if (this.conditions.length > 0) {
            const { whereSql, whereParams } = this.compileConditions();
            const selectSql = `SELECT * FROM \`${this.tableName}\` WHERE ${whereSql}`;
            updatedRows = await query(selectSql, whereParams);
            updatedRows = updatedRows.map(r => parseJsonFields(r));
          }

          // Publish realtime event to pubsub
          try {
            const { realtimePubSub } = await import('@/lib/realtime-pubsub');
            for (const row of updatedRows) {
              realtimePubSub.publish('db_changes', {
                table: this.tableName,
                record: row,
                type: 'UPDATE'
              });
            }
          } catch (err) {
            console.error('[Realtime Publish] Update pubsub error:', err);
          }

          return { data: this.singleResult || this.maybeSingleResult ? (updatedRows[0] || null) : updatedRows, error: null };
        }

        // Handle DELETE
        if (this.isDelete) {
          let sql = `DELETE FROM \`${this.tableName}\``;
          const params: any[] = [];
          if (this.conditions.length > 0) {
            const { whereSql, whereParams } = this.compileConditions();
            sql += ` WHERE ${whereSql}`;
            params.push(...whereParams);
          }
          await query(sql, params);
          return { data: null, error: null };
        }

        // Handle COUNT
        if (this.countOption) {
          let countSql = `SELECT COUNT(*) as count FROM \`${this.tableName}\``;
          const countParams: any[] = [];
          if (this.conditions.length > 0) {
            const { whereSql, whereParams } = this.compileConditions();
            countSql += ` WHERE ${whereSql}`;
            countParams.push(...whereParams);
          }
          const countRes = await query(countSql, countParams);
          totalCount = countRes[0]?.count ?? 0;
        }

        // Handle SELECT
        let sql = `SELECT * FROM \`${this.tableName}\``;
        const params: any[] = [];
        if (this.conditions.length > 0) {
          const { whereSql, whereParams } = this.compileConditions();
          sql += ` WHERE ${whereSql}`;
          params.push(...whereParams);
        }
        if (this.orderColumns.length > 0) {
          sql += ` ORDER BY ${this.orderColumns.map(o => `\`${o.column}\` ${o.ascending ? 'ASC' : 'DESC'}`).join(', ')}`;
        }
        if (this.limitCount !== null) {
          sql += ` LIMIT ${this.limitCount}`;
        }

        let rows = await query(sql, params);
        rows = rows.map(r => parseJsonFields(r));

        // Resolve relations
        const resolvedData = await resolveFieldsAndRelations(rows, this.selectFields, this.tableName);

        const dataResult = this.singleResult || this.maybeSingleResult
          ? (resolvedData[0] || null)
          : resolvedData;

        return { data: dataResult, error: null, count: totalCount };
      } catch (err: any) {
        console.error('[EmulatorQueryBuilder] error executing query on', this.tableName, err);
        return { data: null, error: { message: err.message, details: err.toString() }, count: null };
      }
    }
  }
}

async function resolveFieldsAndRelations(rows: any[], selectFieldsStr: string, tableName: string): Promise<any[]> {
  if (rows.length === 0) return [];
  const { flatColumns, nestedRelations } = parseSelect(selectFieldsStr);

  const mappedRows = rows.map(row => {
    if (flatColumns.includes('*') || flatColumns.length === 0) {
      return { ...row };
    }
    const newRow: any = {};
    for (const col of flatColumns) {
      newRow[col] = row[col];
    }
    return newRow;
  });

  const { query } = await import('@/lib/mysql');

  for (const rel of nestedRelations) {
    const fkInfo = getForeignKeyColumn(tableName, rel.name);
    const relationTable = RELATIONSHIPS[rel.name] || rel.name;

    if (!fkInfo.isArray) {
      const parentKey = fkInfo.parentKey;
      const childKey = fkInfo.childKey;
      const parentIds = [...new Set(rows.map(r => r[parentKey]).filter(Boolean))];

      if (parentIds.length > 0) {
        const placeholders = parentIds.map(() => '?').join(', ');
        const childSql = `SELECT * FROM \`${relationTable}\` WHERE \`${childKey}\` IN (${placeholders})`;
        let childRows = await query(childSql, parentIds);
        childRows = childRows.map(r => parseJsonFields(r));

        childRows = await resolveFieldsAndRelations(childRows, rel.select, relationTable);

        const childByFk = new Map();
        for (const cr of childRows) {
          childByFk.set(cr[childKey], cr);
        }

        for (let i = 0; i < rows.length; i++) {
          const pVal = rows[i][parentKey];
          mappedRows[i][rel.alias] = childByFk.get(pVal) || null;
        }
      } else {
        for (let i = 0; i < rows.length; i++) {
          mappedRows[i][rel.alias] = null;
        }
      }
    } else {
      const parentKey = fkInfo.parentKey;
      const childKey = fkInfo.childKey;
      const parentIds = [...new Set(rows.map(r => r[parentKey]).filter(Boolean))];

      if (parentIds.length > 0) {
        const placeholders = parentIds.map(() => '?').join(', ');
        const childSql = `SELECT * FROM \`${relationTable}\` WHERE \`${childKey}\` IN (${placeholders})`;
        let childRows = await query(childSql, parentIds);
        childRows = childRows.map(r => parseJsonFields(r));

        childRows = await resolveFieldsAndRelations(childRows, rel.select, relationTable);

        const childrenByParentId = new Map();
        for (const cr of childRows) {
          const pId = cr[childKey];
          if (!childrenByParentId.has(pId)) {
            childrenByParentId.set(pId, []);
          }
          childrenByParentId.get(pId).push(cr);
        }

        for (let i = 0; i < rows.length; i++) {
          const pVal = rows[i][parentKey];
          mappedRows[i][rel.alias] = childrenByParentId.get(pVal) || [];
        }
      } else {
        for (let i = 0; i < rows.length; i++) {
          mappedRows[i][rel.alias] = [];
        }
      }
    }
  }

  return mappedRows;
}

export function createEmulatorClient() {
  const auth = {
    async getSession() {
      if (typeof window !== 'undefined') {
        const cookies = document.cookie.split(';').map(c => c.trim());
        const sessionCookie = cookies.find(c => c.startsWith('vedmint_crm_session='));
        if (!sessionCookie) return { data: { session: null }, error: null };
        const token = sessionCookie.split('=')[1];
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          return {
            data: {
              session: {
                user: { id: decoded.userId, email: decoded.email },
                access_token: token
              }
            },
            error: null
          };
        } catch {
          return { data: { session: null }, error: null };
        }
      } else {
        const { cookies } = await import('next/headers');
        const cookieStore = await cookies();
        const token = cookieStore.get('vedmint_crm_session')?.value;
        if (!token) return { data: { session: null }, error: null };
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          return {
            data: {
              session: {
                user: { id: decoded.userId, email: decoded.email },
                access_token: token
              }
            },
            error: null
          };
        } catch {
          return { data: { session: null }, error: null };
        }
      }
    },

    async getUser() {
      const { data, error } = await this.getSession();
      return { data: { user: data?.session?.user || null }, error };
    },

    async signInWithPassword({ email, password }: any) {
      if (typeof window !== 'undefined') {
        const res = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        return await res.json();
      } else {
        const { query } = await import('@/lib/mysql');
        const dbUsers = await query('SELECT * FROM users WHERE email = ?', [email]);
        const dbUser = dbUsers[0];
        if (!dbUser || !bcrypt.compareSync(password, dbUser.password_hash)) {
          return { data: null, error: { message: 'Invalid credentials' } };
        }
        const token = jwt.sign({ userId: dbUser.id, email: dbUser.email }, JWT_SECRET, { expiresIn: '7d' });
        const user = { id: dbUser.id, email: dbUser.email };
        const session = { user, access_token: token };

        return { data: { user, session }, error: null };
      }
    },

    async signUp({ email, password, options }: any) {
      if (typeof window !== 'undefined') {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, options })
        });
        return await res.json();
      } else {
        const { query, transaction } = await import('@/lib/mysql');
        const crypto = await import('crypto');

        const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
          return { data: null, error: { message: 'User already exists' } };
        }

        const userId = crypto.randomUUID();
        const accountId = crypto.randomUUID();
        const profileId = crypto.randomUUID();
        const hash = bcrypt.hashSync(password, 10);
        const fullName = options?.data?.full_name || '';

        await transaction(async (conn) => {
          await conn.query('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)', [userId, email, hash]);
          await conn.query('INSERT INTO accounts (id, name, owner_user_id) VALUES (?, ?, ?)', [accountId, fullName || email, userId]);
          await conn.query('INSERT INTO profiles (id, user_id, full_name, email, account_id, account_role) VALUES (?, ?, ?, ?, ?, ?)', [
            profileId, userId, fullName, email, accountId, 'owner'
          ]);
        });

        const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
        const user = { id: userId, email };
        const session = { user, access_token: token };

        return { data: { user, session }, error: null };
      }
    },

    async signOut() {
      if (typeof window !== 'undefined') {
        document.cookie = 'vedmint_crm_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      } else {
        const { cookies } = await import('next/headers');
        const cookieStore = await cookies();
        cookieStore.delete('vedmint_crm_session');
      }
      return { error: null };
    },

    async resetPasswordForEmail(email: string, options?: any) {
      // In custom SMTP config: send a reset password email link
      if (typeof window !== 'undefined') {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, options })
        });
        return await res.json();
      } else {
        const { query } = await import('@/lib/mysql');
        const { sendPasswordResetEmail, smtpErrorMessage } = await import('@/lib/auth-mail');
        const normalizedEmail = email.trim().toLowerCase();
        const users = await query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
        if (users.length === 0) {
          // Do not reveal whether the account exists.
          return { error: null };
        }

        const token = jwt.sign({ email: normalizedEmail, type: 'reset-password' }, JWT_SECRET, { expiresIn: '1h' });
        const redirectTo =
          options?.redirectTo || 'http://localhost:3000/auth/callback?next=%2Freset-password';

        try {
          await sendPasswordResetEmail(normalizedEmail, redirectTo, token);
        } catch (err) {
          console.error('[auth.resetPasswordForEmail] SMTP error:', err);
          return { error: { message: smtpErrorMessage(err) } };
        }

        return { error: null };
      }
    },

    async updateUser({ password }: any) {
      const session = await this.getSession();
      const userId = session.data?.session?.user?.id;
      if (!userId) return { error: { message: 'Not authenticated' } };

      if (typeof window !== 'undefined') {
        const res = await fetch('/api/auth/update-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        return await res.json();
      } else {
        const { query } = await import('@/lib/mysql');
        const hash = bcrypt.hashSync(password, 10);
        await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
        return { data: { user: session.data?.session?.user }, error: null };
      }
    },

    onAuthStateChange(callback: any) {
      // Stub listener
      return {
        data: {
          subscription: {
            unsubscribe() {}
          }
        }
      };
    }
  };

  const storage = {
    from(bucketName: string) {
      return {
        async upload(pathStr: string, file: File | Buffer, options?: any) {
          if (typeof window !== 'undefined') {
            const formData = new FormData();
            formData.append('bucket', bucketName);
            formData.append('path', pathStr);
            formData.append('file', file as File);
            
            const res = await fetch('/api/storage/upload', {
              method: 'POST',
              body: formData
            });
            return await res.json();
          } else {
            const { uploadObject } = await import('@/lib/storage');

            let bodyBuffer: Buffer;
            let contentType = 'application/octet-stream';
            
            if (file instanceof Buffer) {
              bodyBuffer = file;
            } else if (file && typeof (file as any).arrayBuffer === 'function') {
              bodyBuffer = Buffer.from(await (file as File).arrayBuffer());
              contentType = (file as File).type || contentType;
            } else {
              bodyBuffer = Buffer.from(file as any);
            }

            const stored = await uploadObject(
              bucketName,
              pathStr,
              bodyBuffer,
              contentType,
            );

            return {
              data: { path: stored.path, publicUrl: stored.publicUrl },
              error: null,
            };
          }
        },

        getPublicUrl(pathStr: string) {
          const key = `${bucketName}/${pathStr}`;
          const publicUrl = `${process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL || 'https://pub-r2.VedMint Crm.com'}/${key}`;
          return { data: { publicUrl } };
        },

        async remove(paths: string[]) {
          if (typeof window !== 'undefined') {
            await fetch('/api/storage/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bucket: bucketName, paths })
            });
          } else {
            const { deleteObjects } = await import('@/lib/storage');
            await deleteObjects(bucketName, paths);
          }
          return { error: null };
        }
      };
    }
  };

  const channel = (channelName: string) => {
    const listeners: { table: string; callback: (payload: any) => void }[] = [];
    let eventSource: any = null;

    return {
      on(event: string, filter: any, callback: any) {
        listeners.push({
          table: filter.table,
          callback: (payload: any) => {
            const supabasePayload = {
              new: payload.record,
              old: payload.type === 'UPDATE' ? payload.record : null,
              eventType: payload.type,
              schema: 'public',
              table: payload.table,
              commit_timestamp: new Date().toISOString()
            };
            callback(supabasePayload);
          }
        });
        return this;
      },
      subscribe() {
        if (typeof window !== 'undefined' && !eventSource) {
          eventSource = new EventSource('/api/realtime');
          eventSource.onmessage = (e: any) => {
            try {
              const payload = JSON.parse(e.data);
              for (const listener of listeners) {
                if (listener.table === payload.table) {
                  listener.callback(payload);
                }
              }
            } catch (err) {
              console.error('[Emulator Realtime] error parsing message:', err);
            }
          };
        }
        return this;
      },
      unsubscribe() {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
      }
    };
  };

  const rpc = async (fnName: string, args?: any) => {
    if (typeof window !== 'undefined') {
      const res = await fetch('/api/db-proxy/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fnName, args })
      });
      return await res.json();
    } else {
      const session = await auth.getSession();
      const userId = session.data?.session?.user?.id;
      const { executeRpc } = await import('./rpc-handlers');
      return await executeRpc(fnName, args, userId);
    }
  };

  return {
    from(tableName: string) {
      return new EmulatorQueryBuilder(tableName);
    },
    auth,
    storage,
    channel,
    removeChannel(chan: any) {
      if (chan && typeof chan.unsubscribe === 'function') {
        chan.unsubscribe();
      }
    },
    rpc
  };
}
