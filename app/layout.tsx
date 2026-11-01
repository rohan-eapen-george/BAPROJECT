import type { Metadata } from "next";
import "./globals.css";
import { AssumptionsProvider } from "./assumptions-provider";
import { WorkspaceShell } from "../components/workspace-shell";

export const metadata: Metadata = {
  title: { default: "Daywell · Clinic operations", template: "%s · Daywell" },
  description: "A browser-based educational tool for exploring appointment no-show risk and clinic overbooking.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><AssumptionsProvider><WorkspaceShell>{children}</WorkspaceShell></AssumptionsProvider></body>
    </html>
  );
}
