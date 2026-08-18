import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Named `proxy.ts`, not `middleware.ts` — as of Next.js 16 the middleware
// file convention was renamed to Proxy (same functionality, same
// NextRequest/NextResponse API, just a different file/export name).
// See node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
export function proxy(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const url = request.nextUrl.clone();

  // startracker.pro.protolabsglobal.com is a dedicated, single-purpose
  // domain for the $69 standalone product — its root should land directly
  // on the real Star Tracker experience, not the multi-tool hub. A rewrite
  // (not a redirect) keeps the URL bar showing just the domain.
  if (hostname.startsWith('startracker.') && url.pathname === '/') {
    url.pathname = '/star-tracker';
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
