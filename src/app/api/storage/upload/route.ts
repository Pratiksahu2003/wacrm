import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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

    // 2. Parse form data
    const formData = await request.formData();
    const bucket = formData.get('bucket') as string;
    const pathStr = formData.get('path') as string;
    const file = formData.get('file') as File;

    if (!bucket || !pathStr || !file) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // 3. Upload to Cloudflare R2
    const client = new S3Client({
      region: 'auto',
      endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || '',
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || ''
      }
    });

    const bodyBuffer = Buffer.from(await file.arrayBuffer());
    const key = `${bucket}/${pathStr}`;
    
    await client.send(new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME || '',
      Key: key,
      Body: bodyBuffer,
      ContentType: file.type || 'application/octet-stream'
    }));

    const publicUrl = `${process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL}/${key}`;

    return NextResponse.json({ data: { path: pathStr, publicUrl }, error: null });
  } catch (err: any) {
    console.error('[POST /api/storage/upload] unexpected error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
