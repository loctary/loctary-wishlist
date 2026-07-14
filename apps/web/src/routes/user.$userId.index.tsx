import { createFileRoute } from "@tanstack/react-router";
import { UserPage } from "../components/UserPage";

export const Route = createFileRoute("/user/$userId/")({
  component: UserRoute,
});

/**
 * `/user/$userId` — the user's public page. The route deliberately has NO
 * `/wishlists` segment; individual lists live under `/user/$userId/wishlists/*`
 * so URLs stay short. Owner/visitor variants are picked inside `UserPage`.
 */
function UserRoute() {
  const { userId } = Route.useParams();
  return <UserPage userId={userId} />;
}
