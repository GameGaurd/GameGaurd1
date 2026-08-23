import { useEffect, useState } from "react";
import "./App.css";
import { MiddlemanDashboard, MiddlemanProfile } from "./Middleman";
import { Marketplace, SellAccount } from "./Marketplace";

type User = {
  id: string;
  username: string;
  displayName?: string;
  email: string;
  role: string;
  avatar: string;
  avatarUrl?: string;
  verifiedMiddleman?: boolean;
  createdAt: string;
};
type Message = {
  id: number;
  author: string;
  role: string;
  body: string;
  time: string;
  system?: boolean;
};
type RequestRecord = {
  id: string;
  game: string;
  item: string;
  amount: string;
  status: string;
  created: string;
  middleman?: User | null;
  buyer?: User | null;
  seller?: User | null;
  messages: Message[];
};
function CustomerAvatar({ initials, image, className = "avatar purple" }: { initials: string; image?: string; className?: string }) {
  const [imageLoaded, setImageLoaded] = useState(Boolean(image));
  return <div className={className}>{image && <img src={image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} onError={(event) => { setImageLoaded(false); event.currentTarget.style.display = "none" }} onLoad={() => setImageLoaded(true)} />}{!imageLoaded && initials}</div>;
}
const games = [
  ["Valorant", "VAL", "red", "Competitive accounts"],
  ["Mobile Legends", "ML", "blue", "Skins & accounts"],
  ["Roblox", "RBX", "yellow", "Limited items"],
  ["Fortnite", "FN", "violet", "Accounts & cosmetics"],
];
const requestSeed: RequestRecord = {
  id: "",
  game: "Valorant",
  item: "Radiant Valorant Account",
  amount: "$240.00",
  status: "Open",
  created: "Just now",
  messages: [
    {
      id: 1,
      author: "System",
      role: "SYSTEM",
      body: "Transaction room created. Waiting for middleman acceptance.",
      time: "Just now",
      system: true,
    },
  ],
};

