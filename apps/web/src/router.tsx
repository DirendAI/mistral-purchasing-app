import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { resolveAppName } from "./app-name";
import { landingPath } from "./landing";
import { landingFallbacks } from "./landing-fallbacks";
import type { RouterContext } from "./routes/__root";
import { routeTree } from "./routeTree.gen";
import { scrollRestorationOptions } from "./scroll-root";

// Called once per request on the server and once in the browser, so each gets its own cache.
export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000 } },
  });

  const context: RouterContext = {
    queryClient,
    landingPath: (): string | undefined =>
      // oxlint-disable-next-line no-use-before-define -- called only once the router exists, to pick where `/` goes
      landingPath(router, landingFallbacks),
    appName: resolveAppName(),
  };

  const router = createRouter({
    routeTree,
    context,
    // The server resolves the app's name at request time; the browser adopts it before it matches
    // a route, so the first client render shows the name the server rendered.
    dehydrate: () => ({ appName: context.appName }),
    hydrate: (dehydrated) => {
      context.appName = dehydrated.appName;
    },
    ...scrollRestorationOptions,
    defaultNotFoundComponent: () => (
      <div className="flex min-h-full flex-col items-center justify-center gap-1 p-8 text-center">
        <p className="text-2xl font-semibold tracking-tight">Page not found</p>
        <p className="text-sm text-gray-500">The page you are looking for does not exist.</p>
      </div>
    ),
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
