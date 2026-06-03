import { NextResponse } from 'next/server';

const PROXY_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const SKIP_HEADERS = new Set([
  'access-control-allow-origin',
  'transfer-encoding',
  'connection',
  'keep-alive',
]);

// In-memory session store: sessionId -> Set<hostname>
const sessions = new Map<string, Set<string>>();

function getSessionId(req: Request): string {
  const cookie = req.headers.get('cookie') || '';
  const match = cookie.match(/panelia_session=([^;]+)/);
  if (match) return match[1];
  // Generate new session
  const id = Math.random().toString(36).slice(2, 18);
  return id;
}

// Allow any host for now. Safety check comes in later task.
function isHostAllowed(_sessionId: string, _hostname: string): boolean {
  return true;
}

function setSessionCookie(response: NextResponse, sessionId: string): void {
  response.cookies.set('panelia_session', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'missing url' }, { status: 400 });

  const sessionId = getSessionId(request);
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, new Set());
  }

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 });
  }

  if (!isHostAllowed(sessionId, target.hostname)) {
    return NextResponse.json({ error: 'host not allowed' }, { status: 403 });
  }

  // Auto-allow this host for the session
  sessions.get(sessionId)!.add(target.hostname);

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': PROXY_UA,
        'Accept': 'application/json, text/html, */*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(20000),
    });

    const body = await upstream.arrayBuffer();
    const headers = new Headers();

    upstream.headers.forEach((v, k) => {
      const lower = k.toLowerCase();
      if (!SKIP_HEADERS.has(lower) &&
          !lower.startsWith('content-encoding') &&
          !lower.startsWith('content-length') &&
          lower !== 'transfer-encoding') {
        headers.set(k, v);
      }
    });

    if (!headers.has('content-type') && url.includes('api.')) {
      headers.set('content-type', 'application/json');
    }

    headers.set('access-control-allow-origin', '*');

    if (!upstream.ok) {
      const contentType = upstream.headers.get('content-type') || '';
      let errDetail: string;
      if (contentType.includes('text/html') || contentType.includes('text/plain')) {
        errDetail = new TextDecoder().decode(body).slice(0, 500);
      } else {
        try {
          const jsonErr = JSON.parse(new TextDecoder().decode(body));
          errDetail = jsonErr.detail || jsonErr.error || JSON.stringify(jsonErr);
        } catch {
          errDetail = 'Non-JSON error response';
        }
      }
      return NextResponse.json(
        { error: `Upstream ${upstream.status}`, detail: errDetail },
        { status: upstream.status }
      );
    }

    const response = new NextResponse(body, { status: upstream.status, headers });
    setSessionCookie(response, sessionId);
    return response;
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const sessionId = getSessionId(request);
  sessions.delete(sessionId);
  return new Response(null, { status: 204 });
}