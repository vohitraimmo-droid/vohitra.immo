import { createFileRoute } from "@tanstack/react-router";
import { PropertyForm } from "@/components/PropertyForm";

export const Route = createFileRoute("/property/new")({
  head: () => ({ meta: [{ title: "Nouvelle annonce — Vohitra" }] }),
  component: () => <PropertyForm />,
});
