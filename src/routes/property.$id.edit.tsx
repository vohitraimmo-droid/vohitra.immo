import { createFileRoute } from "@tanstack/react-router";
import { PropertyForm } from "@/components/PropertyForm";

export const Route = createFileRoute("/property/$id/edit")({
  head: () => ({ meta: [{ title: "Modifier l'annonce — Vohitra" }] }),
  component: EditPage,
});

function EditPage() {
  const { id } = Route.useParams();
  return <PropertyForm propertyId={id} />;
}
