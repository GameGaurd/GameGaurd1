import { useEffect, useState } from "react";
import "./Middleman.css";

type User = {
  id?: string;
  username: string;
  displayName?: string;
  email: string;
  avatar: string;
  avatarUrl?: string;
  verifiedMiddleman?: boolean;
  createdAt: string;
  role: string;
};
type Stats = {
  pendingRequests: number;
  activeTransactions: number;
  completedTransactions: number;
  openDisputes: number;
};
type Message = {
  id: string;
  body: string;
  system?: boolean;
  createdAt: string;
  authorId: string;
  authorName?: string;
  authorRole?: string;
};
type RequestRecord = {
  id: string;
  game: string;
  item: string;
  amount: string;
  status: string;
  createdAt: string;
  buyer: User | null;
  seller: User | null;
  messages: Message[];
};
const items = [
  "Overview",
  "Requests",
  "Active Transactions",
  "Completed",
  "Disputes",
  "Messages",
  "Customers",
  "Audit Logs",
  "Settings",
];
const icons = ["▦", "⊙", "↔", "✓", "!", "□", "◎", "≡", "⚙"];
const statuses = ["Verification", "In Progress", "Completed", "Disputed"];
const formatDate = (value: string) =>
  new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
function Avatar({
  user,
  className = "avatar purple",
}: {
  user: User | null;
  className?: string;
}) {
  const [imageLoaded, setImageLoaded] = useState(true);
    return (
      <div className={className}>
        <img
          src={user?.avatarUrl || "/avatars/mysticmm.svg"}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "50%",
          }}
          onError={(event) => {
            setImageLoaded(false);
            event.currentTarget.style.display = "none";
          }}
          onLoad={() => setImageLoaded(true)}
        />
        {!imageLoaded && (user?.avatar || "MM")}
      </div>
    );
}

