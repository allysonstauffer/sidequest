import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import FollowButton from "../components/FollowButton";
import ProjectFeed from "../components/ProjectFeed";

export default function UserProfilePage() {
  const { userId } = useParams();
  const { session, loading } = useAuth();

  if (loading) return <p role="status">Loading profile…</p>;
  if (!session) return <p>Log in to view this profile.</p>;
  if (!userId || userId === session.user.id) {
    return <Navigate to="/profile" replace />;
  }

  return (
    <section className="site-page">
      <p className="site-eyebrow">Community profile</p>
      <h1>SideQuest member</h1>
      <FollowButton
        viewerId={session.user.id}
        targetId={userId}
      />
      <ProjectFeed authorId={userId} title="Projects" />
    </section>
  );
}
