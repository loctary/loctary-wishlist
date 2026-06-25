import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "../components/AuthScreen";

export const Route = createFileRoute("/register")({
  component: () => <AuthScreen initialRoute="register" />,
});
