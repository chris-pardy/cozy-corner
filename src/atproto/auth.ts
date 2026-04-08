import { BrowserOAuthClient } from '@atproto/oauth-client-browser';

let clientPromise: Promise<BrowserOAuthClient> | null = null;

/**
 * Get the singleton OAuth client. Lazily initialized on first call.
 * The client handles PKCE, DPoP, token refresh, and session persistence (IndexedDB).
 */
export function getOAuthClient(): Promise<BrowserOAuthClient> {
    if (!clientPromise) {
        const hostname = window.location.hostname;
        const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';

        let clientId: string;
        if (isLoopback) {
            // AT Proto loopback client: client_id must start with http://localhost
            // redirect_uri uses [::1] since bun dev server binds to IPv6
            const port = window.location.port || '3000';
            const redirectUri = `http://[::1]:${port}/`;
            clientId = `http://localhost?redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent('atproto transition:generic')}`;
        } else {
            clientId = `${window.location.origin}/client-metadata.json`;
        }

        clientPromise = BrowserOAuthClient.load({
            clientId,
            handleResolver: 'https://bsky.social',
            // Allow HTTP for local development (PDS on localhost)
            allowHttp: isLoopback,
        });
    }
    return clientPromise;
}
