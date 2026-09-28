import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom'
import './App.css'

const imgProfileAvatar = 'https://www.figma.com/api/mcp/asset/891a3be8-684b-4f26-b73c-adc3a613f8ec.png'
const imgAuthorAvatar = 'https://www.figma.com/api/mcp/asset/52865c04-4070-45da-b19d-1a6ed555d7b7.png'
const imgProjectImage = 'https://www.figma.com/api/mcp/asset/30754270-37d8-488f-8986-0b9b7d2df165.png'
const imgAuthorAvatar1 = 'https://www.figma.com/api/mcp/asset/a10cc70a-4948-479c-b3a6-96406f920958.png'
const imgProjectImage1 = 'https://www.figma.com/api/mcp/asset/ad39a06b-327c-44d0-bb1a-8a8f66fb50cf.png'
const imgPromptImage = 'https://www.figma.com/api/mcp/asset/a689a86e-f22c-459c-8faf-ff444571befe.png'
const imgEllipse = 'https://www.figma.com/api/mcp/asset/4d54c9f9-0723-4d3f-8946-0cffb5d687e0.svg'
const imgEllipse1 = 'https://www.figma.com/api/mcp/asset/12fb24e1-28eb-482d-9de2-bbf80cf5bbc8.svg'
const imgLine = 'https://www.figma.com/api/mcp/asset/5d68d311-2edc-4af4-8191-4a740b7155d2.svg'
const imgLine1 = 'https://www.figma.com/api/mcp/asset/8daa9130-93cb-422a-a3a7-ae7d45efb732.svg'
const imgIcon = 'https://www.figma.com/api/mcp/asset/59706023-6a8b-469b-bcf1-b9943e46edd3.svg'
const imgActiveMarker = 'https://www.figma.com/api/mcp/asset/bb150a0e-c82a-43ef-aba3-d0cf68c53b30.svg'
const imgSearch = 'https://www.figma.com/api/mcp/asset/c21f9e9e-c1b2-4c06-8b6f-390958250661.svg'
const imgIcon1 = 'https://www.figma.com/api/mcp/asset/21122cb5-fda7-4477-9594-f4926496ce65.svg'
const imgTwoPeopleTalking = 'https://www.figma.com/api/mcp/asset/0eadaef5-3212-49d7-a00d-2c01ea5fefe5.svg'
const imgSettings = 'https://www.figma.com/api/mcp/asset/5991e596-afae-449d-934e-f0307f52abf6.svg'
const imgIcon2 = 'https://www.figma.com/api/mcp/asset/2d422ba9-9f09-49de-ab36-13d2b9dc1e35.svg'
const imgEllipse2 = 'https://www.figma.com/api/mcp/asset/ab45314d-c3b2-4067-9e0b-72d32bd5be0d.svg'
const imgIcon3 = 'https://www.figma.com/api/mcp/asset/528c07f3-fe9a-438d-ab72-05773043bd94.svg'
const imgIcon4 = 'https://www.figma.com/api/mcp/asset/f5d983c7-1d55-4601-9522-1669591869c0.svg'
const imgSparkles = 'https://www.figma.com/api/mcp/asset/9f0b3843-7f1b-470c-8c6e-090fc93c95bd.svg'
const imgAmphora = 'https://www.figma.com/api/mcp/asset/b3d27011-19f1-42d0-b9a1-b77d2fa077cb.svg'
const imgSprout = 'https://www.figma.com/api/mcp/asset/bc581f83-7031-4d26-b7ae-8b64ad54d6fc.svg'
const imgCamera = 'https://www.figma.com/api/mcp/asset/b7b9bb77-7f80-467a-80e4-c98c6388f3dd.svg'
const imgIcon5 = 'https://www.figma.com/api/mcp/asset/929f922a-90c2-4e9f-a401-ef5888b6035d.svg'
const imgIcon6 = 'https://www.figma.com/api/mcp/asset/2cc20098-f4f9-45ed-ba1b-0492a26b8d8e.svg'
const imgIcon7 = 'https://www.figma.com/api/mcp/asset/6eefafe4-b5f2-438a-8f1a-a13a436439af.svg'
const imgIcon8 = 'https://www.figma.com/api/mcp/asset/845cabf7-5198-46e8-8ec8-c6402388560f.svg'
const imgIcon9 = 'https://www.figma.com/api/mcp/asset/b066a2fb-cd1a-4cb4-bd53-2ee3acadda6e.svg'
const imgAmphora1 = 'https://www.figma.com/api/mcp/asset/d80a51a6-86f9-44e9-aa24-521c50e59f4d.svg'
const imgActivityMarker = 'https://www.figma.com/api/mcp/asset/7ebc96e2-293e-4b15-a11e-00635eda218e.svg'
const imgSprout1 = 'https://www.figma.com/api/mcp/asset/6f873158-6ff8-4ae4-a7db-5bbd9a785d31.svg'
const imgCamera1 = 'https://www.figma.com/api/mcp/asset/874fc554-6bff-45eb-878b-61579da879b8.svg'

