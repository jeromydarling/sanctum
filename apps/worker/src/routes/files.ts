/** R2 upload + Images-backed serving. Degrades gracefully without bindings. */
import type { Env, AuthContext } from '../types.js';
import { json, err, genId } from '../http.js';

/** POST /api/upload (multipart or raw body) -> { key, url } */
export async function handleUpload(
  env: Env,
  req: Request,
  auth: AuthContext,
): Promise<Response> {
  if (!env.STORAGE) {
    // Graceful degradation: no R2 yet. Tell the client to keep the data URL.
    return json({ demo: true, error: 'File storage is not enabled yet.' }, 200);
  }
  const contentType = req.headers.get('Content-Type') || 'application/octet-stream';
  let body: ArrayBuffer;
  let ext = 'bin';

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file') as unknown as File | null;
    if (!file || typeof file === 'string') return err('No file provided', 422);
    body = await file.arrayBuffer();
    ext = file.name.split('.').pop() || mimeExt(file.type);
  } else {
    body = await req.arrayBuffer();
    ext = mimeExt(contentType);
  }
  if (body.byteLength > 25 * 1024 * 1024) return err('File exceeds 25MB', 413);

  const key = `${auth.id}/${genId('file')}.${ext}`;
  await env.STORAGE.put(key, body, { httpMetadata: { contentType } });
  return json({ key, url: `/api/files/${key}` });
}

/** GET /api/files/:key?w=N -> object, optionally WebP-resized via Images. */
export async function handleFileServe(env: Env, key: string, url: URL): Promise<Response> {
  if (!env.STORAGE) return new Response('Storage not enabled', { status: 404 });
  const obj = await env.STORAGE.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  const width = parseInt(url.searchParams.get('w') || '0', 10);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  // Try Images transform when a width is requested and the binding exists.
  if (width > 0 && env.IMAGES) {
    try {
      const result = await env.IMAGES.input(obj.body)
        .transform({ width })
        .output({ format: 'image/webp' });
      const resp = result.response();
      const out = new Response(resp.body, resp);
      out.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return out;
    } catch (e) {
      console.error('[images:fallback]', e);
      // Fall through to original below.
      const fresh = await env.STORAGE.get(key);
      if (fresh) return new Response(fresh.body, { headers });
    }
  }

  return new Response(obj.body, { headers });
}

function mimeExt(mime: string): string {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('pdf')) return 'pdf';
  return 'bin';
}
