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
  attachment?: { name: string; type: string; data: string } | null;
  readBy?: string[];
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
type PrivateConversation = {
  id: string;
  customer: User | null;
  middleman: User | null;
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
  const [privateConversations, setPrivateConversations] = useState<PrivateConversation[]>([]);
  const [privateSelected, setPrivateSelected] = useState<PrivateConversation | null>(null);
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
    if (section !== "Messages") return;
    fetch("/api/middleman/conversations").then((response) => response.ok ? response.json() : { conversations: [] }).then((data) => setPrivateConversations(data.conversations || [])).catch(() => setPrivateConversations([]));
  }, [section]);
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
        ) : section === "Messages" ? (
          <PrivateMessages conversations={privateConversations} selected={privateSelected} onSelect={setPrivateSelected} onRefresh={() => setSection("Messages")} user={user} />
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
/*
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; type: string; data: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const send = async () => {
    if ((!draft.trim() && !attachment) || uploading) return;
    const response = await fetch(`/api/middleman/requests/${request.id}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: draft.trim() || "Shared an attachment.", attachment }),
    });
    if (!response.ok) return;
    setDraft("");
    <section className="transaction-view escrow-view mm-escrow-view">
      <div className="escrow-topline"><div><button className="mm-back" onClick={onBack}>← Back to requests</button><p className="eyebrow">SECURE TRANSACTION ROOM</p><h1>{request.id}</h1></div><button className="drawer-trigger" onClick={() => setDrawerOpen(true)}>Transaction <span>→</span></button></div>
      <div className="escrow-layout">
        <aside className="conversation-rail"><div className="rail-heading"><div><p className="eyebrow">CONVERSATIONS</p><strong>Transaction inbox</strong></div><span className="inbox-count">1</span></div><label className="conversation-search"><span>⌕</span><input placeholder="Search conversations" /></label><p className="rail-label">RECENT</p><button className="conversation active"><div className="conversation-avatar"><Avatar user={user} className="avatar" /><span /></div><div className="conversation-copy"><strong>Transaction team</strong><small>{request.messages[request.messages.length - 1]?.body || "Transaction room created."}</small><em>{request.id}</em></div><time>Live</time></button></aside>
        <main className="escrow-chat"><header className="escrow-chat-header"><div className="conversation-avatar"><Avatar user={user} className="avatar" /><span /></div><div><h2>Transaction team <i className="verified-mark">✓</i></h2><p><span className="presence-dot" /> Live · <b>{request.id}</b></p></div><span className="protected-badge">🛡 Protected Transaction</span></header><div className="transaction-banner"><div className="shield-icon">🛡</div><div><span>PROTECTED TRANSACTION</span><strong>{request.id} · {request.game}</strong><small>{request.item}</small></div><strong className="banner-amount">{request.amount}</strong><button onClick={() => setDrawerOpen(true)}>View transaction</button></div><div className="message-list escrow-messages">{request.messages.map((message) => message.system ? <div className="event-message" key={message.id}><span className="event-rule" /><div><strong>Transaction update</strong><p>{message.body}</p></div><span className="event-rule" /></div> : <div className={`escrow-message ${message.authorId === user.id ? "from-me" : message.authorRole === "MIDDLEMAN" ? "official" : "from-them"}`} key={message.id}><Avatar user={message.authorId === user.id ? user : request.buyer?.id === message.authorId ? request.buyer : request.seller || user} className="avatar tiny purple" /><div className="bubble-stack"><div className="message-meta"><strong>{message.authorId === user.id ? "You" : message.authorName || "Participant"}</strong>{message.authorRole === "MIDDLEMAN" && <span className="middleman-label">MIDDLEMAN</span>}<time>{formatDate(message.createdAt)}</time></div><div className="escrow-bubble"><p>{message.body}</p>{message.attachment && <a className="message-attachment" href={message.attachment.data} download={message.attachment.name}>{message.attachment.type.startsWith("image/") && <img src={message.attachment.data} alt={message.attachment.name} />}<span>📎 {message.attachment.name}</span></a>}</div>{message.authorId === user.id && <small className="read-state">{message.readBy?.some((id) => id !== message.authorId) ? "Seen ✓✓" : "Sent ✓"}</small>}</div></div>)}<div className="typing-indicator"><span /><span /><span /> Customer is typing</div></div><div className="mm-composer escrow-composer"><div className="composer-row"><label className="attach-button" title="Attach file">📎<input type="file" accept="image/*,.pdf,.txt,.zip" onChange={(event) => selectAttachment(event.target.files?.[0])} /></label><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Message the transaction participants..." rows={1} /><button className="emoji-button">😊</button><button className="send" onClick={send} disabled={uploading}>{uploading ? "..." : "➤"}</button></div>{attachment && <div className="attachment-chip">📎 {attachment.name}<button onClick={() => setAttachment(null)}>×</button></div>}<div className="security-line">🔒 <span><strong>Keep your transaction communication here.</strong> Never share passwords, recovery codes, payment credentials, or other sensitive information.</span></div></div></main>
        <aside className={`transaction-drawer ${drawerOpen ? "open" : ""}`}><div className="drawer-head"><div><p className="eyebrow">TRANSACTION</p><h2>{request.id}</h2></div><button onClick={() => setDrawerOpen(false)}>×</button></div><div className="transaction-item"><div className="game-avatar red">VAL</div><div><span>ITEM</span><strong>{request.item}</strong><small>{request.game}</small></div></div><div className="amount-row"><span>Amount</span><strong>{request.amount}</strong></div><div className="status-card"><span>Current status</span><strong><i /> {request.status}</strong></div><div className="people-block"><p className="eyebrow">PARTICIPANTS</p><div className="escrow-person"><Avatar user={user} className="avatar escrow-avatar" /><div><strong>{user.displayName || user.username}</strong><small>MIDDLEMAN · AUTHORIZED</small></div><span className="verified-mark">✓</span></div><div className="escrow-person"><Avatar user={request.buyer} className="avatar escrow-avatar" /><div><strong>{request.buyer?.username || "Buyer not assigned"}</strong><small>BUYER · VERIFIED</small></div></div><div className="escrow-person"><Avatar user={request.seller} className="avatar escrow-avatar" /><div><strong>{request.seller?.username || "Seller not assigned"}</strong><small>SELLER · VERIFIED</small></div></div></div><div className="timeline"><p className="eyebrow">TRANSACTION TIMELINE</p>{["Transaction Created", "Payment Secured", "Seller Delivering", "Buyer Verification", "Completed"].map((label, index) => <div className={index < 2 ? "done" : index === 2 ? "current" : ""} key={label}><span>{index < 2 ? "✓" : index === 2 ? "●" : "○"}</span><strong>{label}</strong></div>)}</div><div className="action-stack">{statuses.map((status) => <button className={request.status === status ? "primary-button" : ""} key={status} onClick={() => onStatus(request, status)}>{status}</button>)}<button onClick={() => onStatus(request, "Disputed")}>Open dispute</button><div className="mm-add-participant"><select value={participantRole} onChange={(event) => setParticipantRole(event.target.value as "buyer" | "seller")}><option value="buyer">Buyer</option><option value="seller">Seller</option></select><input value={participantUsername} onChange={(event) => setParticipantUsername(event.target.value)} placeholder="Username" /><button onClick={addParticipant}>Add</button>{participantError && <small>{participantError}</small>}</div></div></aside>
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
                {message.attachment && <a className="mm-message-attachment" href={message.attachment.data} download={message.attachment.name}>{message.attachment.type.startsWith("image/") && <img src={message.attachment.data} alt={message.attachment.name} />}📎 {message.attachment.name}</a>}
                <small>{formatDate(message.createdAt)}</small>
              </div>
            ))}
          </div>
          <div className="mm-composer">
            <label title="Attach file">📎<input type="file" accept="image/*,.pdf,.txt,.zip" onChange={(event) => selectAttachment(event.target.files?.[0])} /></label>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }}
              placeholder="Message participants..."
            />
            {attachment && <span className="mm-attachment-chip">📎 {attachment.name}<button onClick={() => setAttachment(null)}>×</button></span>}
            <button onClick={send} disabled={uploading}>{uploading ? "Reading..." : "Send"}</button>
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
*/
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
  const [attachment, setAttachment] = useState<{ name: string; type: string; data: string } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [participantUsername, setParticipantUsername] = useState("");
  const [participantRole, setParticipantRole] = useState<"buyer" | "seller">("buyer");
  const send = async () => {
    if ((!draft.trim() && !attachment) || sending) return;
    setSending(true);
    const response = await fetch(`/api/middleman/requests/${request.id}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: draft.trim() || "Shared an attachment.", attachment }) });
    setSending(false);
    if (!response.ok) return;
    setDraft("");
    setAttachment(null);
    onRefresh();
  };
  const selectAttachment = (file?: File) => {
    if (!file || file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => setAttachment({ name: file.name, type: file.type, data: String(reader.result || "") });
    reader.readAsDataURL(file);
  };
  const addParticipant = async () => {
    if (!participantUsername.trim()) return;
    const response = await fetch(`/api/middleman/requests/${request.id}/participants`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: participantRole, username: participantUsername.trim() }) });
    if (response.ok) { setParticipantUsername(""); onRefresh(); }
  };
  const removeParticipant = async (participantId?: string) => {
    if (!participantId) return;
    const response = await fetch(`/api/middleman/requests/${request.id}/participants/${participantId}`, { method: "DELETE" });
    if (response.ok) onRefresh();
  };
  return (
    <section className="transaction-view escrow-view mm-escrow-view">
      <div className="escrow-topline"><div><button className="mm-back" onClick={onBack}>← Back to requests</button><p className="eyebrow">SECURE TRANSACTION ROOM</p><h1>{request.id}</h1></div><button className="drawer-trigger" onClick={() => setDrawerOpen(true)}>Transaction <span>→</span></button></div>
      <div className="escrow-layout">
        <aside className="conversation-rail"><div className="rail-heading"><div><p className="eyebrow">CONVERSATIONS</p><strong>Transaction inbox</strong></div><span className="inbox-count">1</span></div><label className="conversation-search"><span>⌕</span><input placeholder="Search conversations" /></label><p className="rail-label">RECENT</p><button className="conversation active"><div className="conversation-avatar"><Avatar user={user} className="avatar" /><span /></div><div className="conversation-copy"><strong>Transaction team</strong><small>{request.messages[request.messages.length - 1]?.body || "Transaction room created."}</small><em>{request.id}</em></div><time>Live</time></button></aside>
        <main className="escrow-chat"><header className="escrow-chat-header"><div className="conversation-avatar"><Avatar user={user} className="avatar" /><span /></div><div><h2>Transaction team <i className="verified-mark">✓</i></h2><p><span className="presence-dot" /> Live · <b>{request.id}</b></p></div><span className="protected-badge">🛡 Protected Transaction</span></header><div className="transaction-banner"><div className="shield-icon">🛡</div><div><span>PROTECTED TRANSACTION</span><strong>{request.id} · {request.game}</strong><small>{request.item}</small></div><strong className="banner-amount">{request.amount}</strong><button onClick={() => setDrawerOpen(true)}>View transaction</button></div><div className="message-list escrow-messages">{request.messages.map((message) => message.system ? <div className="event-message" key={message.id}><span className="event-rule" /><div><strong>Transaction update</strong><p>{message.body}</p></div><span className="event-rule" /></div> : <div className={`escrow-message ${message.authorId === user.id ? "from-me" : message.authorRole === "MIDDLEMAN" ? "official" : "from-them"}`} key={message.id}><Avatar user={message.authorId === user.id ? user : request.buyer?.id === message.authorId ? request.buyer : request.seller || user} className="avatar tiny purple" /><div className="bubble-stack"><div className="message-meta"><strong>{message.authorId === user.id ? "You" : message.authorName || "Participant"}</strong>{message.authorRole === "MIDDLEMAN" && <span className="middleman-label">MIDDLEMAN</span>}<time>{formatDate(message.createdAt)}</time></div><div className="escrow-bubble"><p>{message.body}</p>{message.attachment && <a className="message-attachment" href={message.attachment.data} download={message.attachment.name}>{message.attachment.type.startsWith("image/") && <img src={message.attachment.data} alt={message.attachment.name} />}<span>📎 {message.attachment.name}</span></a>}</div>{message.authorId === user.id && <small className="read-state">{message.readBy?.some((id) => id !== message.authorId) ? "Seen ✓✓" : "Sent ✓"}</small>}</div></div>)}<div className="typing-indicator"><span /><span /><span /> Customer is typing</div></div><div className="mm-composer escrow-composer"><div className="composer-row"><label className="attach-button" title="Attach file">📎<input type="file" accept="image/*,.pdf,.txt,.zip" onChange={(event) => selectAttachment(event.target.files?.[0])} /></label><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Message the transaction participants..." rows={1} /><button className="emoji-button">😊</button><button className="send" onClick={send} disabled={sending}>{sending ? "..." : "➤"}</button></div>{attachment && <div className="attachment-chip">📎 {attachment.name}<button onClick={() => setAttachment(null)}>×</button></div>}<div className="security-line">🔒 <span><strong>Keep your transaction communication here.</strong> Never share passwords, recovery codes, payment credentials, or other sensitive information.</span></div></div></main>
        <aside className={`transaction-drawer ${drawerOpen ? "open" : ""}`}><div className="drawer-head"><div><p className="eyebrow">TRANSACTION</p><h2>{request.id}</h2></div><button onClick={() => setDrawerOpen(false)}>×</button></div><div className="transaction-item"><div className="game-avatar red">VAL</div><div><span>ITEM</span><strong>{request.item}</strong><small>{request.game}</small></div></div><div className="amount-row"><span>Amount</span><strong>{request.amount}</strong></div><div className="status-card"><span>Current status</span><strong><i /> {request.status}</strong></div><div className="people-block"><p className="eyebrow">PARTICIPANTS</p><div className="escrow-person"><Avatar user={user} className="avatar escrow-avatar" /><div><strong>{user.displayName || user.username}</strong><small>MIDDLEMAN · AUTHORIZED</small></div><span className="verified-mark">✓</span></div>{request.buyer && <div className="escrow-person"><Avatar user={request.buyer} className="avatar escrow-avatar" /><div><strong>{request.buyer.username}</strong><small>BUYER · VERIFIED</small></div><button onClick={() => removeParticipant(request.buyer?.id)}>Remove</button></div>}{request.seller && <div className="escrow-person"><Avatar user={request.seller} className="avatar escrow-avatar" /><div><strong>{request.seller.username}</strong><small>SELLER · VERIFIED</small></div><button onClick={() => removeParticipant(request.seller?.id)}>Remove</button></div>}</div><div className="add-participant"><p className="eyebrow">ADD PARTICIPANT</p><select value={participantRole} onChange={(event) => setParticipantRole(event.target.value as "buyer" | "seller")}><option value="buyer">Buyer</option><option value="seller">Seller</option></select><input value={participantUsername} onChange={(event) => setParticipantUsername(event.target.value)} placeholder="Registered username" /><button onClick={addParticipant}>Add</button></div><div className="timeline"><p className="eyebrow">TRANSACTION TIMELINE</p>{["Transaction Created", "Payment Secured", "Seller Delivering", "Buyer Verification", "Completed"].map((label, index) => <div className={index < 2 ? "done" : index === 2 ? "current" : ""} key={label}><span>{index < 2 ? "✓" : index === 2 ? "●" : "○"}</span><strong>{label}</strong></div>)}</div><div className="action-stack">{statuses.map((status) => <button className={request.status === status ? "primary-button" : ""} key={status} onClick={() => onStatus(request, status)}>{status}</button>)}<button onClick={() => onStatus(request, "Disputed")}>Open dispute</button></div></aside>
      </div>
    </section>
  );
}
function PrivateMessages({ conversations, selected, onSelect, onRefresh, user }: { conversations: PrivateConversation[]; selected: PrivateConversation | null; onSelect: (conversation: PrivateConversation) => void; onRefresh: () => void; user: User }) {
  const [draft, setDraft] = useState("");
  const active = selected || conversations[0] || null;
  useEffect(() => {
    if (!active) return;
    const refresh = () => fetch(`/api/conversations/${active.id}`).then((response) => response.ok ? response.json() : null).then((data) => data?.conversation && onSelect(data.conversation)).catch(() => undefined);
    refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => window.clearInterval(timer);
  }, [active?.id]);
  const send = async () => {
    if (!active || !draft.trim()) return;
    const response = await fetch(`/api/conversations/${active.id}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: draft.trim() }) });
    if (!response.ok) return;
    const data = await response.json();
    onSelect({ ...active, messages: [...active.messages, { ...data.message, author: "You", role: user.role, time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) }] });
    setDraft("");
    onRefresh();
  };
  return <div className="private-messages"><div className="private-list mm-panel panel"><div className="mm-panel-head"><div><p className="eyebrow">DIRECT SUPPORT</p><h2>Private messages</h2></div><span className="mm-count">{conversations.length} chats</span></div>{conversations.length ? conversations.map((conversation) => <button className={`private-row ${active?.id === conversation.id ? "active" : ""}`} key={conversation.id} onClick={() => onSelect(conversation)}><Avatar user={conversation.customer} /><span><strong>{conversation.customer?.displayName || conversation.customer?.username || "Customer"}</strong><small>{conversation.messages[conversation.messages.length - 1]?.body || "New private conversation"}</small></span></button>) : <div className="mm-empty"><span>□</span><strong>No private conversations yet</strong><small>Customers who contact you will appear here.</small></div>}</div>{active ? <div className="private-chat mm-panel panel"><div className="mm-panel-head"><div><p className="eyebrow">PRIVATE CONVERSATION</p><h2>{active.customer?.displayName || active.customer?.username}</h2></div><span className="mm-live">● Private</span></div><div className="mm-messages">{active.messages.map((message) => <div className={`mm-message ${message.authorId === user.id ? "own" : ""}`} key={message.id}><strong>{message.authorId === user.id ? "YOU" : active.customer?.username || "CUSTOMER"}</strong><p>{message.body}</p><small>{message.createdAt ? formatDate(message.createdAt) : "Now"}</small></div>)}</div><div className="mm-composer"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Message this customer..." /><button onClick={send}>➤</button></div></div> : <div className="private-chat mm-panel panel mm-empty"><strong>Select a private conversation</strong><small>Private customer messages are only visible to both participants.</small></div>}</div>;
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
