import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { BrowserOAuthClient, OAuthSession } from '@atproto/oauth-client-browser';
import { getOAuthClient } from './auth';
import { createAuthenticatedClient } from './client';
import type { AtpBaseClient } from './generated/index';

interface AuthContextValue {
  session: OAuthSession | null;
  client: AtpBaseClient | null;
  did: string | null;
  isLoading: boolean;
  error: string | null;
  signIn(handle: string, pdsUrl?: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [oauthClient, setOAuthClient] = useState<BrowserOAuthClient | null>(null);
  const [session, setSession] = useState<OAuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize the OAuth client and restore/handle callback
  useEffect(() => {
    let disposed = false;

    async function init() {
      try {
        const client = await getOAuthClient();
        if (disposed) return;
        setOAuthClient(client);

        const result = await client.init();
        if (disposed) return;

        if (result?.session) {
          setSession(result.session);
        }
      } catch (err) {
        if (disposed) return;
        console.error('Auth init failed:', err);
        setError(err instanceof Error ? err.message : 'Auth initialization failed');
      } finally {
        if (!disposed) setIsLoading(false);
      }
    }

    init();
    return () => { disposed = true; };
  }, []);

  const client = useMemo(
    () => (session ? createAuthenticatedClient(session) : null),
    [session],
  );

  const value = useMemo<AuthContextValue>(() => ({
    session,
    client,
    did: session?.did ?? null,
    isLoading,
    error,
    async signIn(handle: string, pdsUrl?: string) {
      if (!oauthClient) throw new Error('OAuth client not initialized');
      setError(null);
      try {
        if (pdsUrl) {
          // For local dev: resolve via PDS URL, then append login_hint
          // so the PDS pre-fills the handle and skips the identifier step.
          const authorizeUrl = await oauthClient.authorize(pdsUrl, { state: 'login' });
          authorizeUrl.searchParams.set('login_hint', handle);
          window.location.assign(authorizeUrl.toString());
          // Won't return — page navigates away
          await new Promise(() => {});
        } else {
          // Standard flow: resolve handle via DNS
          await oauthClient.signIn(handle, { state: 'login' });
        }
      } catch (err) {
        console.error('signIn error:', err);
        const msg = err instanceof Error ? err.message : 'Sign in failed';
        if (msg.includes('resolve identity') && !pdsUrl) {
          setError(`Could not resolve handle "${handle}". If using a local PDS, expand "Custom hosting provider" and enter the PDS URL.`);
        } else {
          setError(msg);
        }
        throw err;
      }
    },
    async signOut() {
      if (session) {
        await session.signOut();
      }
      setSession(null);
    },
  }), [session, client, isLoading, error, oauthClient]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useClient(): AtpBaseClient {
  const { client } = useAuth();
  if (!client) throw new Error('useClient requires an authenticated session');
  return client;
}
