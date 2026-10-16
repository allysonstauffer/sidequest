import { useAuth } from "../auth/useAuth";
import ProjectFeed from "../components/ProjectFeed";

function ProfilePage() {
  const { session } = useAuth();
  if (!session) return null;

  return (
    <section className="site-page">
      <p className="site-eyebrow">Your Profile</p>
      <h1>Profile</h1>
      <p>Signed in as {session.user.email}</p>
      <ProjectFeed
        authorId={session.user.id}
        accessToken={session.access_token}
      />
    </section>
  );
}

export default ProfilePage;