function App() {
  const path = window.location.pathname;
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setViewState] = useState(
    path === "/middleman/profile"
      ? "Middleman Profile"
      : path.startsWith("/middleman") && path !== "/middleman/login"
        ? "Middleman Overview"
        : path === "/marketplace/sell"
          ? "Sell Your Account"
          : path === "/marketplace"
            ? "Marketplace"
            : "Overview",
  );
  const [mode, setMode] = useState<"buyer" | "seller">("buyer");
  const [request, setRequest] = useState<RequestRecord | null>(null);
  const [showRequest, setShowRequest] = useState(false);
  const [step, setStep] = useState(1);
  const [toast, setToast] = useState("");
  const [draft, setDraft] = useState("");
  const [profileMenu, setProfileMenu] = useState(false);
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, []);
  useEffect(() => {
    if (request)
      localStorage.setItem("gameguard-request-v2", JSON.stringify(request));
    else localStorage.removeItem("gameguard-request-v2");
    if (
      !user ||
      user.role !== "customer" ||
      !request ||
      (request.id && localStorage.getItem(`gameguard-synced-${request.id}`))
    )
      return;
    fetch("/api/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        game: request.game,
        item: request.item,
        amount: request.amount,
      }),
    })
      .then((response) => {
        if (response.ok)
          localStorage.setItem(`gameguard-synced-${request.id}`, "1");
        else setToast("Request could not be saved. Please try again.");
      })
      .catch(() => setToast("Request could not be saved. Please try again."));
  }, [request, user]);
  useEffect(() => {
    if (!user || user.role !== "customer") return;
    const refresh = () =>
      fetch("/api/requests")
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          const latest = data?.requests?.[0];
          if (!latest) return;
          localStorage.setItem(`gameguard-synced-${latest.id}`, "1");
          setRequest({
            id: latest.id,
            game: latest.game,
            item: latest.item,
            amount: latest.amount,
            status: latest.status,
            created: new Date(latest.createdAt).toLocaleString([], {
              dateStyle: "medium",
              timeStyle: "short",
            }),
            middleman: latest.middleman,
            buyer: latest.buyer,
            seller: latest.seller,
            messages: latest.messages.map(
              (message: {
                id: string;
                body: string;
                system?: boolean;
                createdAt: string;
                authorId: string;
                authorName?: string;
                authorRole?: string;
              }) => ({
                id: Date.parse(message.createdAt),
                author: message.system
                  ? "System"
                  : message.authorId === user.id
                    ? "You"
                    : message.authorName || "Participant",
                role: message.system
                  ? "SYSTEM"
                  : message.authorRole || "PARTICIPANT",
                body: message.body,
                time: new Date(message.createdAt).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                }),
                system: message.system,
              }),
            ),
          });
        })
        .catch(() => undefined);
    refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => window.clearInterval(timer);
  }, [user]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);
  if (authLoading) return <AuthLoading />;
  if (path === "/middleman/login")
    return <AuthPage mode="middleman-login" setUser={setUser} />;
  if (["login", "signup", "forgot-password"].includes(path.slice(1)))
    return (
      <AuthPage
        mode={path.slice(1) as "login" | "signup" | "forgot-password"}
        setUser={setUser}
      />
    );
  if (
    path.startsWith("/middleman") &&
    (!user || (user.role !== "middleman" && user.role !== "admin"))
  ) {
    window.location.replace("/middleman/login");
    return <AuthLoading />;
  }
  if (!user) return <GuestView />;
  const stats = [
    [
      "Active purchases",
      request ? "1" : "0",
      "Purchases currently in progress",
      "↗",
    ],
    ["Active sales", "1", "Sales currently in progress", "↗"],
    [
      "Middleman requests",
      request ? "1" : "0",
      "Requests awaiting action",
      "⌁",
    ],
    ["Completed", "0", "Successfully completed", "✓"],
  ];
  const initials = user?.avatar || "GU";
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.assign("/");
  };
  const openRequest = () =>
    user
      ? setShowRequest(true)
      : window.location.assign("/login?next=/dashboard");
  const setView = (nextView: string) =>
    nextView === "Middleman Requests" ? openRequest() : setViewState(nextView);
  const nav = [
    "Overview",
    "Marketplace",
    "My Purchases",
    "My Sales",
    "My Transactions",
    "Middleman Requests",
    "Messages",
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">G</span>
          <span>
            GAME<span>GUARD</span>
          </span>
        </div>
        <div className="workspace-label">
          WORKSPACE <span>⌄</span>
        </div>
        <nav>
          {nav.map((item, index) => (
            <button
              className={view === item ? "nav-item active" : "nav-item"}
              onClick={() => setView(item)}
              key={item}
            >
              <span className="nav-icon">
                {["▦", "◈", "↙", "↗", "↔", "⊙", "□"][index]}
              </span>
              {item}
              {item === "Messages" && <b>3</b>}
            </button>
          ))}
          <div className="nav-divider" />
          <div className="workspace-label">ACCOUNT</div>
          {["Reviews", "Profile", "Settings"].map((item) => (
            <button
              className={view === item ? "nav-item active" : "nav-item"}
              onClick={() => setView(item)}
              key={item}
            >
              <span className="nav-icon">
                {item === "Reviews" ? "☆" : item === "Profile" ? "◎" : "⚙"}
              </span>
              {item}
            </button>
          ))}
          <button className="nav-item" onClick={logout}>
            <span className="nav-icon">↪</span>Logout
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="status-dot">
            <span /> Platform operational
          </div>
          <div className="user-mini">
            <div className="avatar">{initials}</div>
            <div>
              <strong>{user?.username || "Guest"}</strong>
              <small>Personal account</small>
            </div>
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">G</span> GAMEGUARD
          </div>
          <div className="breadcrumbs">
            Workspace <span>/</span> {view}
          </div>
          <div className="top-actions">
            <button className="icon-button">⌕</button>
            {user ? (
              <>
                <button className="icon-button notification">
                  ♧<i />
                </button>
                <div className="profile-anchor">
                  <button
                    className="avatar small avatar-button"
                    onClick={() => setProfileMenu(!profileMenu)}
                  >
                    {initials}
                  </button>
                  {profileMenu && (
                    <div className="profile-menu">
                      <strong>{user.username}</strong>
                      <small>Personal account</small>
                      <hr />
                      <button
                        onClick={() => {
                          setView("Overview");
                          setProfileMenu(false);
                        }}
                      >
                        Dashboard
                      </button>
                      <button
                        onClick={() => {
                          setView("Profile");
                          setProfileMenu(false);
                        }}
                      >
                        Profile
                      </button>
                      <button
                        onClick={() => {
                          setView("Settings");
                          setProfileMenu(false);
                        }}
                      >
                        Settings
                      </button>
                      <button onClick={logout}>Logout</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button
                  className="header-link"
                  onClick={() => window.location.assign("/login")}
                >
                  Sign In
                </button>
                <button
                  className="header-signup"
                  onClick={() => window.location.assign("/signup")}
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </header>
        {view === "Overview" ? (
          <Dashboard
            user={user}
            mode={mode}
            setMode={setMode}
            stats={stats}
            request={request}
            openRequest={openRequest}
            setView={setView}
          />
        ) : view === "Profile" ? (
          <ProfileView user={user} />
        ) : view === "My Transactions" || view === "Messages" ? (
          request ? (
            <TransactionView
              request={request}
              draft={draft}
              setDraft={setDraft}
              setRequest={setRequest}
              setToast={setToast}
            />
          ) : (
            <EmptyTransaction onAction={openRequest} />
          )
        ) : (
          <PlaceholderView title={view} user={user} onAction={openRequest} />
        )}
      </main>
      {showRequest && (
        <RequestModal
          step={step}
          setStep={setStep}
          close={() => {
            setShowRequest(false);
            setStep(1);
          }}
          submit={() => {
            setRequest(requestSeed);
            setShowRequest(false);
            setStep(1);
            setToast("Request submitted · MM-2026-000001");
          }}
        />
      )}
      {toast && (
        <div className="toast">
          <span>✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}

function Dashboard({
  user,
  mode,
  setMode,
  stats,
  request,
  openRequest,
  setView,
}: {
  user: User | null;
  mode: "buyer" | "seller";
  setMode: (mode: "buyer" | "seller") => void;
  stats: string[][];
  request: RequestRecord | null;
  openRequest: () => void;
  setView: (view: string) => void;
}) {
  const name = user?.username || "there";
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">SUNDAY, AUGUST 23, 2026</p>
          <h1>Good morning, {name}.</h1>
          <p className="subheading">
            Manage your purchases, listings, and transactions from one place.
          </p>
        </div>
        <button className="primary-button" onClick={openRequest}>
          <span>＋</span> Request a middleman
        </button>
      </section>
      <section className="quick-actions">
        <p className="eyebrow">QUICK ACTIONS</p>
        <div>
          <button onClick={() => setView("Marketplace")}>
            ◈ Browse marketplace
          </button>
          <button onClick={openRequest}>⊙ Request a middleman</button>
          <button onClick={() => setView("My Sales")}>＋ Create listing</button>
          <button onClick={() => setView("My Transactions")}>
            ↔ My transactions
          </button>
        </div>
      </section>
      <section className="stat-grid">
        {stats.map(([label, value, description, icon]) => (
          <div className="stat-card" key={label}>
            <div className="stat-head">
              <span>{label}</span>
              <span className="stat-icon">{icon}</span>
            </div>
            <strong>{value}</strong>
            <small>{description}</small>
          </div>
        ))}
      </section>
      <div className="role-switcher">
        <span>YOUR MARKETPLACE VIEW</span>
        <button
          className={mode === "buyer" ? "selected" : ""}
          onClick={() => setMode("buyer")}
        >
          BUYER
        </button>
        <button
          className={mode === "seller" ? "selected" : ""}
          onClick={() => setMode("seller")}
        >
          SELLER
        </button>
      </div>
      {mode === "buyer" ? (
        <BuyerSection request={request} setView={setView} />
      ) : (
        <SellerSection setView={setView} />
      )}
      <section className="popular-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">EXPLORE SAFELY</p>
            <h2>Popular categories</h2>
          </div>
          <button
            className="text-button"
            onClick={() => setView("Marketplace")}
          >
            Browse marketplace <span>→</span>
          </button>
        </div>
        <div className="game-grid">
          {games.map(([name, short, tone, players]) => (
            <button className="game-card" key={name} onClick={openRequest}>
              <div className={`game-art ${tone}`}>
                <span>{short}</span>
                <em>↗</em>
              </div>
              <strong>{name}</strong>
              <small>{players}</small>
            </button>
          ))}
        </div>
      </section>
      <div className="tos-note">
        <span>◉</span>
        <p>
          <strong>Trade responsibly.</strong> Make sure your transaction
          complies with the game publisher’s Terms of Service. GameGuard does
          not facilitate prohibited transfers.
        </p>
      </div>
    </>
  );
}

function BuyerSection({
  request,
  setView,
}: {
  request: RequestRecord | null;
  setView: (view: string) => void;
}) {
  return (
    <section className="market-section">
      <div className="section-title">
        <div>
          <p className="eyebrow">BUYER</p>
          <h2>Current purchases</h2>
        </div>
        <button className="text-button" onClick={() => setView("My Purchases")}>
          View all →
        </button>
      </div>
      {request ? (
        <div className="buyer-card">
          <div className="game-avatar red">VAL</div>
          <div className="buyer-info">
            <strong>{request.item}</strong>
            <small>Seller: Maya Chen · {request.id}</small>
            <div className="mini-progress">
              <span />
            </div>
            <small className="progress-copy">Verification in progress</small>
          </div>
          <strong className="card-price">{request.amount}</strong>
          <span className="status-badge">
            <i /> {request.status}
          </span>
          <button
            className="outline-button compact-button"
            onClick={() => setView("My Transactions")}
          >
            Open transaction
          </button>
        </div>
      ) : (
        <div className="empty-section">
          <strong>No active purchases yet</strong>
          <small>
            Browse the marketplace to find a listing and start a protected
            transaction.
          </small>
          <button
            className="text-button"
            onClick={() => setView("Marketplace")}
          >
            Browse marketplace →
          </button>
        </div>
      )}
    </section>
  );
}
function EmptyTransaction({ onAction }: { onAction: () => void }) {
  return (
    <section className="empty-transaction">
      <div className="empty-icon">⊙</div>
      <h1>No transaction room yet</h1>
      <p>
        Transaction rooms appear here after a buyer or seller submits a
        middleman request.
      </p>
      <button className="primary-button" onClick={onAction}>
        Request a middleman
      </button>
    </section>
  );
}
function SellerSection({ setView }: { setView: (view: string) => void }) {
  return (
    <section className="market-section">
      <div className="section-title">
        <div>
          <p className="eyebrow">SELLER</p>
          <h2>Active listings & sales</h2>
        </div>
        <button
          className="primary-button small-button"
          onClick={() => setView("My Sales")}
        >
          ＋ Create listing
        </button>
      </div>
      <div className="seller-grid">
        <div className="seller-card">
          <div className="game-avatar red">VAL</div>
          <div>
            <strong>Radiant Account · 82 Skins</strong>
            <small>$240.00 · Active listing</small>
          </div>
          <span className="active-label">● Active</span>
          <button className="text-button" onClick={() => setView("My Sales")}>
            Manage listing →
          </button>
        </div>
        <div className="seller-card muted-card">
          <div className="empty-icon">+</div>
          <div>
            <strong>Create your next listing</strong>
            <small>Reach buyers while keeping every deal in-room.</small>
          </div>
          <button className="text-button" onClick={() => setView("My Sales")}>
            Get started →
          </button>
        </div>
      </div>
    </section>
  );
}
function ProfileView({ user }: { user: User | null }) {
  return (
    <section className="profile-view">
      <p className="eyebrow">ACCOUNT</p>
      <h1>Profile</h1>
      <div className="profile-card panel">
        <div className="profile-hero">
          <div className="profile-avatar">{user?.avatar}</div>
          <div>
            <h2>{user?.username}</h2>
            <p>Personal account</p>
          </div>
          <span className="account-status">
            <i /> Active account
          </span>
        </div>
        <div className="profile-details">
          <div>
            <span>Username</span>
            <strong>@{user?.username}</strong>
          </div>
          <div>
            <span>Email</span>
            <strong>{user?.email}</strong>
          </div>
          <div>
            <span>Account created</span>
            <strong>
              {user ? new Date(user.createdAt).toLocaleDateString() : "—"}
            </strong>
          </div>
          <div>
            <span>Buyer transactions</span>
            <strong>1 active</strong>
          </div>
          <div>
            <span>Seller transactions</span>
            <strong>1 active</strong>
          </div>
          <div>
            <span>Reviews</span>
            <strong>No reviews yet</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReviewsView() {
  const reviews = [
    [
      "Maya Chen",
      "MC",
      "Smooth and transparent transaction from start to finish.",
      "2 days ago",
    ],
    [
      "Jordan Lee",
      "JL",
      "Clear communication and a well-organized transaction room.",
      "5 days ago",
    ],
    [
      "Lina Cruz",
      "LC",
      "The middleman workflow made the handoff easy to follow.",
      "1 week ago",
    ],
    [
      "Theo James",
      "TJ",
      "Everything was documented clearly and the process felt secure.",
      "1 week ago",
    ],
    [
      "Nadia Putri",
      "NP",
      "Fast responses, friendly communication, and no surprises.",
      "2 weeks ago",
    ],
    [
      "Avery Stone",
      "AS",
      "The status updates made it easy to know what happened next.",
      "2 weeks ago",
    ],
    [
      "Rafi Santos",
      "RS",
      "A straightforward transaction with helpful guidance throughout.",
      "3 weeks ago",
    ],
    [
      "Quinn Park",
      "QP",
      "The private chat kept the buyer and seller on the same page.",
      "1 month ago",
    ],
    [
      "Noah Williams",
      "NW",
      "Clear expectations and a smooth handoff from both sides.",
      "1 month ago",
    ],
  ];
  return (
    <section className="reviews-view">
      <div className="reviews-heading">
        <div>
          <p className="eyebrow">COMMUNITY FEEDBACK</p>
          <h1>Reviews</h1>
          <p className="subheading">
            Feedback from completed GameGuard transactions.
          </p>
        </div>
      </div>
      <div className="review-summary panel">
        <div>
          <strong>1,120</strong>
          <span>reviews</span>
        </div>
        <div className="review-score">
          <strong>4.9</strong>
          <span>★★★★★</span>
          <small>Average rating</small>
        </div>
        <div className="review-bars">
          <span>
            <i style={{ width: "94%" }} />5
          </span>
          <span>
            <i style={{ width: "4%" }} />4
          </span>
          <span>
            <i style={{ width: "2%" }} />3
          </span>
        </div>
      </div>
      <div className="review-list">
        {reviews.map(([name, avatar, text, date]) => (
          <article className="review-card panel" key={name}>
            <div className="avatar purple">{avatar}</div>
            <div>
              <strong>{name}</strong>
              <span className="review-stars">
                ★★★★★ <small>5.0</small>
              </span>
              <p>{text}</p>
              <time>{date}</time>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
function PlaceholderView({
  title,
  user,
  onAction,
}: {
  title: string;
  user: User | null;
  onAction: () => void;
}) {
  if (title === "Marketplace")
    return (
      <Marketplace
        onRequest={onAction}
        onSell={() => window.location.assign("/marketplace/sell")}
        onToast={(message) => window.alert(message)}
      />
    );
  if (title === "Sell Your Account")
    return (
      <SellAccount
        onBack={() => window.location.assign("/marketplace")}
        onPublished={() => window.location.assign("/marketplace")}
      />
    );
  return title.trim().toLowerCase() === "reviews" ? (
    <ReviewsView />
  ) : title === "Middleman Overview" ? (
    <MiddlemanDashboard
      user={user as User & { role: "middleman" }}
      onLogout={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.assign("/middleman/login");
      }}
    />
  ) : title === "Middleman Profile" ? (
    <MiddlemanProfile user={user as User & { role: "middleman" }} />
  ) : (
    <section className="placeholder-view">
      <p className="eyebrow">{title.toUpperCase()}</p>
      <h1>{title}</h1>
      <p className="subheading">
        This workspace is connected to {user?.username}'s account.
      </p>
      <button className="primary-button" onClick={onAction}>
        ＋ Request a middleman
      </button>
    </section>
  );
}
function AuthLoading() {
  return (
    <div className="auth-loading">
      <span className="brand-mark">G</span>
      <div className="loading-bar" />
    </div>
  );
}
function GuestView() {
  const [view, setView] = useState(
    window.location.pathname === "/reviews" ? "Reviews" : "Marketplace",
  );
  const goLogin = () => window.location.assign("/login?next=/dashboard");
  return (
    <div className="app-shell guest-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">G</span>
          <span>
            GAME<span>GUARD</span>
          </span>
        </div>
        <div className="workspace-label">
          BROWSE <span>⌄</span>
        </div>
        <nav>
          <button
            className={view === "Marketplace" ? "nav-item active" : "nav-item"}
            onClick={() => setView("Marketplace")}
          >
            <span className="nav-icon">◈</span>Marketplace
          </button>
          <button
            className={view === "Reviews" ? "nav-item active" : "nav-item"}
            onClick={() => setView("Reviews")}
          >
            <span className="nav-icon">☆</span>Reviews
          </button>
          <button className="nav-item" onClick={goLogin}>
            <span className="nav-icon">⊙</span>Request a middleman
          </button>
          <div className="nav-divider" />
          <button className="nav-item" onClick={goLogin}>
            <span className="nav-icon">↔</span>My Transactions
          </button>
          <button className="nav-item" onClick={goLogin}>
            <span className="nav-icon">↪</span>Sign In
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="status-dot">
            <span /> Platform operational
          </div>
          <button
            className="guest-signup"
            onClick={() => window.location.assign("/signup")}
          >
            Create an account →
          </button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">G</span> GAMEGUARD
          </div>
          <div className="breadcrumbs">
            Guest workspace <span>/</span> {view}
          </div>
          <div className="top-actions">
            <button className="header-link" onClick={goLogin}>
              Sign In
            </button>
            <button
              className="header-signup"
              onClick={() => window.location.assign("/signup")}
            >
              Sign Up
            </button>
          </div>
        </header>
        {view === "Marketplace" ? (
          <Marketplace
            onRequest={goLogin}
            onSell={goLogin}
            onToast={(message) => window.alert(message)}
          />
        ) : (
          <ReviewsView />
        )}
      </main>
    </div>
  );
}
function AuthPage({
  mode,
  setUser,
}: {
  mode: "login" | "signup" | "forgot-password" | "middleman-login";
  setUser: (user: User | null) => void;
}) {
  const [form, setForm] = useState({
    username: "",
    email: "",
    identity: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isLogin = mode === "login" || mode === "middleman-login";
  const isMiddleman = mode === "middleman-login";
  const isForgot = mode === "forgot-password";
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const endpoint = isMiddleman
      ? "/api/middleman/login"
      : isForgot
        ? "/api/auth/forgot-password"
        : isLogin
          ? "/api/auth/login"
          : "/api/auth/signup";
    const payload = isForgot
      ? { email: form.email }
      : isLogin
        ? { identity: form.identity, password: form.password }
        : form;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) return setError(data.error || "Unable to sign in.");
      if (isForgot) return setMessage(data.message);
      setUser(data.user);
      window.location.assign(
        isMiddleman
          ? "/middleman/dashboard"
          : new URLSearchParams(window.location.search).get("next") ||
              "/dashboard",
      );
    } catch {
      setError("The server could not be reached. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <span className="brand-mark">G</span>
        <span>
          GAME<span>GUARD</span>
        </span>
      </div>
      <div className="auth-card">
        <p className="eyebrow">
          {isMiddleman
            ? "MIDDLEMAN PORTAL"
            : isForgot
              ? "ACCOUNT RECOVERY"
              : isLogin
                ? "WELCOME BACK"
                : "GET STARTED"}
        </p>
        <h1>
          {isMiddleman
            ? "Middleman Portal"
            : isForgot
              ? "Reset your password."
              : isLogin
                ? "Sign in to GameGuard."
                : "Create your account."}
        </h1>
        <p className="auth-copy">
          {isMiddleman
            ? "Sign in to access the middleman workspace."
            : "A secure workspace for transparent gaming transactions."}
        </p>
        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-success">{message}</div>}
        <form onSubmit={submit}>
          {!isLogin && !isForgot && (
            <label>
              Username
              <input
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </label>
          )}
          {!isForgot && (
            <label>
              {isLogin ? "Email" : "Email"}
              <input
                required
                type={isLogin ? "email" : "email"}
                value={isLogin ? form.identity : form.email}
                onChange={(e) =>
                  setForm({
                    ...form,
                    [isLogin ? "identity" : "email"]: e.target.value,
                  })
                }
              />
            </label>
          )}
          {isForgot && (
            <label>
              Email
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
          )}
          {!isForgot && (
            <label>
              Password
              <input
                required
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
          )}
          {!isLogin && !isForgot && (
            <label>
              Confirm password
              <input
                required
                type="password"
                value={form.confirmPassword}
                onChange={(e) =>
                  setForm({ ...form, confirmPassword: e.target.value })
                }
              />
            </label>
          )}
          <button className="primary-button auth-submit" disabled={submitting}>
            {submitting ? "Signing in..." : isForgot ? "Send instructions" : "Sign in"} <span>→</span>
          </button>
        </form>
        {(isLogin || isForgot) && (
          <button
            className="forgot-link"
            onClick={() =>
              window.location.assign(
                isMiddleman ? "/forgot-password" : "/forgot-password",
              )
            }
          >
            Forgot password?
          </button>
        )}
        <div className="auth-switch">
          {isMiddleman ? (
            <button onClick={() => window.location.assign("/login")}>
              ← Back to customer login
            </button>
          ) : isLogin ? (
            <>
              Don't have an account?{" "}
              <button onClick={() => window.location.assign("/signup")}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button onClick={() => window.location.assign("/login")}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
      <p className="auth-footer">
        Private by design · Follow applicable game platform Terms of Service
      </p>
    </div>
  );
}

function TransactionView({
  request,
  draft,
  setDraft,
  setRequest,
  setToast,
}: {
  request: RequestRecord;
  draft: string;
  setDraft: (value: string) => void;
  setRequest: React.Dispatch<React.SetStateAction<RequestRecord | null>>;
  setToast: (value: string) => void;
}) {
  const waiting = request.status === "Open";
  const statusLabel = waiting
    ? "Waiting for middleman acceptance"
    : request.status;
  const send = async () => {
    if (!draft.trim()) return;
    const body = draft.trim();
    const response = await fetch(`/api/requests/${request.id}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!response.ok) return setToast("Message could not be sent");
    setRequest((current) =>
      current
        ? {
            ...current,
            messages: [
              ...current.messages,
              {
                id: Date.now(),
                author: "You",
                role: "SELLER",
                body,
                time: new Date().toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                }),
              },
            ],
          }
        : current,
    );
    setDraft("");
    setToast("Message sent");
  };
  return (
    <section className="transaction-view">
      <div className="page-heading compact">
        <div>
          <p className="eyebrow">TRANSACTION ROOM</p>
          <h1>{request.id}</h1>
        </div>
        <span className="status-badge large">
          <i /> {statusLabel}
        </span>
      </div>
      <div className="room-grid">
        <aside className="room-details panel">
          <div className="panel-title">
            <h3>Transaction details</h3>
          </div>
          <div className="detail-game">
            <div className="game-avatar red">VAL</div>
            <div>
              <strong>{request.game}</strong>
              <small>{request.item}</small>
            </div>
          </div>
          {[
            ["Amount", request.amount],
            ["Created", request.created],
            ["Role", "SELLER"],
          ].map(([label, value]) => (
            <div className="detail-row" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </aside>
        <div className="chat panel">
          <div className="chat-header">
            <div>
              <h3>Transaction chat</h3>
              <span>
                <i />{" "}
                {waiting
                  ? "Waiting for middleman"
                  : "Transaction participants"}{" "}
              </span>
            </div>
          </div>
          <div className="message-list">
            {request.messages.map((message) =>
              message.system ? (
                <div className="system-message" key={message.id}>
                  <span>✦</span>
                  {message.body}
                </div>
              ) : (
                <div className="message" key={message.id}>
                  <CustomerAvatar initials={message.role === "MIDDLEMAN" ? "MM" : message.author.slice(0, 2).toUpperCase()} image={message.role === "MIDDLEMAN" ? "/avatars/mysticmm-customer.svg" : undefined} className="avatar tiny purple" />
                  <div>
                    <div className="message-meta">
                      <strong>{message.author}</strong>
                      <span className="role buyer">{message.role}</span>
                      <time>{message.time}</time>
                    </div>
                    <p>{message.body}</p>
                  </div>
                </div>
              ),
            )}
          </div>
          <div className="composer">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type a message..."
            />
            <button className="send" onClick={send}>
              ↑
            </button>
          </div>
        </div>
        <aside className="participants panel">
          <div className="panel-title">
            <h3>Participants</h3>
          </div>
          {[
            [
              waiting
                ? "Waiting for middleman acceptance"
                : request.middleman?.displayName || "MysticMM",
              "MIDDLEMAN",
              waiting ? "?" : request.middleman?.avatar || "MM",
            ],
            [
              request.buyer?.displayName || "Waiting for buyer assignment",
              "BUYER",
              request.buyer?.avatar || "?",
            ],
            [request.seller?.displayName || "You", "SELLER", request.seller?.avatar || "YO"],
          ].map(([name, role, avatar]) => (
            <div className="participant" key={role}>
              <CustomerAvatar initials={avatar} image={role === "MIDDLEMAN" && !waiting ? "/avatars/mysticmm-customer.svg" : undefined} />
              <div>
                <strong>{name}</strong>
                <small>{role}</small>
              </div>
              <span className="online-dot" />
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
}

function RequestModal({
  step,
  setStep,
  close,
  submit,
}: {
  step: number;
  setStep: (step: number) => void;
  close: () => void;
  submit: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div className="request-modal">
        <div className="modal-top">
          <div>
            <p className="eyebrow">NEW REQUEST</p>
            <h2>Request a middleman</h2>
          </div>
          <button className="close-button" onClick={close}>
            ×
          </button>
        </div>
        <div className="stepper">
          {["Transaction", "Participants", "Details", "Confirm"].map(
            (label, i) => (
              <div
                className={i + 1 <= step ? "step active" : "step"}
                key={label}
              >
                <span>{i + 1 < step ? "✓" : i + 1}</span>
                {label}
              </div>
            ),
          )}
        </div>
        {step === 1 && (
          <div className="form-content">
            <label>
              Game
              <select>
                <option>Valorant</option>
                <option>Mobile Legends</option>
                <option>Roblox</option>
                <option>Fortnite</option>
              </select>
            </label>
            <label>
              Transaction type
              <select>
                <option>Purchase</option>
                <option>Sale</option>
                <option>Trade</option>
              </select>
            </label>
            <label>
              Item or account description
              <input defaultValue="Radiant Valorant Account" />
            </label>
            <div className="form-row">
              <label>
                Amount
                <input defaultValue="240.00" />
              </label>
              <label>
                Currency
                <select>
                  <option>USD ($)</option>
                </select>
              </label>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="form-content">
            <div className="form-intro">
              Buyer and seller can be added now or later by your middleman.
            </div>
            <label>
              Buyer username
              <input placeholder="@username (optional)" />
            </label>
            <label>
              Seller username
              <input placeholder="@username (optional)" />
            </label>
          </div>
        )}
        {step === 3 && (
          <div className="form-content">
            <label>
              Additional information
              <textarea placeholder="Tell your middleman what matters about this transaction." />
            </label>
            <button className="upload-zone">
              ＋ <span>Add screenshots or files</span>
              <small>PNG, JPG or PDF up to 10 MB</small>
            </button>
          </div>
        )}
        {step === 4 && (
          <div className="confirm-content">
            <div className="confirm-icon">✓</div>
            <h3>Ready to submit</h3>
            <p>
              Your request will be created with a pending status and a private
              transaction room.
            </p>
          </div>
        )}
        <div className="modal-actions">
          {step > 1 ? (
            <button className="back-button" onClick={() => setStep(step - 1)}>
              Back
            </button>
          ) : (
            <span />
          )}
          {step < 4 ? (
            <button
              className="primary-button"
              onClick={() => setStep(step + 1)}
            >
              Continue →
            </button>
          ) : (
            <button className="primary-button" onClick={submit}>
              Submit request →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
