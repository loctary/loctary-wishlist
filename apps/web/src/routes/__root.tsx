import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import {
  Box,
  ColorSchemeScript,
  MantineProvider,
  mantineHtmlProps,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import mantineCss from "@mantine/core/styles.css?url";
import notificationsCss from "@mantine/notifications/styles.css?url";
import loctaryTokensCss from "../styles/loctary-tokens.css?url";
import wishlistCss from "../styles/wishlist.css?url";
import { theme, cssVariablesResolver } from "../theme";
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
      { rel: "stylesheet", href: loctaryTokensCss },
      { rel: "stylesheet", href: wishlistCss },
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
            cssVariablesResolver={cssVariablesResolver}
            defaultColorScheme="auto"
            colorSchemeManager={colorSchemeManager}
          >
            <Notifications />
            {/* Full-height app shell: header on top, content fills the rest of
                the viewport so short pages (auth, profile) center vertically. */}
            <Box style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
              <AppHeader />
              <Box
                component="main"
                style={{ flex: 1, display: "flex", flexDirection: "column" }}
              >
                <Outlet />
              </Box>
            </Box>
          </MantineProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
