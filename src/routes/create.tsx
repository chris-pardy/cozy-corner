import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ensureFreshSession } from "~/editor/load-record";

export const Route = createFileRoute("/create")({
  component: CreateLayout,
});

function CreateLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureFreshSession()
      .then(() => setReady(true))
      .catch(() => navigate({ to: "/login" }));
  }, [navigate]);

  if (!ready) return null;

  return (
    <div className="min-h-screen font-body">
      <Outlet />
    </div>
  );
}
