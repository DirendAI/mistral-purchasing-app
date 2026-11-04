import type { AnyRouter, StaticDataRouteOption } from "@tanstack/react-router";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /**
     * Claim the app's landing page: `/` redirects to the strongest claim. `true` is a claim of rank
     * 0; a number is a claim of that rank, for a page that should win over the ordinary ones when
     * both are installed. Equal claims go to the route whose id sorts first. `false` keeps the
     * route from being the landing page at all, even through a fallback.
     */
    landing?: boolean | number;
  }
}

/**
 * What this file reads of a route in the router's `routesById`. Structural on purpose, so a capability
 * that does not import this file can type its own copy.
 */
export interface LandingRoute {
  id: string;
  fullPath: string;
  options: { staticData?: StaticDataRouteOption };
}

/**
 * Picks the route `/` goes to when no route claims it: given every route, in the router's order, and
 * whether a route may be picked (`false` for one that declares `landing: false`). It gets every route
 * rather than the eligible ones so it can order them as it would show them. `landingPath` refuses a
 * route that may not be picked, so `undefined` and a refused route both pass to the next fallback.
 * Another capability adds one as a module under `landing-fallbacks/`, such as a shell sending `/` to
 * its first nav entry.
 */
export type LandingFallback = (
  routes: readonly LandingRoute[],
  canLand: (route: LandingRoute) => boolean
) => LandingRoute | undefined;

const canLand = (route: LandingRoute): boolean =>
  route.options.staticData?.landing !== false;

/**
 * The path `/` redirects to: the route with the strongest `staticData.landing` claim, else the first
 * fallback's answer, if any. Routes are the registry — a capability that wants to be the app's front
 * door says so on its own route, so an app opens on whichever installed feature claims it most
 * strongly.
 */
export const landingPath = (
  router: AnyRouter,
  fallbacks: readonly LandingFallback[] = []
): string | undefined => {
  const routes = Object.values<LandingRoute>(router.routesById);
  let best: { rank: number; id: string; path: string } | undefined;

  for (const route of routes) {
    const claim = route.options.staticData?.landing;

    if (claim === undefined || claim === false) {
      continue;
    }

    const rank = claim === true ? 0 : claim;

    // `NaN` compares false both ways, so a claim ranked with it could never be displaced.
    if (Number.isNaN(rank)) {
      continue;
    }

    if (
      !best ||
      rank > best.rank ||
      (rank === best.rank && route.id < best.id)
    ) {
      best = { rank, id: route.id, path: route.fullPath };
    }
  }

  if (best) {
    return best.path;
  }

  for (const fallback of fallbacks) {
    const route = fallback(routes, canLand);

    if (route !== undefined && canLand(route)) {
      return route.fullPath;
    }
  }

  return undefined;
};
