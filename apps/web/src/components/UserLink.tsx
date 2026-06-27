import { Anchor } from "@mantine/core";
import { Link } from "@tanstack/react-router";

/**
 * Renders a user's name as a link to their public profile (`/user/$userId`).
 * Used everywhere a user is mentioned (reservers, list owners) so any name is a
 * way into that person's profile. Pass `inherit` inside headings/titles to keep
 * the surrounding typography and only hint the link on hover.
 */
export function UserLink({
  id,
  name,
  inherit,
  fw,
  size,
}: {
  id: string;
  name: string;
  inherit?: boolean;
  fw?: number | string;
  size?: string;
}) {
  return (
    <Anchor
      renderRoot={(props) => <Link to="/user/$userId" params={{ userId: id }} {...props} />}
      // In `inherit` mode (inside a heading) keep the surrounding font size/weight
      // but paint the name in the primary brand colour.
      c={inherit ? "var(--mantine-primary-color-filled)" : undefined}
      fz={inherit ? "inherit" : undefined}
      fw={inherit ? "inherit" : fw}
      size={inherit ? undefined : size}
      underline={inherit ? "hover" : "always"}
    >
      {name}
    </Anchor>
  );
}
