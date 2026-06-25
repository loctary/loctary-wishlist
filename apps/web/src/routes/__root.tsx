import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import {
  ColorSchemeScript,
  MantineProvider,
  mantineHtmlProps,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import mantineCss from "@mantine/core/styles.css?url";
import notificationsCss from "@mantine/notifications/styles.css?url";
import { theme } from "../theme";
import { cookieColorSchemeManager } from "../lib/colorScheme";
import { AppHeader } from "../components/Header";

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Loctary Wishlist" },
      { name: "description", content: "A public wishlist — browse, reserve, and gift." },
    ],
    links: [
      { rel: "stylesheet", href: mantineCss },
      { rel: "stylesheet", href: notificationsCss },
    ],
  }),
  component: RootComponent,
});

const colorSchemeManager = cookieColorSchemeManager({
  domain: import.meta.env.VITE_COOKIE_DOMAIN || undefined,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <MantineProvider
            theme={theme}
            defaultColorScheme="auto"
            colorSchemeManager={colorSchemeManager}
          >
            <Notifications />
            <AppHeader />
            <Outlet />
          </MantineProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
