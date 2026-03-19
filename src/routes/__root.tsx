import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../theme";
import { NavHeader } from "./-nav-header";
import "../index.css";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export const Route = createRootRoute({
  component: () => {
    const queryClient = getQueryClient();
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Cozy Corner</title>
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){var t=localStorage.getItem('theme');if(t==='light')document.documentElement.setAttribute('data-theme','light')})()`,
            }}
          />
          <HeadContent />
        </head>
        <body className="m-0 bg-bg-deep text-text-primary">
          <ThemeProvider>
            <QueryClientProvider client={queryClient}>
              <NavHeader />
              <Outlet />
            </QueryClientProvider>
          </ThemeProvider>
          <Scripts />
        </body>
      </html>
    );
  },
});
