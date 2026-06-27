import { createFileRoute } from "@tanstack/react-router";
import { WishlistView } from "../components/WishlistView";

export const Route = createFileRoute("/user/$userId/wishlist/")({
  component: UserWishlistPage,
});

function UserWishlistPage() {
  const { userId } = Route.useParams();
  return <WishlistView userId={userId} />;
}
