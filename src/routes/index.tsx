import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { getSession } from "~/lib/at-protocol";
import { HouseView } from "./-house-view";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [session] = useState(() => getSession());

  if (!session) {
    return (
      <div className="min-h-screen font-body flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-heading text-sm text-accent-primary mb-1">
            Welcome to Cozy Corner
          </h1>
          <p className="text-xs text-text/60 mb-8">
            A Cozy Corner of the Atmosphere
          </p>
          <Link
            to="/login"
            className="font-heading text-sm uppercase tracking-widest border-2 rounded-sm px-8 py-3 no-underline animate-arcade"
          >
            Enter the Atmosphere
          </Link>
        </div>
      </div>
    );
  }

  return <HouseView handle={session.did} />;
}