const navItems = [
  { label: 'Home', icon: imgIcon, to: '/' },
  { label: 'Community', icon: imgSearch, to: '/community' },
  { label: 'Search', icon: imgIcon1, to: '/search' },
  { label: 'Messages', icon: imgTwoPeopleTalking, to: '/messages' },
  { label: 'Settings', icon: imgSettings, to: '/settings' },
]

const communityRows = [
  { name: 'Clay Corner', detail: '24 new projects', icon: imgAmphora1 },
  { name: 'Balcony Growers', detail: '12 people active', icon: imgSprout1 },
  { name: 'Slow Film Club', detail: 'Weekly prompt is live', icon: imgCamera1 },
]

const makerRows = [
  { name: 'Theo Brooks', detail: 'Urban gardening · 8 mutuals', avatar: imgAuthorAvatar1 },
  { name: 'Maya Chen', detail: 'Ceramics · 5 mutuals', avatar: imgAuthorAvatar },
]

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/share" element={<SharePage />} />
        <Route path="/browse" element={<BrowsePage />} />
      </Routes>
    </BrowserRouter>
  )
}

function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-row">
            <div className="brand-mark" aria-label="SideQuest logo">
              <div className="brand-graphic">
                <img src={imgEllipse} alt="" className="brand-ellipse" />
                <img src={imgEllipse1} alt="" className="brand-inner" />
                <img src={imgLine} alt="" className="brand-line brand-line-a" />
                <img src={imgLine1} alt="" className="brand-line brand-line-b" />
                <span className="brand-letter brand-letter-s">S</span>
                <span className="brand-letter brand-letter-q">Q</span>
              </div>
            </div>
            <div className="brand-name">SideQuest</div>
          </div>

          <nav className="nav-list" aria-label="Primary navigation">
            {navItems.map(({ label, icon, to }) => (
              <NavLink
                key={label}
                to={to}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <img src={icon} alt="" className="nav-icon" />
                <span>{label}</span>
                {window.location.pathname === to && <img src={imgActiveMarker} alt="" className="active-marker" />}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <Link to="/share" className="cta-button">
            <img src={imgIcon2} alt="" className="nav-icon" />
            <span>Share a side quest</span>
          </Link>

          <Link to="/settings" className="profile-summary">
            <img src={imgProfileAvatar} alt="Alex Morgan" className="profile-avatar" />
            <div className="profile-copy">
              <span className="profile-name">Alex Morgan</span>
              <span className="profile-handle">@alexmakes</span>
            </div>
          </Link>
        </div>
      </aside>

      <div className="content-stage">{children}</div>
    </div>
  )
}

function HomePage() {
  return (
    <DashboardLayout>
      <main className="feed">
        <header className="feed-header">
          <div className="greeting-wrap">
            <h1>Good afternoon, Alex</h1>
            <img src={imgEllipse2} alt="" className="greeting-orb" />
            <p>See what your creative circles are making.</p>
          </div>

          <div className="header-actions" aria-label="Header actions">
            <Link to="/share" className="icon-button small-button" aria-label="Add">
              <img src={imgIcon3} alt="" />
            </Link>
            <Link to="/messages" className="icon-button small-button has-alert" aria-label="Notifications">
              <img src={imgIcon4} alt="" />
              <span className="alert-dot" aria-hidden="true" />
            </Link>
          </div>
        </header>

        <section className="discover-block">
          <div className="section-heading">
            <span>Explore your next side quest</span>
            <Link to="/browse" className="link-button">Browse all</Link>
          </div>

          <div className="chip-row">
            <Link to="/browse" className="chip chip-primary">
              <span className="chip-icon chip-icon-primary">
                <img src={imgSparkles} alt="" />
              </span>
              <span>For you</span>
            </Link>
            <Link to="/browse" className="chip">
              <span className="chip-icon">
                <img src={imgAmphora} alt="" />
              </span>
              <span>Ceramics</span>
            </Link>
            <Link to="/browse" className="chip">
              <span className="chip-icon">
                <img src={imgSprout} alt="" />
              </span>
              <span>Urban garden</span>
            </Link>
            <Link to="/browse" className="chip">
              <span className="chip-icon">
                <img src={imgCamera} alt="" />
              </span>
              <span>Film club</span>
            </Link>
          </div>
        </section>

        <article className="post-card">
          <div className="post-header">
            <img src={imgAuthorAvatar} alt="Maya Chen" className="post-avatar" />
            <div className="post-meta">
              <strong>Maya Chen</strong>
              <span>Clay Corner · 18m</span>
            </div>
            <button type="button" className="icon-button compact" aria-label="More options">
              <img src={imgIcon5} alt="" />
            </button>
          </div>

          <img src={imgProjectImage} alt="Maya Chen breakfast set" className="story-image" />

          <div className="post-details">
            <div className="engagement-row">
              <div className="engagement-item">
                <img src={imgIcon6} alt="" />
                <span>128</span>
              </div>
              <div className="engagement-item">
                <img src={imgIcon7} alt="" />
                <span>24</span>
              </div>
              <div className="engagement-spacer" />
              <img src={imgIcon8} alt="" className="save-icon" />
            </div>

            <p className="post-copy">
              First glaze test on my tiny breakfast set. The speckles came out even dreamier than planned ✨
            </p>
            <Link to="/community" className="post-link">Cheer them on or share a tip →</Link>
          </div>
        </article>

        <article className="post-card">
          <div className="post-header">
            <img src={imgAuthorAvatar1} alt="Theo Brooks" className="post-avatar" />
            <div className="post-meta">
              <strong>Theo Brooks</strong>
              <span>Balcony Growers · 1h</span>
            </div>
            <button type="button" className="icon-button compact" aria-label="More options">
              <img src={imgIcon5} alt="" />
            </button>
          </div>

          <img src={imgProjectImage1} alt="Theo Brooks balcony garden" className="story-image" />

          <div className="post-details">
            <div className="engagement-row">
              <div className="engagement-item">
                <img src={imgIcon6} alt="" />
                <span>86</span>
              </div>
              <div className="engagement-item">
                <img src={imgIcon7} alt="" />
                <span>17</span>
              </div>
              <div className="engagement-spacer" />
              <img src={imgIcon8} alt="" className="save-icon" />
            </div>

            <p className="post-copy">
              Built a cedar herb ladder for the smallest sunny corner of my apartment.
            </p>
            <Link to="/community" className="post-link">Cheer them on or share a tip →</Link>
          </div>
        </article>
      </main>

      <aside className="rail">
        <Link to="/search" className="search-bar">
          <img src={imgIcon9} alt="" />
          <span>Search projects, people, communities</span>
        </Link>

        <section className="rail-panel">
          <div className="rail-header">
            <h2>Your communities</h2>
            <Link to="/community" className="link-button">View all</Link>
          </div>

          {communityRows.map(({ name, detail, icon }) => (
            <Link to="/community" key={name} className="community-row">
              <div className="community-icon">
                <img src={icon} alt="" />
              </div>

              <div className="community-copy">
                <strong>{name}</strong>
                <span>{detail}</span>
              </div>

              <img src={imgActivityMarker} alt="" className="activity-marker" />
            </Link>
          ))}
        </section>

        <section className="makers-panel">
          <h2>Makers to meet</h2>

          {makerRows.map(({ name, detail, avatar }) => (
            <div key={name} className="maker-row">
              <img src={avatar} alt={name} className="maker-avatar" />
              <div className="maker-copy">
                <strong>{name}</strong>
                <span>{detail}</span>
              </div>
              <Link to="/messages" className="follow-button">Follow</Link>
            </div>
          ))}
        </section>

        <Link to="/browse" className="weekly-prompt">
          <img src={imgPromptImage} alt="" className="prompt-bg" />
          <div className="prompt-overlay" />
          <span className="prompt-label">Weekly prompt</span>
          <div className="prompt-copy">
            <h3>Make room for something green</h3>
            <p>Share the tiny growing space you&apos;re proud of.</p>
          </div>
        </Link>

        <div className="legal-links">
          About · Community guidelines · Privacy · © SideQuest 2026
        </div>
      </aside>
    </DashboardLayout>
  )
}

function CommunityPage() {
  return (
    <DashboardLayout>
      <div className="page-shell page-shell--compact">
        <div className="page-header">
          <div>
            <p className="eyebrow">Community</p>
            <h2>Creative circles</h2>
          </div>
          <Link to="/browse" className="primary-link">Browse more</Link>
        </div>

        <div className="page-grid">
          {communityRows.map(({ name, detail, icon }) => (
            <div key={name} className="feature-card">
              <div className="feature-icon">
                <img src={icon} alt="" />
              </div>
              <h3>{name}</h3>
              <p>{detail}</p>
              <Link to="/messages" className="secondary-button">Join</Link>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}

function SearchPage() {
  return (
    <DashboardLayout>
      <div className="page-shell">
        <div className="search-panel">
          <div className="search-field large-search">
            <img src={imgIcon9} alt="" />
            <span>Search projects, makers, and hobbies</span>
          </div>

          <div className="page-grid page-grid--search">
            {['Ceramics', 'Urban garden', 'Film club', 'Upcycling', 'Slow living', 'Pottery studio'].map((tag) => (
              <div key={tag} className="search-tag">{tag}</div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

function MessagesPage() {
  const chats = [
    { name: 'Maya Chen', text: 'The glaze wasn’t too glossy after all.', time: '2m' },
    { name: 'Theo Brooks', text: 'I found a great herb stand idea for tiny spaces.', time: '18m' },
    { name: 'Clay Corner', text: 'You’re invited to this week’s glazing jam.', time: '1h' },
  ]

  return (
    <DashboardLayout>
      <div className="page-shell">
        <div className="page-header">
          <div>
            <p className="eyebrow">Messages</p>
            <h2>Inbox</h2>
          </div>
        </div>

        <div className="message-list">
          {chats.map(({ name, text, time }) => (
            <div key={name} className="message-row">
              <div className="message-avatar">{name.charAt(0)}</div>
              <div className="message-copy">
                <div className="message-topline">
                  <strong>{name}</strong>
                  <span>{time}</span>
                </div>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}

function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="page-shell">
        <div className="page-header">
          <div>
            <p className="eyebrow">Settings</p>
            <h2>Profile preferences</h2>
          </div>
        </div>

        <div className="settings-list">
          {['Notifications', 'Privacy', 'Saved projects', 'Accessibility', 'Account details'].map((setting) => (
            <div key={setting} className="setting-row">
              <span>{setting}</span>
              <button type="button" className="toggle-button">On</button>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}

function SharePage() {
  return (
    <DashboardLayout>
      <div className="page-shell">
        <div className="page-header">
          <div>
            <p className="eyebrow">Create</p>
            <h2>Share a side quest</h2>
          </div>
        </div>

        <div className="form-card">
          <label className="field-group">
            <span>Title</span>
            <input defaultValue="Tiny herb nook refresh" />
          </label>
          <label className="field-group">
            <span>What are you making?</span>
            <textarea defaultValue="I reworked a tiny balcony corner into a small edible garden with repurposed containers and fresh herbs." />
          </label>
          <div className="submit-row">
            <button type="button" className="primary-button">Publish</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

function BrowsePage() {
  return (
    <DashboardLayout>
      <div className="page-shell">
        <div className="page-header">
          <div>
            <p className="eyebrow">Explore</p>
            <h2>Discover next ideas</h2>
          </div>
        </div>

        <div className="page-grid">
          {[
            ['For you', 'Creative picks based on your recent saves'],
            ['Ceramics', 'Glaze studies and studio rituals'],
            ['Urban garden', 'Small-space growing hacks and plant care'],
            ['Film club', 'Weekly prompts and photo diaries'],
          ].map(([title, desc]) => (
            <div key={title} className="feature-card">
              <h3>{title}</h3>
              <p>{desc}</p>
              <Link to="/community" className="secondary-button">View</Link>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}

export default App
