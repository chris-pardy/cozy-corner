import { useRef, useState } from 'react';
import { LogIn, Settings } from 'lucide-react';
import { useAuth } from './AuthContext';

export function LoginForm() {
  const { signIn, isLoading, error } = useAuth();
  const [handle, setHandle] = useState('');
  const [pdsUrl, setPdsUrl] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const prevError = useRef<string | null>(null);

  // Auto-expand PDS URL field when handle resolution fails
  if (error && error !== prevError.current && error.includes('Custom hosting provider')) {
    setShowAdvanced(true);
  }
  prevError.current = error;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = handle.trim();
    if (!input) return;
    setSubmitting(true);
    try {
      const pds = pdsUrl.trim() || undefined;
      await signIn(input, pds);
    } catch {
      // Error is set in the auth context
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-deep text-text">
        <span className="font-heading text-sm text-text-muted">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center bg-surface-deep text-text">
      <form
        onSubmit={handleSubmit}
        className="flex w-80 flex-col gap-3 rounded-md border border-surface-border bg-surface p-4"
      >
        <div>
          <span className="font-heading text-sm tracking-wide text-gold">
            Sign in to Cozy Corner
          </span>
          <p className="mt-0.5 font-body text-[10px] text-text-muted">
            Enter your handle to sign in via your hosting provider.
          </p>
        </div>

        <div>
          <label className="mb-0.5 block font-heading text-[10px] uppercase tracking-wider text-text-muted">
            Handle
          </label>
          <div className="flex items-center rounded-sm border border-surface-border bg-surface-deep focus-within:border-gold">
            <span className="pl-2 font-body text-xs text-text-muted">@</span>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="you.bsky.social"
              autoFocus
              className="w-full bg-transparent px-1 py-1.5 font-body text-xs text-text outline-none"
            />
          </div>
        </div>

        {/* Advanced: PDS URL override for local dev */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 font-heading text-[9px] text-text-muted transition-colors hover:text-text"
        >
          <Settings className="size-3" />
          Custom hosting provider
        </button>

        {showAdvanced && (
          <div>
            <label className="mb-0.5 block font-heading text-[10px] uppercase tracking-wider text-text-muted">
              PDS URL
            </label>
            <input
              value={pdsUrl}
              onChange={(e) => setPdsUrl(e.target.value)}
              placeholder="http://localhost:2583"
              className="w-full rounded-sm border border-surface-border bg-surface-deep px-2 py-1.5 font-body text-xs text-text outline-none focus:border-gold"
            />
            <p className="mt-1 font-body text-[9px] text-text-muted">
              Override PDS discovery for local development or custom servers.
            </p>
          </div>
        )}

        {error && (
          <p className="rounded-sm bg-destructive/10 px-2 py-1 font-body text-[10px] text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !handle.trim()}
          className="flex items-center justify-center gap-1.5 rounded-sm border border-gold bg-gold/10 px-3 py-1.5 font-heading text-xs text-gold transition-colors hover:bg-gold/20 disabled:opacity-40"
        >
          <LogIn className="size-3.5" />
          {submitting ? 'Redirecting...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
