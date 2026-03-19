import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$handle/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$handle/$nsid",
      params: { handle: params.handle, nsid: "at.cozy-corner.house" },
    });
  },
});
