import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "../components/AuthScreen";
import { validateAuthSearch } from "../lib/authNav";

export const Route = createFileRoute("/reset-password")({
  validateSearch: validateAuthSearch,
  component: () => <AuthScreen page="reset-password" />,
});
