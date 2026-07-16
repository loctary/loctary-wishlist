import { Button, Group, Anchor } from "@mantine/core";
import {
  IconArrowLeft,
  IconGiftOff,
  IconListCheck,
  IconLogin2,
} from "@tabler/icons-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useSession } from "../lib/session";
import { loginSearch } from "../lib/authNav";

type NotFoundKind = "page" | "user" | "wishlist" | "item";

const COPY: Record<NotFoundKind, { title: string; sub: string }> = {
  page: {
    title: "This page wandered off",
    sub: "The page you're looking for isn't here — it may have moved, been renamed, or never existed. Let's get you back to something you love.",
  },
  user: {
    title: "This person wandered off",
    sub: "We couldn't find that user — the link may be mistyped or the account may no longer exist. Let's get you back to something you love.",
  },
  wishlist: {
    title: "This wishlist wandered off",
    sub: "The wishlist you're looking for isn't here — it may have been hidden, removed, or never existed. Let's get you back to something you love.",
  },
  item: {
    title: "This wish wandered off",
    sub: "The wish you're looking for isn't here — it may have been reserved, removed, or never existed. Let's get you back to something you love.",
  },
};

/**
 * Brand 404 screen. Renders for unmatched routes (via the router's
 * `defaultNotFoundComponent`) and for data-level misses (unknown user /
 * wishlist / item). Fills the app shell's `main`, so the regular header stays.
 *
 * Deliberately context-free: the backend 404s hidden/deactivated lists and
 * their items, so we never have (and must not leak) a name for what's missing
 * — no contextual "back" button. Actions depend on session only:
 *  - primary: "Back to home";
 *  - ghost: "My page" when signed in, "Log in" (with a redirect back here —
 *    a hidden wishlist becomes visible to its logged-in owner) when not.
 */
export function NotFoundScreen({ kind = "page" }: { kind?: NotFoundKind }) {
  const { user: session, loading } = useSession();
  const here = useRouterState({ select: (s) => s.location.href });
  const copy = COPY[kind];

  return (
    <div className="nf-main">
      <div className="nf-inner">
        <div className="nf-art" aria-hidden="true">
          <div className="nf-card">
            <div className="nf-cover">
              <span className="q">?</span>
            </div>
            <div className="nf-lines">
              <div className="nf-line" />
              <div className="nf-line short" />
            </div>
          </div>
          <span className="nf-tag">
            <IconGiftOff size={15} />
            gone
          </span>
        </div>

        <p className="nf-code">Error 404</p>
        <h1 className="nf-title">{copy.title}</h1>
        <p className="nf-sub">{copy.sub}</p>

        <Group gap="sm" justify="center">
          <Button
            size="md"
            leftSection={<IconArrowLeft size={18} />}
            renderRoot={(props) => <Link to="/" {...props} />}
          >
            Back to home
          </Button>
          {loading ? null : session ? (
            <Button
              size="md"
              variant="default"
              leftSection={<IconListCheck size={18} />}
              renderRoot={(props) => (
                <Link to="/user/$userId" params={{ userId: session.id }} {...props} />
              )}
            >
              My page
            </Button>
          ) : (
            <Button
              size="md"
              variant="default"
              leftSection={<IconLogin2 size={18} />}
              renderRoot={(props) => (
                <Link to="/login" search={loginSearch(here)} {...props} />
              )}
            >
              Log in
            </Button>
          )}
        </Group>

        {loading || session ? null : (
          <p className="nf-links">
            Or{" "}
            <Anchor component={Link} to="/register" fw={600} inherit>
              Create account
            </Anchor>
          </p>
        )}
      </div>
    </div>
  );
}
