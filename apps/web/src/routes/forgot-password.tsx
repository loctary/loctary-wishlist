import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "../components/AuthScreen";

export const Route = createFileRoute("/forgot-password")({
  component: () => <AuthScreen initialRoute="forgot-password" />,
});
