import { Link, useParams } from "react-router-dom";
import ProjectFeed from "../components/ProjectFeed";

export default function ProjectDetailsPage() {
  const { projectId } = useParams();
  const validProjectId =
    projectId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      projectId
    );
  return (
    <main className="notifications-page">
      <Link to="/feed" className="link-button">Back to feed</Link>
      {validProjectId ? (
        <ProjectFeed projectId={projectId} />
      ) : (
        <h1>Project unavailable</h1>
      )}
    </main>
  );
}
