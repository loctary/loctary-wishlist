import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "../components/AuthScreen";
import { validateAuthSearch } from "../lib/authNav";

export const Route = createFileRoute("/register")({
  validateSearch: validateAuthSearch,
  component: () => <AuthScreen page="register" />,
});
