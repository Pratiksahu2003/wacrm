import { NextResponse } from 'next/server';
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.ENCRYPTION_KEY || 'wacrm-secret-default-encryption-key-32-chars';

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const cookiesHeader = request.headers.get('cookie') || '';
    const sessionCookie = cookiesHeader
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('wacrm_session='));

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = sessionCookie.split('=')[1];
    try {
      jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // 2. Parse payload
    const { bucket, paths } = await request.json();

    if (!bucket || !paths || !Array.isArray(paths)) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // 3. Delete from Cloudflare R2
    const client = new S3Client({
      region: 'auto',
      endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || '',
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || ''
      }
    });

    await client.send(new DeleteObjectsCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME || '',
      Delete: {
        Objects: paths.map((p: string) => ({ Key: `${bucket}/${p}` }))
      }
    }));

    return NextResponse.json({ data: null, error: null });
  } catch (err: any) {
    console.error('[POST /api/storage/delete] unexpected error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
