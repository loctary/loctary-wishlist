import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "../components/AuthScreen";
import { validateAuthSearch } from "../lib/authNav";

export const Route = createFileRoute("/verify-email")({
  validateSearch: validateAuthSearch,
  component: () => <AuthScreen page="verify-email" />,
});
