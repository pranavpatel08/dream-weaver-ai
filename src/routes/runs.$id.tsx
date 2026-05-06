import { createFileRoute } from "@tanstack/react-router";
import { useRunStream } from "@/lib/run-socket";
import { MissionControl } from "@/components/run/MissionControl";

export const Route = createFileRoute("/runs/$id")({
  component: RunPage,
});

function RunPage() {
  const { id } = Route.useParams();
  const { snapshot, connected } = useRunStream(id);
  return <MissionControl runId={id} snapshot={snapshot} connected={connected} />;
}
