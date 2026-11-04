import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useAppName } from "../app-name";

export const AppShell = ({ children }: { children: ReactNode }) => {
  const appName = useAppName();

  return (
    <div className="min-h-full">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-6 p-4">
          <Link to="/" className="text-lg font-semibold">
            {appName}
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link to="/" className="[&.active]:font-semibold [&.active]:underline">
              Products
            </Link>
            <Link to="/settings" className="[&.active]:font-semibold [&.active]:underline">
              Settings
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
};
