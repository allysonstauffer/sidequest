import { useAuth } from "../auth/useAuth";

function ProfilePage() {
  const { session } = useAuth();
  return (
    <section className="site-page">
      <p className="site-eyebrow">Your Profile</p>
      <h1>Profile</h1>
      <p>Signed in as {session?.user.email}</p>
    </section>
  );
}

export default ProfilePage;
