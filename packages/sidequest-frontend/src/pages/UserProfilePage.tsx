import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import FollowButton from "../components/FollowButton";
import ProjectFeed from "../components/ProjectFeed";
import SidequestEvents from "../components/SidequestEvents";
import CreatorProfile from "../components/CreatorProfile";
import { useState } from "react";

export default function UserProfilePage() {
  const { userId } = useParams();
  const { session, loading } = useAuth();
  const [followVersion, setFollowVersion] = useState(0);

  if (loading) return <p role="status">Loading profile…</p>;
  if (!session) return <p>Log in to view this profile.</p>;
  if (!userId || userId === session.user.id) {
    return <Navigate to="/profile" replace />;
  }

  return (
    <section className="site-page">
      <CreatorProfile userId={userId} followRefreshKey={followVersion} />
      <FollowButton
        viewerId={session.user.id}
        targetId={userId}
        onFollowChange={() => setFollowVersion((value) => value + 1)}
      />
      <SidequestEvents
        viewerId={session.user.id}
        hostId={userId}
        title="Upcoming Sidequests"
      />
      <ProjectFeed authorId={userId} title="Projects" />
    </section>
  );
}