export function MiddlemanDashboard({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
}) {
  const [section, setSection] = useState("Overview");
  const [stats, setStats] = useState<Stats>({
    pendingRequests: 0,
    activeTransactions: 0,
    completedTransactions: 0,
    openDisputes: 0,
  });
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [selected, setSelected] = useState<RequestRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    try {
      const [summary, queue] = await Promise.all([
        fetch("/api/middleman/me"),
        fetch("/api/middleman/requests"),
      ]);
      if (!summary.ok || !queue.ok)
        throw new Error("Unable to load the middleman workspace.");
      const summaryData = await summary.json();
      const queueData = await queue.json();
      setStats(summaryData.stats);
      setRequests(queueData.requests);
      setSelected((current) =>
        current
          ? queueData.requests.find(
              (item: RequestRecord) => item.id === current.id,
            ) || null
          : null,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load the middleman workspace.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (section !== "Transaction" || !selected) return;
    const timer = window.setInterval(() => refreshRequest(selected.id), 3000);
    return () => window.clearInterval(timer);
  }, [section, selected?.id]);
  const refreshRequest = async (requestId?: string) => {
    if (!requestId) return;
    const response = await fetch(`/api/middleman/requests/${requestId}`);
    if (!response.ok) return;
    const data = await response.json();
    setSelected(data.request);
  };
  const updateStatus = async (request: RequestRecord, status: string) => {
    const response = await fetch(`/api/middleman/requests/${request.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) return setError("That transaction could not be updated.");
    await refreshRequest(request.id);
    await load();
  };
  const openRequest = (request: RequestRecord) => {
    setSelected(request);
    setSection("Transaction");
  };
  const visibleRequests =
    section === "Requests"
      ? requests
      : section === "Active Transactions"
        ? requests.filter((item) =>
            ["Accepted", "Verification", "In Progress"].includes(item.status),
          )
        : section === "Completed"
          ? requests.filter((item) => item.status === "Completed")
          : section === "Disputes"
            ? requests.filter((item) => item.status === "Disputed")
            : requests;
  return (
    <div className="middleman-dashboard">
      <aside className="mm-sidebar">
        <div className="brand">
          <span className="brand-mark">G</span>
          <span>
            GAME<span>GUARD</span>
          </span>
        </div>
        <p className="mm-label">MIDDLEMAN WORKSPACE</p>
        <nav>
          {items.map((item, index) => (
            <button
              className={section === item ? "mm-nav active" : "mm-nav"}
              onClick={() => setSection(item)}
              key={item}
            >
              <span>{icons[index]}</span>
              {item}
              {item === "Requests" &&
                requests.some((request) => request.status === "Open") && (
                  <b>
                    {
                      requests.filter((request) => request.status === "Open")
                        .length
                    }
                  </b>
                )}
            </button>
          ))}
          <button className="mm-nav" onClick={onLogout}>
            <span>↪</span>Logout
          </button>
        </nav>
        <div className="mm-user">
          <Avatar user={user} />
          <strong>{user.displayName || "MysticMM"}</strong>
          <small>Middleman account</small>
        </div>
      </aside>
      <main className="mm-main">
        <header className="mm-topbar">
          <div>
            <p className="eyebrow">MIDDLEMAN PORTAL</p>
            <h1>{section === "Transaction" ? selected?.id : section}</h1>
          </div>
          <button
            className="mm-profile-button"
            onClick={() => setSection("Profile")}
          >
            <Avatar user={user} />
            <div>
              <strong>{user.displayName || "MysticMM"}</strong>
              <small>Middleman account</small>
            </div>
          </button>
        </header>
        {error && <div className="mm-error">{error}</div>}
        {loading ? (
          <div className="mm-empty panel">
            <span>⌁</span>
            <strong>Loading workspace...</strong>
          </div>
        ) : section === "Overview" ? (
          <Overview
            stats={stats}
            requests={requests}
            onOpen={() => setSection("Requests")}
            onSelect={openRequest}
          />
        ) : section === "Transaction" && selected ? (
          <Transaction
            request={selected}
            user={user}
            onBack={() => setSection("Requests")}
            onStatus={updateStatus}
            onRefresh={refreshRequest}
          />
        ) : section === "Profile" ? (
          <MiddlemanProfile user={user} />
        ) : section === "Audit Logs" ? (
          <AuditLogs />
        ) : section === "Settings" ? (
          <Settings />
        ) : (
          <RequestTable
            requests={visibleRequests}
            onOpen={openRequest}
            onStatus={updateStatus}
            title={section}
          />
        )}
      </main>
    </div>
  );
}

function Overview({
  stats,
  requests,
  onOpen,
  onSelect,
}: {
  stats: Stats;
  requests: RequestRecord[];
  onOpen: () => void;
  onSelect: (request: RequestRecord) => void;
}) {
  return (
    <>
      <div className="mm-welcome">
        <p>Securely coordinate customer transactions from one workspace.</p>
        <span className="mm-role">ROLE · MIDDLEMAN</span>
      </div>
      <div className="mm-stats">
        {[
          ["Pending requests", stats.pendingRequests, "Awaiting action"],
          ["Active transactions", stats.activeTransactions, "In progress"],
          ["Completed transactions", stats.completedTransactions, "All time"],
          ["Open disputes", stats.openDisputes, "Need attention"],
        ].map(([label, value, description]) => (
          <div className="mm-stat panel" key={String(label)}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{description}</small>
          </div>
        ))}
      </div>
      <div className="mm-panel panel">
        <div className="mm-panel-head">
          <div>
            <p className="eyebrow">QUEUE</p>
            <h2>Request management</h2>
          </div>
          <button className="primary-button" onClick={onOpen}>
            View requests →
          </button>
        </div>
        {requests.length ? (
          <RequestRows requests={requests.slice(0, 5)} onOpen={onSelect} />
        ) : (
          <div className="mm-empty">
            <span>⊙</span>
            <strong>No requests assigned yet</strong>
            <small>New customer middleman requests will appear here.</small>
          </div>
        )}
      </div>
    </>
  );
}
function RequestRows({
  requests,
  onOpen,
}: {
  requests: RequestRecord[];
  onOpen: (request: RequestRecord) => void;
}) {
  return (
    <div className="mm-request-list">
      {requests.map((request) => (
        <button
          className="mm-request-row"
          key={request.id}
          onClick={() => onOpen(request)}
        >
          <strong>{request.id}</strong>
          <span>
            {request.game}
            <small>{request.item}</small>
          </span>
          <b>{request.amount}</b>
          <em
            className={`mm-status ${request.status.toLowerCase().replaceAll(" ", "-")}`}
          >
            {request.status}
          </em>
          <span>Open →</span>
        </button>
      ))}
    </div>
  );
}
function RequestTable({
  requests,
  onOpen,
  onStatus,
  title,
}: {
  requests: RequestRecord[];
  onOpen: (request: RequestRecord) => void;
  onStatus: (request: RequestRecord, status: string) => void;
  title: string;
}) {
  return (
    <div className="mm-panel panel">
      <div className="mm-panel-head">
        <div>
          <p className="eyebrow">ASSIGNED TO YOU</p>
          <h2>{title}</h2>
        </div>
        <span className="mm-count">{requests.length} records</span>
      </div>
      {requests.length ? (
        <>
          <div className="mm-table-head">
            <span>Request ID</span>
            <span>Game / item</span>
            <span>Amount</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          <div className="mm-request-list">
            {requests.map((request) => (
              <div className="mm-request-row table-row" key={request.id}>
                <button onClick={() => onOpen(request)}>
                  <strong>{request.id}</strong>
                </button>
                <span>
                  {request.game}
                  <small>{request.item}</small>
                </span>
                <b>{request.amount}</b>
                <em
                  className={`mm-status ${request.status.toLowerCase().replaceAll(" ", "-")}`}
                >
                  {request.status}
                </em>
                <span className="mm-actions">
                  <button onClick={() => onOpen(request)}>Open</button>
                  {request.status === "Open" && (
                    <>
                      <button onClick={() => onStatus(request, "Accepted")}>
                        Accept
                      </button>
                      <button
                        className="danger"
                        onClick={() => onStatus(request, "Declined")}
                      >
                        Decline
                      </button>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mm-empty">
          <span>⌁</span>
          <strong>This queue is clear</strong>
          <small>Assigned requests will appear here.</small>
        </div>
      )}
    </div>
  );
}
function Transaction({
  request,
  user,
  onBack,
  onStatus,
  onRefresh,
}: {
  request: RequestRecord;
  user: User;
  onBack: () => void;
  onStatus: (request: RequestRecord, status: string) => void;
  onRefresh: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [participantUsername, setParticipantUsername] = useState("");
  const [participantRole, setParticipantRole] = useState<"buyer" | "seller">(
    "buyer",
  );
  const [participantError, setParticipantError] = useState("");
  const send = async () => {
    if (!draft.trim()) return;
    await fetch(`/api/middleman/requests/${request.id}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: draft }),
    });
    setDraft("");
    onRefresh();
  };
  const addParticipant = async () => {
    setParticipantError("");
    const response = await fetch(
      `/api/middleman/requests/${request.id}/participants`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: participantUsername,
          role: participantRole,
        }),
      },
    );
    const data = await response.json();
    if (!response.ok)
      return setParticipantError(
        data.error || "Participant could not be added.",
      );
    setParticipantUsername("");
    onRefresh();
  };
  return (
    <section className="mm-transaction">
      <button className="mm-back" onClick={onBack}>
        ← Back to requests
      </button>
      <div className="mm-transaction-grid">
        <div className="mm-panel panel">
          <p className="eyebrow">TRANSACTION DETAILS</p>
          <h2>{request.id}</h2>
          <div className="mm-detail">
            <span>Game</span>
            <strong>{request.game}</strong>
            <span>Item</span>
            <strong>{request.item}</strong>
            <span>Amount</span>
            <strong>{request.amount}</strong>
            <span>Created</span>
            <strong>{formatDate(request.createdAt)}</strong>
            <span>Status</span>
            <strong>{request.status}</strong>
          </div>
          <div className="mm-controls">
            {statuses.map((status) => (
              <button
                className={request.status === status ? "selected" : ""}
                key={status}
                onClick={() => onStatus(request, status)}
              >
                {status}
              </button>
            ))}
            <button
              className="danger"
              onClick={() => onStatus(request, "Disputed")}
            >
              Open dispute
            </button>
          </div>
        </div>
        <div className="mm-panel panel mm-chat">
          <div className="mm-panel-head">
            <div>
              <p className="eyebrow">REAL-TIME CHAT</p>
              <h2>Transaction room</h2>
            </div>
            <span className="mm-live">● Live</span>
          </div>
          <div className="mm-messages">
            {request.messages.map((message) => (
              <div
                className={message.system ? "mm-message system" : "mm-message"}
                key={message.id}
              >
                {!message.system && <Avatar user={message.authorId === user.id ? user : request.buyer?.id === message.authorId ? request.buyer : request.seller || user} className="avatar tiny purple" />}
                <strong>
                  {message.system
                    ? "SYSTEM"
                    : message.authorId === user.id
                      ? "YOU"
                      : `${message.authorName || "PARTICIPANT"} · ${message.authorRole || "PARTICIPANT"}`}
                </strong>
                <p>{message.body}</p>
                <small>{formatDate(message.createdAt)}</small>
              </div>
            ))}
          </div>
          <div className="mm-composer">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && send()}
              placeholder="Message participants..."
            />
            <button onClick={send}>Send</button>
          </div>
        </div>
        <div className="mm-panel panel">
          <p className="eyebrow">PARTICIPANTS</p>
          <h2>Transaction team</h2>
          <div className="mm-add-participant">
            <select
              value={participantRole}
              onChange={(event) =>
                setParticipantRole(event.target.value as "buyer" | "seller")
              }
            >
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
            </select>
            <input
              value={participantUsername}
              onChange={(event) => setParticipantUsername(event.target.value)}
              placeholder="Username"
            />
            <button onClick={addParticipant}>Add</button>
            {participantError && <small>{participantError}</small>}
          </div>
          <div className="mm-participant">
            <div className="avatar purple">{user.avatar}</div>
            <span>
              <strong>{user.username}</strong>
              <small>MIDDLEMAN</small>
            </span>
          </div>
          <div className="mm-participant">
            <div className="avatar blue">{request.buyer?.avatar || "?"}</div>
            <span>
              <strong>{request.buyer?.username || "Not added"}</strong>
              <small>BUYER</small>
            </span>
          </div>
          <div className="mm-participant">
            <div className="avatar purple">{request.seller?.avatar || "?"}</div>
            <span>
              <strong>{request.seller?.username || "Not added"}</strong>
              <small>SELLER</small>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
