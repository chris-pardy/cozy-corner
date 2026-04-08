import type { OAuthSession } from '@atproto/oauth-client-browser';
import { AtpBaseClient } from './generated/index';

/**
 * Create an authenticated XRPC client from an OAuth session.
 *
 * The OAuthSession.fetchHandler and XrpcClient FetchHandler share the same
 * signature: (pathname: string, init: RequestInit) => Promise<Response>.
 * The session's fetchHandler automatically injects DPoP headers and handles
 * token refresh.
 */
export function createAuthenticatedClient(session: OAuthSession): AtpBaseClient {
    return new AtpBaseClient(session.fetchHandler.bind(session));
}
