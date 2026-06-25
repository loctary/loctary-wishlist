import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "../components/AuthScreen";

export const Route = createFileRoute("/verify-email")({
  component: () => <AuthScreen initialRoute="verify-email" />,
});
