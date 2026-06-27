import { createFileRoute } from "@tanstack/react-router";
import { WishlistView } from "../components/WishlistView";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const OWNER_ID = "f5171c16-c017-4c45-90f4-9161789425c7";

/**
 * The index is just the `WISHLIST_OWNER_ID` user's wishlist (from env): the owner
 * sees the management view, everyone else the public reservable view — identical
 * to visiting `/user/{owner}/wishlist`.
 */
function HomePage() {
  return <WishlistView userId={OWNER_ID} />;
}
