import { AppShell, AppShellHeader, AppShellMain } from "@mantine/core";
import type { ReactNode } from "react";
import AppBar from "@components/AppBar";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShellHeader>
        <AppBar />
      </AppShellHeader>
      <AppShellMain>{children}</AppShellMain>
    </AppShell>
  );
}
