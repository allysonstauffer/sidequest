import { Link } from 'react-router-dom'

function LandingPage() {
  return (
    <section className="site-page">
      <p className="site-eyebrow">SideQuest</p>
      <h1>Want to share your hobbies to the world?</h1>
      <p>
        Share hobby projects, discover communities, and connect with people who
        enjoy the same side quests.
      </p>
      <div className="site-actions">
        <Link to="/login" className="site-button site-button-primary">Get started</Link>
        <Link to="/info" className="site-button">Learn about SideQuest</Link>
      </div>
    </section>
  )
}

export default LandingPage