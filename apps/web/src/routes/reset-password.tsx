import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "../components/AuthScreen";

export const Route = createFileRoute("/reset-password")({
  component: () => <AuthScreen initialRoute="reset-password" />,
});
