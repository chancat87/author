import { NextResponse } from 'next/server';
import { desktopRequestAllowed } from './app/lib/api-resource-guard.js';

// API methods enforce capability, admission and body limits in their Route
// Handlers. Keeping them out of Proxy avoids Next's implicit body cloning.
export function proxy(request) {
    if (!desktopRequestAllowed(request)) {
        return new NextResponse('Unauthorized', {
            status: 401,
            headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }
    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api(?:/|$)|_next/static|_next/image|favicon.ico).*)'],
};
