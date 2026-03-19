import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { resolveDidToPds } from "~/lib/at-protocol";
import { ErrorAlert, getErrorMessage } from "~/routes/-ui";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const DEFAULT_PDS = import.meta.env.VITE_PDS_URL || "https://bsky.social";

function LoginPage() {
  const navigate = useNavigate();
  const [pdsOverride, setPdsOverride] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // If the user provided an explicit PDS, use that directly.
      // Otherwise, use the default to create the session, then resolve
      // the user's actual PDS from their DID document.
      let rawUrl = (pdsOverride || DEFAULT_PDS).replace(/\/+$/, "");
      if (rawUrl && !/^https?:\/\//i.test(rawUrl)) rawUrl = `https://${rawUrl}`;
      const serviceUrl = rawUrl;
      const res = await fetch(
        `${serviceUrl}/xrpc/com.atproto.server.createSession`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, password }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `Login failed (${res.status})`);
      }

      const session = await res.json();

      // Resolve the user's actual PDS endpoint from the DID document.
      // If the user set an explicit override, prefer that.
      let pdsEndpoint: string;
      if (pdsOverride) {
        pdsEndpoint = pdsOverride.replace(/\/+$/, "");
      } else {
        try {
          pdsEndpoint = await resolveDidToPds(session.did);
        } catch {
          // Fallback: extract from the session's didDoc, or use serviceUrl
          pdsEndpoint =
            resolvePdsEndpoint(session.didDoc) || serviceUrl;
        }
      }

      localStorage.setItem(
        "session",
        JSON.stringify({
          accessJwt: session.accessJwt,
          refreshJwt: session.refreshJwt,
          did: session.did,
          handle: session.handle,
          pds: pdsEndpoint,
        })
      );

      navigate({ to: "/" });
    } catch (err) {
      setError(getErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen font-body">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 w-[340px] p-6 bg-bg-panel border-2 border-border rounded-sm"
      >
        <h1 className="font-heading text-sm text-accent-primary m-0 text-center">
          Cozy Corner
        </h1>
        <p className="text-[11px] text-text-muted m-0 text-center">
          A Cozy Corner of the Atmosphere
        </p>

        <label className="font-heading text-[10px] text-text-muted uppercase tracking-wide">
          Handle or Email
        </label>
        <input
          className="bg-bg-deep text-text-primary border-2 border-border rounded-sm px-2.5 py-2 font-body text-xs outline-none focus:border-accent-primary"
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="you.bsky.social"
          autoComplete="username"
          required
        />

        <label className="font-heading text-[10px] text-text-muted uppercase tracking-wide">
          Password
        </label>
        <input
          className="bg-bg-deep text-text-primary border-2 border-border rounded-sm px-2.5 py-2 font-body text-xs outline-none focus:border-accent-primary"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="App password"
          autoComplete="current-password"
          required
        />

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-[10px] text-text-muted font-heading uppercase tracking-wide text-left cursor-pointer bg-transparent border-0 p-0 hover:text-accent-primary"
        >
          {showAdvanced ? "▾" : "▸"} Advanced
        </button>

        {showAdvanced && (
          <div className="flex flex-col gap-1">
            <label className="font-heading text-[10px] text-text-muted uppercase tracking-wide">
              PDS URL
            </label>
            <input
              className="bg-bg-deep text-text-primary border-2 border-border rounded-sm px-2.5 py-2 font-body text-xs outline-none focus:border-accent-primary"
              type="url"
              value={pdsOverride}
              onChange={(e) => setPdsOverride(e.target.value)}
              placeholder={DEFAULT_PDS}
            />
            <p className="text-[9px] text-text-muted m-0">
              Leave blank to auto-detect from your account
            </p>
          </div>
        )}

        <ErrorAlert message={error} />

        <button
          type="submit"
          disabled={loading}
          className="bg-accent-primary/10 border-2 border-accent-primary rounded-sm text-accent-primary cursor-pointer font-heading text-xs py-2.5 px-4 mt-1 hover:bg-accent-primary/20 active:bg-accent-primary/30 disabled:opacity-50 disabled:cursor-default"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <div className="border-t-2 border-border pt-3 mt-1 text-center">
          <p className="text-[10px] text-text-muted m-0">
            Don't have an account? Sign up at{" "}
            <a
              href="https://bsky.app"
              target="_blank"
              rel="noopener noreferrer"
              className="font-heading text-accent-primary hover:text-accent-primary/80 transition-colors inline-flex items-center gap-1"
            >
              <svg width="12" height="10" viewBox="0 0 9 7" shapeRendering="crispEdges" className="inline-block" aria-hidden="true">
                <rect x="1" y="0" width="1" height="1" fill="#0985ff"/>
                <rect x="7" y="0" width="1" height="1" fill="#0985ff"/>
                <rect x="0" y="1" width="3" height="1" fill="#0985ff"/>
                <rect x="6" y="1" width="3" height="1" fill="#0985ff"/>
                <rect x="0" y="2" width="4" height="1" fill="#0985ff"/>
                <rect x="5" y="2" width="4" height="1" fill="#0985ff"/>
                <rect x="0" y="3" width="9" height="1" fill="#0985ff"/>
                <rect x="1" y="4" width="7" height="1" fill="#0985ff"/>
                <rect x="2" y="5" width="5" height="1" fill="#0985ff"/>
                <rect x="4" y="6" width="1" height="1" fill="#0985ff"/>
              </svg>
              bsky.app
            </a>
          </p>
        </div>
      </form>
    </div>
  );
}

function resolvePdsEndpoint(
  didDoc:
    | { service?: { id: string; serviceEndpoint: string }[] }
    | undefined
): string | null {
  if (!didDoc?.service) return null;
  const entry = didDoc.service.find(
    (s) => s.id === "#atproto_pds" || s.id.endsWith("#atproto_pds")
  );
  return entry?.serviceEndpoint ?? null;
}
