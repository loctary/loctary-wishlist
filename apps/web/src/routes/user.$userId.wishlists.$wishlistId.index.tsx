import { createFileRoute } from "@tanstack/react-router";
import { WishlistView } from "../components/WishlistView";

export const Route = createFileRoute("/user/$userId/wishlists/$wishlistId/")({
  component: WishlistPage,
});

function WishlistPage() {
  const { userId, wishlistId } = Route.useParams();
  return <WishlistView userId={userId} wishlistId={wishlistId} />;
}
