import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "../components/AuthScreen";
import { validateAuthSearch } from "../lib/authNav";

export const Route = createFileRoute("/forgot-password")({
  validateSearch: validateAuthSearch,
  component: () => <AuthScreen page="forgot-password" />,
});