function AuditLogs() {
  const [logs, setLogs] = useState<
    { id: string; action: string; detail: string; createdAt: string }[]
  >([]);
  useEffect(() => {
    fetch("/api/middleman/audit-logs")
      .then((response) => response.json())
      .then((data) => setLogs(data.logs || []));
  }, []);
  return (
    <div className="mm-panel panel">
      <p className="eyebrow">COMPLIANCE</p>
      <h2>Audit Logs</h2>
      <div className="mm-log-list">
        {logs.map((log) => (
          <div key={log.id}>
            <strong>{log.action.replaceAll("_", " ")}</strong>
            <span>{log.detail}</span>
            <small>{formatDate(log.createdAt)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
function Settings() {
  return (
    <div className="mm-panel panel">
      <p className="eyebrow">WORKSPACE</p>
      <h2>Settings</h2>
      <div className="mm-setting">
        <strong>Notifications</strong>
        <span>New request and message alerts are enabled.</span>
      </div>
      <div className="mm-setting">
        <strong>Role permissions</strong>
        <span>Only administrators can change middleman access.</span>
      </div>
    </div>
  );
}
export function MiddlemanProfile({ user }: { user: User }) {
  const [details, setDetails] = useState({
    completedCount: 0,
    averageRating: "Not rated yet",
  });
  useEffect(() => {
    fetch("/api/middleman/me")
      .then((response) => response.json())
      .then((data) => setDetails(data));
  }, []);
  const name = user.displayName || "MysticMM";
  return (
    <div className="mm-panel panel mm-profile-page">
      <p className="eyebrow">MIDDLEMAN ACCOUNT</p>
      <h1>Profile</h1>
      <div className="mm-profile-hero">
        <Avatar user={user} className="profile-avatar purple" />
        <div>
          <h2>{name}</h2>
          <p>{user.email}</p>
        </div>
        <span className="mm-role">ROLE · MIDDLEMAN</span>
      </div>
      <div className="mm-profile-details">
        <span>Name</span>
        <strong>{name}</strong>
        <span>Username</span>
        <strong>{name}</strong>
        <span>Email</span>
        <strong>{user.email}</strong>
        <span>Role</span>
        <strong>Middleman</strong>
        <span>Account status</span>
        <strong>Active</strong>
        <span>Completed transactions</span>
        <strong>{details.completedCount}</strong>
        <span>Average rating</span>
        <strong>{details.averageRating}</strong>
        <span>Member since</span>
        <strong>{new Date(user.createdAt).toLocaleDateString()}</strong>
      </div>
    </div>
  );
}
