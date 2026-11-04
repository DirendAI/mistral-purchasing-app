import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useAppName } from "../app-name";

const navLinkClass =
  "rounded-full px-3 py-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 [&.active]:bg-gray-900 [&.active]:font-medium [&.active]:text-white [&.active]:hover:bg-gray-900";

export const AppShell = ({ children }: { children: ReactNode }) => {
  const appName = useAppName();

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 rounded">
            <span
              aria-hidden
              className="h-5 w-5 rounded"
              style={{ background: "linear-gradient(135deg, #ffc400 0%, #ff8205 45%, #fa500f 100%)" }}
            />
            <span className="text-lg font-semibold tracking-tight">{appName}</span>
          </Link>
          <nav className="flex gap-1 text-sm">
            <Link to="/" className={navLinkClass}>
              Products
            </Link>
            <Link to="/settings" className={navLinkClass}>
              Settings
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
};
