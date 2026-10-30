import { useParams } from "react-router-dom";
import ProjectFeed from "../components/ProjectFeed";

export default function ProjectDetailsPage() {
  const { projectId } = useParams();
  if (
    !projectId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      projectId
    )
  ) {
    return (
      <main className="notifications-page">
        <h1>Project unavailable</h1>
      </main>
    );
  }
  return (
    <main className="notifications-page">
      <ProjectFeed projectId={projectId} />
    </main>
  );
}
