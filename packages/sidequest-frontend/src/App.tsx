import { useEffect, useState } from "react";
import {
  House,
  MessageCircle,
  Plus,
  Search,
  Settings,
  UsersRound
} from "lucide-react";
import {
  TiltedGridHero,
  type TiltedGridImage
} from "./TiltedGridHero";
import "./App.css";

const hobbyImages: TiltedGridImage[] = [
  {
    src: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=85",
    alt: "Colorful painting in progress"
  },
  {
    src: "https://images.unsplash.com/photo-1624880357913-a8539238245b?auto=format&fit=crop&w=900&q=85",
    alt: "Women playing soccer on a green field"
  },
  {
    src: "https://images.unsplash.com/photo-1757085242652-f8cd4d3de889?auto=format&fit=crop&w=900&q=85",
    alt: "People painting together during an art class"
  },
  {
    src: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=900&q=85",
    alt: "Guitar ready to be played"
  },
  {
    src: "https://images.unsplash.com/photo-1753164726310-9d9063454230?auto=format&fit=crop&w=900&q=85",
    alt: "An experienced potter guiding a child at the pottery wheel"
  }
];

function App() {
  const [activeSection, setActiveSection] = useState(() =>
    window.location.hash === "#discover" ? "#discover" : "#home"
  );

  useEffect(() => {
    const updateActiveSection = () => {
      setActiveSection(
        window.location.hash === "#discover"
          ? "#discover"
          : "#home"
      );
    };
    window.addEventListener("hashchange", updateActiveSection);
    return () =>
      window.removeEventListener(
        "hashchange",
        updateActiveSection
      );
  }, []);

  return (
    <div className="app-shell">
      <aside
        className="desktop-sidebar"
        aria-label="SideQuest sidebar">
        <a
          className="sidebar-wordmark"
          href="#home"
          aria-label="SideQuest home">
          <span className="sidebar-mark" aria-hidden="true">
            s
          </span>
          <span>sidequest</span>
        </a>
        <p className="sidebar-caption">YOUR SPACE</p>
        <nav
          className="sidebar-navigation"
          aria-label="Primary navigation">
          <a
            className={`sidebar-item${activeSection === "#home" ? " is-active" : ""}`}
            href="#home"
            aria-current={
              activeSection === "#home" ? "page" : undefined
            }>
            <House aria-hidden="true" />
            <span>Home</span>
          </a>
          <a
            className={`sidebar-item${activeSection === "#discover" ? " is-active" : ""}`}
            href="#discover"
            aria-current={
              activeSection === "#discover" ? "page" : undefined
            }>
            <UsersRound aria-hidden="true" />
            <span>Community</span>
          </a>
          <button
            className="sidebar-item"
            type="button"
            disabled>
            <Search aria-hidden="true" />
            <span>Search</span>
          </button>
          <button
            className="sidebar-item"
            type="button"
            disabled>
            <MessageCircle aria-hidden="true" />
            <span>Messages</span>
          </button>
          <button
            className="sidebar-item"
            type="button"
            disabled>
            <Settings aria-hidden="true" />
            <span>Settings</span>
          </button>
        </nav>
        <button
          className="share-sidequest"
          type="button"
          disabled>
          <Plus aria-hidden="true" />
          <span>Share a Side Quest</span>
        </button>
      </aside>
      <main className="page-content">
        <section className="home-hero" id="home">
          <TiltedGridHero
            className="hero-scene"
            images={hobbyImages}
            speed={5}
            tileHeight={27}
            axis={77}
            curve={72}
            fade={13}>
            <div className="hero-copy">
              <p className="eyebrow">
                A social space for your side quests
              </p>
              <h1>
                Make room for your next <em>side quest.</em>
              </h1>
              <p className="hero-description">
                Share what you love making, find communities
                that get it, and connect with people who are on
                their own creative journeys.
              </p>
              <a className="primary-link" href="#discover">
                Find your people{" "}
                <span aria-hidden="true">↗</span>
              </a>
            </div>
            <p className="image-caption" aria-hidden="true">
              Make something. Share it. Find your people.
            </p>
          </TiltedGridHero>
        </section>

        <section className="discover-section" id="discover">
          <div className="section-intro" id="why-sidequest">
            <p className="eyebrow">
              <span /> Your interests, in good company
            </p>
            <h2>
              A place for the things you do just because you
              love them.
            </h2>
          </div>
          <div className="feature-grid">
            <article className="feature-card feature-card-share">
              <div className="feature-card-copy">
                <span className="feature-label">01 / MAKE</span>
                <h3>Show us what you’re making.</h3>
                <p>
                  Share projects, works in progress, and updates
                  on the things you love doing.
                </p>
              </div>
              <img
                className="feature-card-image"
                src="https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=85"
                alt="A colorful painting in progress"
                loading="lazy"
              />
              <span
                className="feature-stamp"
                aria-hidden="true">
                MADE BY YOU
              </span>
            </article>
            <article className="feature-card feature-card-discover">
              <img
                className="feature-card-image"
                src="https://images.unsplash.com/photo-1757085242652-f8cd4d3de889?auto=format&fit=crop&w=900&q=85"
                alt="People painting together during an art class"
                loading="lazy"
              />
              <div className="feature-card-copy">
                <span className="feature-label">
                  02 / DISCOVER
                </span>
                <h3>Find your kind of people.</h3>
                <p>
                  Explore communities centered on the hobbies
                  you care about.
                </p>
              </div>
            </article>
            <article className="feature-card feature-card-connect">
              <div className="feature-card-copy">
                <span className="feature-label">
                  03 / CONNECT
                </span>
                <h3>Good things grow together.</h3>
                <p>
                  Meet community members and connect through
                  shared interests.
                </p>
              </div>
              <img
                className="feature-card-image"
                src="https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=900&q=85"
                alt="A guitar ready to be played"
                loading="lazy"
              />
            </article>
          </div>
        </section>

        <footer className="site-footer">
          <a className="wordmark" href="#home">
            <span className="wordmark-mark" aria-hidden="true">
              s
            </span>
            sidequest
          </a>
          <p>
            For the things you do just because you love them.
          </p>
        </footer>
      </main>

      <nav
        className="mobile-navigation"
        aria-label="Primary navigation">
        <a
          className={`mobile-nav-item${activeSection === "#home" ? " is-active" : ""}`}
          href="#home"
          aria-current={
            activeSection === "#home" ? "page" : undefined
          }>
          <House aria-hidden="true" />
          <span>Home</span>
        </a>
        <a
          className={`mobile-nav-item${activeSection === "#discover" ? " is-active" : ""}`}
          href="#discover"
          aria-current={
            activeSection === "#discover" ? "page" : undefined
          }>
          <UsersRound aria-hidden="true" />
          <span>Community</span>
        </a>
        <button
          className="mobile-nav-item"
          type="button"
          disabled>
          <Search aria-hidden="true" />
          <span>Search</span>
        </button>
        <button
          className="mobile-nav-item"
          type="button"
          disabled>
          <MessageCircle aria-hidden="true" />
          <span>Messages</span>
        </button>
        <button
          className="mobile-nav-item"
          type="button"
          disabled>
          <Settings aria-hidden="true" />
          <span>Settings</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
