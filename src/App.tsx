import { useEffect, useRef, useState } from "react";
import "./App.css";
import { MiddlemanDashboard, MiddlemanProfile } from "./Middleman";
import { Marketplace, SellAccount } from "./Marketplace";
import heroArtwork from "./assets/hero.png";

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
  authorId?: string;
  author: string;
  role: string;
  body: string;
  time: string;
  system?: boolean;
  readBy?: string[];
  attachment?: { name: string; type: string; data: string } | null;
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
type PrivateConversation = {
  id: string;
  customer: User | null;
  middleman: User | null;
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
          : path === "/marketplace" || path.startsWith("/marketplace/listing/")
            ? "Marketplace"
            : "Overview",
  );
  const [mode, setMode] = useState<"buyer" | "seller">("buyer");
  const [request, setRequest] = useState<RequestRecord | null>(() => {
    try {
      const saved = localStorage.getItem("gameguard-request-v2");
      return saved ? (JSON.parse(saved) as RequestRecord) : null;
    } catch {
      return null;
    }
  });
  const [showRequest, setShowRequest] = useState(false);
  const [step, setStep] = useState(1);
  const [toast, setToast] = useState("");
  const [draft, setDraft] = useState("");
  const [profileMenu, setProfileMenu] = useState(false);
  const [privateConversation, setPrivateConversation] = useState<PrivateConversation | null>(null);
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, []);
  useEffect(() => {
    if (!user || user.role !== "customer") return;
    fetch("/api/conversations")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const conversations = data?.conversations || [];
        const savedId = localStorage.getItem("gameguard-private-conversation");
        const conversation = conversations.find(
          (item: PrivateConversation) => item.id === savedId,
        ) || conversations[0];
        if (!conversation) return;
        localStorage.setItem("gameguard-private-conversation", conversation.id);
        setPrivateConversation(conversation);
      })
      .catch(() => undefined);
  }, [user]);
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
                readBy?: string[];
                attachment?: { name: string; type: string; data: string } | null;
              }) => ({
                id: Date.parse(message.createdAt),
                authorId: message.authorId,
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
                readBy: message.readBy,
                attachment: message.attachment,
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
  if (["/how-it-works", "/safety", "/support", "/terms", "/privacy", "/refunds", "/acceptable-use"].includes(path)) {
    return <InformationPage path={path} />;
  }
  if (
    path.startsWith("/middleman") &&
    (!user || (user.role !== "middleman" && user.role !== "admin"))
  ) {
    window.location.replace(user ? "/dashboard" : "/middleman/login");
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
  const contactMiddleman = async () => {
    const response = await fetch("/api/conversations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    if (!response.ok) return setToast("Middleman chat could not be opened");
    const data = await response.json();
    localStorage.setItem("gameguard-private-conversation", data.conversation.id);
    setPrivateConversation(data.conversation);
    setViewState("Messages");
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
          privateConversation && view === "Messages" ? <DirectMessages conversation={privateConversation} user={user} setConversation={setPrivateConversation} setToast={setToast} /> : request ? (
            <TransactionView
              request={request}
              draft={draft}
              setDraft={setDraft}
              setRequest={setRequest}
              setToast={setToast}
              onContactMiddleman={contactMiddleman}
            />
          ) : (
            <EmptyTransaction onAction={openRequest} />
          )
        ) : (
          <PlaceholderView title={view} user={user} onAction={openRequest} />
        )}
        <PublicFooter />
      </main>
      {showRequest && (
        <RequestModal
          step={step}
          setStep={setStep}
          close={() => {
            setShowRequest(false);
            setStep(1);
          }}
          submit={async ({ game, item, amount }) => {
            try {
              const response = await fetch("/api/requests", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ game, item, amount }),
              });
              const data = await response.json().catch(() => ({}));
              if (!response.ok) {
                setToast(data.error || "Request could not be submitted. Please try again.");
                return;
              }
              const created = data.request;
              setRequest({
                id: created.id,
                game: created.game,
                item: created.item,
                amount: created.amount,
                status: created.status,
                created: new Date(created.createdAt).toLocaleString(),
                middleman: created.middleman,
                buyer: created.buyer,
                seller: created.seller,
                messages: [],
              });
              setShowRequest(false);
              setStep(1);
              setToast(`Request submitted · ${created.id}`);
            } catch {
              setToast("The server could not be reached. Please try again.");
            }
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
            Manage your purchases, listings, and protected transactions from one place.
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
              <div className={`game-art ${tone}`} style={{ backgroundImage: `linear-gradient(180deg, #12203355, #080b10dd), url(${heroArtwork})` }}>
                <span>{short}</span>
                <em>↗</em>
              </div>
              <strong>{name}</strong>
              <small>{players}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="trust-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">BUILT FOR CLARITY</p>
            <h2>Why trade through GameGuard?</h2>
            <p className="section-copy">Tools designed to make digital gaming transactions easier to understand and manage.</p>
          </div>
        </div>
        <div className="trust-grid">
          {[
            ["🛡", "Protected transactions", "Transaction status and communication stay organized in one place."],
            ["✓", "Seller reputation", "Review seller ratings and transaction history before purchasing."],
            ["⚖", "Dispute support", "Issues can be reviewed through the platform's dispute process."],
            ["🔒", "Secure communication", "Keep important transaction communication inside the platform."],
          ].map(([icon, title, copy]) => (
            <article className="trust-card" key={title}>
              <span className="trust-icon">{icon}</span>
              <div><h3>{title}</h3><p>{copy}</p></div>
            </article>
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
    <section className="market-section active-transaction-section">
      <div className="section-title">
        <div>
          <p className="eyebrow">ACTIVE TRANSACTION</p>
          <h2>Current purchase</h2>
        </div>
        <button className="text-button" onClick={() => setView("My Purchases")}>
          View all →
        </button>
      </div>
      {request ? (
        <div className="buyer-card active-transaction-card">
          <div className="game-avatar red">VAL</div>
          <div className="buyer-info">
            <strong>{request.item}</strong>
            <small>Seller: {request.seller?.displayName || request.seller?.username || "Seller pending"}</small>
            <div className="transaction-meta-line"><span>Transaction</span><b>{request.id}</b></div>
          </div>
          <div className="transaction-status-panel">
            <span className="status-caption">CURRENT STATUS</span>
            <strong><i /> {request.status === "Open" ? "Waiting for middleman acceptance" : `${request.status} in progress`}</strong>
            <div className="transaction-progress">
              {["Payment", "Delivery", "Verification", "Completed"].map((stage, index) => <span className={index < 2 ? "done" : index === 2 ? "current" : ""} key={stage}><i>{index < 2 ? "✓" : index === 2 ? "●" : "○"}</i>{stage}</span>)}
            </div>
          </div>
          <div className="transaction-actions"><strong>{request.amount}</strong><button className="outline-button compact-button" onClick={() => setView("My Transactions")}>Open transaction</button></div>
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
        authenticated={Boolean(user)}
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
            authenticated={false}
          />
        ) : (
          <ReviewsView />
        )}
        <PublicFooter />
      </main>
    </div>
  );
}
function PublicFooter() {
  return <footer className="public-footer">
    <div className="footer-brand"><div className="footer-brand-name"><span className="brand-mark">G</span><strong>GAMEGUARD</strong></div><p>A marketplace built for safer digital gaming transactions.</p><span className="footer-status"><i /> Platform operational</span></div>
    <div><b>Platform</b><a href="/marketplace">Marketplace</a><a href="/how-it-works">How It Works</a><a href="/safety">Safety</a><a href="/support">Support</a></div>
    <div><b>Legal</b><a href="/terms">Terms of Service</a><a href="/privacy">Privacy Policy</a><a href="/refunds">Refund Policy</a><a href="/acceptable-use">Acceptable Use</a></div>
    <div className="footer-note"><span className="footer-kicker">GAMEGUARD / 2026</span><p>GameGuard is independent and is not affiliated with or endorsed by game publishers unless explicitly stated.</p></div>
    <div className="footer-bottom-links"><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/support">Support</a></div>
  </footer>;
}
type InformationContent = { eyebrow: string; title: string; subtitle: string; sections: { title: string; body?: string; items?: string[] }[] };
const informationContent: Record<string, InformationContent> = {
  "/safety": { eyebrow: "SAFETY GUIDE", title: "Trade With More Confidence", subtitle: "Practical guidance for clearer, more accountable gaming transactions.", sections: [
    { title: "Before Trading", items: ["Check seller reputation and available transaction history.", "Confirm the exact item, account details, and agreed price.", "Keep important communication inside the platform."] },
    { title: "During the Transaction", items: ["Follow the transaction status shown in the room.", "Do not send payment outside the agreed process.", "Do not share unnecessary personal information.", "Do not bypass the middleman process."] },
    { title: "After Delivery", items: ["Verify that the delivered item matches the agreement.", "Report problems promptly through the transaction process.", "Keep transaction records and relevant communication."] },
    { title: "Common Red Flags", items: ["Pressure to trade outside the platform", "Requests for unusual payment methods", "A seller refusing to use the transaction process", "Suspicious links", "Requests for unrelated account credentials", "Unrealistic offers"] },
  ] },
  "/support": { eyebrow: "SUPPORT CENTER", title: "How Can We Help?", subtitle: "Find practical guidance for using the GameGuard marketplace and transaction workspace.", sections: [
    { title: "Search help", body: "Use the topics below to find guidance for your transaction, marketplace activity, or account." },
    { title: "Frequently Asked Questions", items: ["How do I request a middleman? Open the request flow from your dashboard and provide the transaction details.", "How do I contact a middleman? Open a transaction room and use Contact middleman to start a private conversation.", "Where should I discuss a transaction? Keep transaction details and relevant evidence in the protected room."] },
    { title: "Transaction Help", body: "Review the transaction status, participants, and room messages. Contact the middleman from the room when coordination is needed." },
    { title: "Marketplace Help", body: "Review listing details carefully and use the marketplace controls to browse or create listings." },
    { title: "Account Help", body: "Use the account pages to sign in, recover access, and review your profile." },
    { title: "Middleman Help", body: "Middlemen can review assigned requests, update statuses, manage participants, and communicate in request rooms." },
    { title: "Payments & Refunds", body: "Review the Refund Policy for how transaction-related concerns are handled. GameGuard does not promise automatic refunds." },
  ] },
  "/terms": { eyebrow: "LEGAL", title: "Terms of Service", subtitle: "The terms that govern use of the GameGuard platform.", sections: ["Acceptance of Terms", "Eligibility", "Accounts", "Marketplace", "Transactions", "Middleman Services", "Fees", "Refunds", "Disputes", "Prohibited Activities", "Fraud and Abuse", "Account Suspension", "Third-Party Games", "Limitation of Liability", "Changes to Terms", "Contact"].map((title) => ({ title, body: `Use of GameGuard through ${title.toLowerCase()} is subject to applicable law, the platform's policies, and the information presented in the product. GameGuard does not guarantee that every transaction will succeed or that third-party game publishers permit account trading.` })) },
  "/privacy": { eyebrow: "LEGAL", title: "Privacy Policy", subtitle: "How GameGuard handles information created through the application.", sections: [
    { title: "Account information", body: "The application stores account details such as username, email address, password hash, role, avatar information, and account creation date." },
    { title: "Transaction information", body: "Middleman requests include transaction details, participants, statuses, timestamps, audit activity, and related messages." },
    { title: "Messages", body: "Messages sent in transaction rooms or private conversations are stored so authorized participants can access the relevant communication." },
    { title: "Marketplace activity", body: "The application may store listing information and marketplace actions needed to provide the marketplace experience." },
    { title: "Technical information", body: "The application uses session cookies to keep users signed in. Passwords are stored as hashes rather than plaintext passwords." },
  ] },
  "/refunds": { eyebrow: "LEGAL", title: "Refund Policy", subtitle: "How refund-related concerns are reviewed within the transaction process.", sections: [
    { title: "When a refund may be considered", body: "A refund may be considered when transaction circumstances, available records, and the parties' communications support review. Refunds are not automatic and not every transaction is refundable." },
    { title: "How to request a refund", body: "Keep the request and supporting details in the relevant transaction room, then contact the middleman so the issue can be reviewed through the platform process." },
    { title: "Transaction-related disputes", body: "Disputes are reviewed using the transaction status, participant messages, and other information available in the room." },
    { title: "Item not delivered", body: "Report non-delivery promptly and preserve the transaction record. The outcome depends on the facts available for review." },
    { title: "Item does not match the listing", body: "Report the mismatch promptly with clear details. Do not assume that a report guarantees a refund or reversal." },
  ] },
  "/acceptable-use": { eyebrow: "LEGAL", title: "Acceptable Use Policy", subtitle: "Standards for responsible use of the GameGuard marketplace and transaction tools.", sections: [{ title: "Prohibited activities", items: ["Fraud or scams", "Account theft or attempts to obtain credentials", "Chargeback abuse", "Harassment or impersonation", "Manipulation of transactions or records", "Attempts to bypass GameGuard's transaction process", "Illegal activity", "Abuse of the platform, its users, or its support tools"] }, { title: "Responsible participation", body: "Use accurate account information, communicate respectfully, follow transaction instructions, and keep relevant activity inside the appropriate platform tools." }] },
};
function InformationPage({ path }: { path: string }) {
  const content: InformationContent = path === "/how-it-works" ? { eyebrow: "PROCESS GUIDE", title: "How GameGuard Works", subtitle: "A simple step-by-step guide to completing a gaming transaction through a middleman.", sections: ["Create a Transaction", "Request a Middleman", "Middleman Joins", "Buyer Sends Payment", "Seller Delivers", "Buyer Verifies", "Transaction Completed"].map((title, index) => ({ title: `0${index + 1}  ${title}`, body: ["The buyer and seller agree on the item, price, and transaction details.", "The buyer or seller requests a GameGuard middleman for the transaction.", "An authorized middleman joins the transaction and confirms the participants and transaction details.", "The buyer follows the platform's available payment process.", "The seller provides the agreed item or account information through the transaction process.", "The buyer checks that the item matches the agreed transaction.", "Once the required parties confirm completion, the transaction is marked completed according to the platform's process."][index] })) } : informationContent[path];
  return <div className="info-page-shell"><header className="info-header"><a className="info-brand" href="/"><span className="brand-mark">G</span><strong>GAMEGUARD</strong></a><nav><a href="/marketplace">Marketplace</a><a href="/how-it-works">How It Works</a><a href="/safety">Safety</a><a href="/support">Support</a></nav><a className="info-signin" href="/login">Sign In</a></header><main className="info-page"><div className="info-breadcrumb"><a href="/">Home</a><span>/</span>{content.eyebrow}</div><p className="eyebrow">{content.eyebrow}</p><h1>{content.title}</h1><p className="info-subtitle">{content.subtitle}</p>{path === "/how-it-works" && <div className="info-callout"><strong>What the middleman does</strong><p>Helps coordinate the transaction, keeps communication organized, tracks status, helps participants follow the agreed process, and can assist with disputes according to the platform's capabilities.</p></div>}<div className="info-sections">{content.sections.map((section) => <section className="info-section" key={section.title}><h2>{section.title}</h2>{section.body && <p>{section.body}</p>}{section.items && <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}</section>)}</div>{path === "/how-it-works" && <div className="info-important"><strong>Important</strong><p>GameGuard does not guarantee that every transaction will be successful or that every game publisher permits account trading. Users are responsible for following the applicable game's Terms of Service and GameGuard's policies.</p><div><a className="primary-button" href="/marketplace">Browse Marketplace</a><a className="secondary-info-button" href="/login?next=/dashboard">Request a Middleman</a></div></div>}{path === "/support" && <div className="info-support-note"><strong>Still need help?</strong><p>For transaction-specific help, sign in and use the transaction room's messaging tools so the relevant context stays together.</p><a className="primary-button" href="/login?next=/dashboard">Open GameGuard</a></div>}</main><PublicFooter /></div>;
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
      const responseText = await response.text();
      let data: { error?: string; message?: string; user?: User } = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        return setError(`The server returned an invalid response (${response.status}).`);
      }
      if (!response.ok) return setError(data.error || `Request failed (${response.status}).`);
      if (isForgot) return setMessage(data.message || "Instructions sent.");
      if (!data.user) return setError("The server did not return an account.");
      setUser(data.user);
      const next = new URLSearchParams(window.location.search).get("next");
      const destination = isMiddleman
        ? "/middleman/dashboard"
        : next?.startsWith("/middleman")
          ? "/dashboard"
          : next || "/dashboard";
      window.location.assign(destination);
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
  onContactMiddleman,
}: {
  request: RequestRecord;
  draft: string;
  setDraft: (value: string) => void;
  setRequest: React.Dispatch<React.SetStateAction<RequestRecord | null>>;
  setToast: (value: string) => void;
  onContactMiddleman: () => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [attachment, setAttachment] = useState("");
  const [attachmentData, setAttachmentData] = useState<{ name: string; type: string; data: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [showNewMessages, setShowNewMessages] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);
  const waiting = request.status === "Open";
  const statusLabel = waiting ? "Awaiting acceptance" : request.status;
  const middleman = request.middleman;
  const seller = request.seller;
  const buyer = request.buyer;
  const messages = request.messages;
  useEffect(() => {
    const timer = window.setTimeout(() => setLoadingMessages(false), 450);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (loadingMessages || !messageListRef.current) return;
    const list = messageListRef.current;
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 48;
    if (!atBottom && messages.length > 1) setShowNewMessages(true);
  }, [messages.length, loadingMessages]);
  const scrollToBottom = () => {
    messageListRef.current?.scrollTo({ top: messageListRef.current.scrollHeight, behavior: "smooth" });
    setShowNewMessages(false);
    setShowScrollButton(false);
  };
  const selectAttachment = (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Attachments must be smaller than 5 MB.");
      return;
    }
    setAttachment(file.name);
    setAttachmentData(null);
    setUploadProgress(0);
    const reader = new FileReader();
    reader.onload = () => setAttachmentData({ name: file.name, type: file.type, data: String(reader.result || "") });
    reader.onerror = () => setErrorMessage("This attachment could not be read. Please try again.");
    reader.readAsDataURL(file);
    setUploadProgress(12);
    const timer = window.setInterval(() => {
      setUploadProgress((current) => {
        if (current >= 100) { window.clearInterval(timer); return 100; }
        return Math.min(current + 22, 100);
      });
    }, 120);
  };
  const attachmentReady = !attachment || (uploadProgress >= 100 && Boolean(attachmentData));
  const timeline = [
    ["Transaction Created", true],
    ["Payment Secured", !waiting],
    ["Seller Delivering", ["Verification", "In Progress", "Completed"].includes(request.status)],
    ["Buyer Verification", ["In Progress", "Completed"].includes(request.status)],
    ["Completed", request.status === "Completed"],
  ];
  const send = async () => {
    if ((!draft.trim() && !attachmentData) || sending || !attachmentReady) return;
    const body = draft.trim() || "Shared an attachment.";
    setSending(true);
    const response = await fetch(`/api/requests/${request.id}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body, attachment: attachmentData }),
    });
    setSending(false);
    if (!response.ok) { setSending(false); setErrorMessage("Your message could not be sent. Check your connection and try again."); return; }
    setRequest((current) =>
      current
        ? {
            ...current,
            messages: [
              ...current.messages,
              {
                id: Date.now(),
                authorId: "self",
                author: "You",
                role: "SELLER",
                body,
                time: new Date().toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                }),
                readBy: [],
                attachment: attachmentData,
              },
            ],
          }
        : current,
    );
    setDraft("");
    setAttachment("");
    setAttachmentData(null);
    setUploadProgress(0);
    setErrorMessage("");
  };
  const confirmAction = () => {
    if (!pendingAction) return;
    setToast(`${pendingAction} request sent to the transaction room`);
    setPendingAction("");
  };
  const participant = (name: string, role: string, avatar: string, image?: string) => (
    <div className="escrow-person" key={role}>
      <div className="escrow-avatar-wrap">
        <CustomerAvatar initials={avatar} image={image} className="avatar escrow-avatar" />
        <span className="presence-dot" />
      </div>
      <div><strong>{name}</strong><small>{role}</small></div>
      {role === "MIDDLEMAN" && <span className="verified-mark">✓</span>}
    </div>
  );
  return (
    <section className="transaction-view escrow-view">
      <div className="escrow-topline">
        <div><p className="eyebrow">SECURE TRANSACTION ROOM</p><h1>{request.id}</h1></div>
        <button className="drawer-trigger" onClick={() => setDrawerOpen(true)}>Transaction <span>→</span></button>
      </div>
      <div className="escrow-layout">
        <aside className="conversation-rail">
          <div className="rail-heading"><div><p className="eyebrow">CONVERSATIONS</p><strong>Transaction inbox</strong></div><span className="inbox-count">1</span></div>
          <label className="conversation-search"><span>⌕</span><input placeholder="Search conversations" /></label>
          <p className="rail-label">RECENT</p>
          <button className="conversation active">
            <div className="conversation-avatar"><CustomerAvatar initials={middleman?.avatar || "MM"} image="/avatars/mysticmm-customer.svg" className="avatar" /><span /></div>
            <div className="conversation-copy"><strong>{middleman?.displayName || "MysticMM"}</strong><small>{messages[messages.length - 1]?.body || "Transaction room created."}</small><em>{request.id}</em></div>
            <time>{messages[messages.length - 1]?.time || "Now"}</time><b>2</b>
          </button>
          <div className="rail-empty"><span>⌁</span><small>Protected conversations<br />appear here.</small></div>
        </aside>
        <main className="escrow-chat">
          <header className="escrow-chat-header">
            <div className="conversation-avatar"><CustomerAvatar initials={middleman?.avatar || "MM"} image="/avatars/mysticmm-customer.svg" className="avatar" /><span /></div>
            <div><h2>{middleman?.displayName || "MysticMM"} <i className="verified-mark">✓</i></h2><p><span className="presence-dot" /> Online · <b>{request.id}</b></p></div>
            <div className="header-actions"><span className="protected-badge">🛡 Protected Transaction</span><button onClick={() => setMenuOpen(!menuOpen)} aria-label="Conversation menu">•••</button>{menuOpen && <div className="chat-menu"><button onClick={() => setToast("Transaction link copied")}>Copy transaction link</button><button onClick={() => setToast("Conversation reported")}>Report conversation</button></div>}</div>
          </header>
          <div className="transaction-banner"><div className="shield-icon">🛡</div><div><span>PROTECTED TRANSACTION</span><strong>{request.id} · {request.game}</strong><small>{request.item}</small></div><strong className="banner-amount">{request.amount}</strong><button onClick={() => setDrawerOpen(true)}>View transaction</button></div>
          <div className="message-list escrow-messages" ref={messageListRef} onScroll={(event) => { const list = event.currentTarget; const away = list.scrollHeight - list.scrollTop - list.clientHeight > 48; setShowScrollButton(away); if (!away) setShowNewMessages(false); }}>
            {loadingMessages ? <div className="message-skeleton" aria-label="Loading messages"><span /><span /><span /><span /><span /></div> : messages.length === 0 ? <div className="empty-conversation"><div>🛡</div><strong>Your protected room is ready</strong><p>Start the conversation with the transaction participants.</p></div> : <><div className="unread-divider"><span>UNREAD MESSAGES</span></div>{messages.map((message, index) => {
              const previous = messages[index - 1];
              const grouped = Boolean(previous && !previous.system && previous.author === message.author && previous.role === message.role);
              if (message.system) return <div className="event-message" key={message.id}><span className="event-rule" /><div><strong>{message.body.includes("status changed") ? "Transaction update" : "Transaction created"}</strong><p>{message.body}</p></div><span className="event-rule" /></div>;
              const official = message.role === "MIDDLEMAN";
              return <div className={`escrow-message ${official ? "official" : message.author === "You" ? "from-me" : "from-them"} ${grouped ? "grouped" : ""}`} key={message.id}>{!grouped && <CustomerAvatar initials={official ? "MM" : message.author.slice(0, 2).toUpperCase()} image={official ? "/avatars/mysticmm-customer.svg" : undefined} className="avatar tiny purple" />}<div className="bubble-stack">{!grouped && <div className="message-meta"><strong>{official && "🛡 "}{message.author}</strong>{official && <span className="middleman-label">MIDDLEMAN</span>}<time>{message.time}</time></div>}<div className="escrow-bubble"><p>{message.body}</p>{message.attachment && <a className="message-attachment" href={message.attachment.data} download={message.attachment.name}>{message.attachment.type.startsWith("image/") && <img src={message.attachment.data} alt={message.attachment.name} />}<span>📎 {message.attachment.name}</span></a>}<div className="bubble-tools"><button onClick={() => navigator.clipboard?.writeText(message.body)}>Copy</button><button onClick={() => setDraft(`Replying to ${message.author}: `)}>Reply</button>{message.author === "You" && <button onClick={() => setToast("Your message can no longer be deleted")}>Delete</button>}</div></div>{message.author === "You" && <small className="read-state">{message.readBy?.some((id) => id !== message.authorId) ? "Seen ✓✓" : "Sent ✓"}</small>}</div></div>;
            })}</>}
            {showNewMessages && <button className="new-message-indicator" onClick={scrollToBottom}>New messages <span>↓</span></button>}
            {showScrollButton && <button className="scroll-bottom-button" onClick={scrollToBottom} aria-label="Scroll to latest messages">↓</button>}
          </div>
          {errorMessage && <div className="chat-error"><span>!</span>{errorMessage}<button onClick={() => setErrorMessage("")}>Dismiss</button></div>}
          <div className="escrow-composer" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectAttachment(event.dataTransfer.files[0]); }}>
            <div className="composer-row"><label className="attach-button" title="Attach file">📎<input type="file" accept="image/*,.pdf,.txt,.zip" onChange={(event) => selectAttachment(event.target.files?.[0])} /></label><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Message the transaction participants..." rows={1} /><button className="emoji-button" onClick={() => setEmojiOpen(!emojiOpen)}>😊</button><button className="send" onClick={send} disabled={sending || !attachmentReady}>{sending ? "..." : "➤"}</button></div>{emojiOpen && <div className="emoji-popover"><button onClick={() => { setDraft(`${draft} 👍`); setEmojiOpen(false) }}>👍</button><button onClick={() => { setDraft(`${draft} ✅`); setEmojiOpen(false) }}>✅</button><button onClick={() => { setDraft(`${draft} 🎮`); setEmojiOpen(false) }}>🎮</button></div>}{attachment && <div className="attachment-chip">📎 {attachment}<span className="upload-track"><i style={{ width: `${uploadProgress}%` }} /></span><small>{uploadProgress < 100 || !attachmentData ? `Preparing ${uploadProgress}%` : "Ready to attach"}</small><button onClick={() => { setAttachment(""); setAttachmentData(null); setUploadProgress(0); }}>×</button></div>}<div className="security-line">🔒 <span><strong>Keep your transaction communication here.</strong> Never share passwords, recovery codes, payment credentials, or other sensitive information.</span></div></div>
        </main>
        <aside className={`transaction-drawer ${drawerOpen ? "open" : ""}`}>
          <div className="drawer-head"><div><p className="eyebrow">TRANSACTION</p><h2>{request.id}</h2></div><button onClick={() => setDrawerOpen(false)}>×</button></div>
          <div className="transaction-item"><div className="game-avatar red">VAL</div><div><span>ITEM</span><strong>{request.item}</strong><small>{request.game}</small></div></div>
          <div className="amount-row"><span>Amount</span><strong>{request.amount}</strong></div><div className="status-card"><span>Current status</span><strong><i /> {statusLabel}</strong></div>
          <div className="people-block"><p className="eyebrow">PARTICIPANTS</p>{buyer && participant(buyer.displayName || buyer.username, "BUYER · VERIFIED", buyer.avatar || "BU")} {seller && participant(seller.displayName || seller.username, "SELLER · VERIFIED", seller.avatar || "SE")} {participant(middleman?.displayName || "MysticMM", "MIDDLEMAN · AUTHORIZED", middleman?.avatar || "MM", "/avatars/mysticmm-customer.svg")}</div>
          <div className="timeline"><p className="eyebrow">TRANSACTION TIMELINE</p>{timeline.map(([label, done], index) => <div className={`${done ? "done" : index === timeline.findIndex((item) => !item[1]) ? "current" : ""}`} key={String(label)}><span>{done ? "✓" : index === timeline.findIndex((item) => !item[1]) ? "●" : "○"}</span><strong>{label}</strong></div>)}</div>
          <div className="action-stack"><button onClick={onContactMiddleman}>Contact middleman</button></div>
        </aside>
      </div>
      {pendingAction && <div className="modal-backdrop action-confirm"><div className="request-modal"><button className="close-button" onClick={() => setPendingAction("")}>×</button><div className="confirm-content"><div className="confirm-icon">🛡</div><h2>{pendingAction}?</h2><p>This action will be recorded in the protected transaction timeline.</p><button className="primary-button" onClick={confirmAction}>Confirm action</button><button className="text-button" onClick={() => setPendingAction("")}>Cancel</button></div></div></div>}
    </section>
  );
}

function DirectMessages({
  conversation,
  user,
  setConversation,
  setToast,
}: {
  conversation: PrivateConversation;
  user: User;
  setConversation: (conversation: PrivateConversation) => void;
  setToast: (message: string) => void;
}) {
  const [draft, setDraft] = useState("");
  useEffect(() => {
    const refresh = () => fetch(`/api/conversations/${conversation.id}`).then((response) => response.ok ? response.json() : null).then((data) => data?.conversation && setConversation(data.conversation)).catch(() => undefined);
    refresh();
  }, [conversation.id]);
  const send = async () => {
    if (!draft.trim()) return;
    const body = draft.trim();
    let activeConversation = conversation;
    let response = await fetch(`/api/conversations/${conversation.id}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) });
    if (!response.ok && conversation.middleman?.id) {
      const recreated = await fetch("/api/conversations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ middlemanId: conversation.middleman.id }) });
      if (recreated.ok) {
        const recreatedData = await recreated.json();
        activeConversation = recreatedData.conversation;
        setConversation(activeConversation);
        response = await fetch(`/api/conversations/${activeConversation.id}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) });
      }
    }
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      return setToast(error?.error || "Message could not be sent");
    }
    const data = await response.json();
    setConversation({ ...activeConversation, messages: [...activeConversation.messages, { id: Date.now(), authorId: user.id, author: "You", role: user.role, body: data.message.body, time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), readBy: [user.id] }] });
    setDraft("");
  };
  return <section className="transaction-view escrow-view"><div className="escrow-topline"><div><p className="eyebrow">PRIVATE MIDDLEMAN MESSAGES</p><h1>{conversation.middleman?.displayName || "Middleman"}</h1></div></div><div className="escrow-layout direct-message-layout"><aside className="conversation-rail"><div className="rail-heading"><div><p className="eyebrow">CONVERSATIONS</p><strong>Private messages</strong></div></div><button className="conversation active"><div className="conversation-avatar"><CustomerAvatar initials={conversation.middleman?.avatar || "MM"} image="/avatars/mysticmm-customer.svg" className="avatar" /><span /></div><div className="conversation-copy"><strong>{conversation.middleman?.displayName || "Middleman"}</strong><small>Private transaction support</small><em>{conversation.id}</em></div></button></aside><main className="escrow-chat"><header className="escrow-chat-header"><div className="conversation-avatar"><CustomerAvatar initials={conversation.middleman?.avatar || "MM"} image="/avatars/mysticmm-customer.svg" className="avatar" /><span /></div><div><h2>{conversation.middleman?.displayName || "Middleman"} <i className="verified-mark">✓</i></h2><p><span className="presence-dot" /> Private conversation</p></div><span className="protected-badge">🔒 Private</span></header><div className="message-list escrow-messages">{conversation.messages.length ? conversation.messages.map((message) => <div className={`escrow-message ${message.authorId === user.id ? "from-me" : "from-them"}`} key={message.id}><CustomerAvatar initials={message.authorId === user.id ? user.avatar : conversation.middleman?.avatar || "MM"} image={message.authorId === user.id ? undefined : "/avatars/mysticmm-customer.svg"} className="avatar tiny purple" /><div className="bubble-stack"><div className="message-meta"><strong>{message.authorId === user.id ? "You" : conversation.middleman?.displayName || "Middleman"}</strong><time>{message.time}</time></div><div className="escrow-bubble"><p>{message.body}</p></div><small className="read-state">{message.authorId === user.id ? "Sent ✓" : ""}</small></div></div>) : <div className="empty-conversation"><div>🔒</div><strong>Private conversation ready</strong><p>Contact your authorized middleman here.</p></div>}</div><div className="escrow-composer"><div className="composer-row"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Message your middleman..." rows={1} /><button className="send" onClick={send}>➤</button></div><div className="security-line">🔒 Keep transaction communication in GameGuard.</div></div></main><aside className="transaction-drawer open"><div className="drawer-head"><div><p className="eyebrow">PRIVATE CHAT</p><h2>{conversation.id}</h2></div></div><div className="people-block"><p className="eyebrow">PARTICIPANTS</p><div className="escrow-person"><CustomerAvatar initials={user.avatar} className="avatar escrow-avatar" /><div><strong>{user.displayName || user.username}</strong><small>CUSTOMER</small></div></div><div className="escrow-person"><CustomerAvatar initials={conversation.middleman?.avatar || "MM"} image="/avatars/mysticmm-customer.svg" className="avatar escrow-avatar" /><div><strong>{conversation.middleman?.displayName || "Middleman"}</strong><small>AUTHORIZED MIDDLEMAN</small></div></div></div></aside></div></section>;
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
  submit: (details: { game: string; item: string; amount: string }) => void | Promise<void>;
}) {
  const [game, setGame] = useState("Valorant");
  const [item, setItem] = useState("Radiant Valorant Account");
  const [amount, setAmount] = useState("240.00");
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
              <select value={game} onChange={(event) => setGame(event.target.value)}>
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
              <input value={item} onChange={(event) => setItem(event.target.value)} />
            </label>
            <div className="form-row">
              <label>
                Amount
                <input value={amount} onChange={(event) => setAmount(event.target.value)} />
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
            <button className="primary-button" onClick={() => submit({ game, item, amount })}>
              Submit request →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
