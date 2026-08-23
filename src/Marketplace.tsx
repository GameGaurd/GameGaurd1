import { useMemo, useState } from "react";
import "./Marketplace.css";

type Listing = {
  id: string;
  game: string;
  short: string;
  tone: string;
  title: string;
  rank: string;
  level: string;
  region: string;
  feature: string;
  price: number;
  seller: string;
  avatar: string;
  rating: number;
  verified: boolean;
  sample?: boolean;
};
const seed = [
  [
    "Valorant",
    "VAL",
    "red",
    "Radiant Valorant Account — 82 Skins",
    "Radiant",
    "312",
    "NA",
    "82 skins",
    240,
    "Maya Chen",
    "MC",
    5,
  ],
  [
    "Valorant",
    "VAL",
    "red",
    "Immortal Valorant Account — Premium Collection",
    "Immortal 3",
    "287",
    "EU",
    "54 skins",
    185,
    "Jordan Lee",
    "JL",
    4.9,
  ],
  [
    "Valorant",
    "VAL",
    "red",
    "Vandal / Phantom Collection Account",
    "Ascendant 2",
    "198",
    "SEA",
    "39 skins",
    129,
    "Avery Stone",
    "AS",
    4.8,
  ],
  [
    "Valorant",
    "VAL",
    "red",
    "Champions Bundle Account — Rare Cosmetics",
    "Immortal 1",
    "224",
    "NA",
    "47 skins",
    169,
    "Kai Morgan",
    "KM",
    4.9,
  ],
  [
    "Mobile Legends",
    "ML",
    "blue",
    "Mythical Glory Account — 120+ Heroes",
    "Mythical Glory",
    "68",
    "SEA",
    "96 skins",
    210,
    "Lina Cruz",
    "LC",
    5,
  ],
  [
    "Mobile Legends",
    "ML",
    "blue",
    "Collector Skin Account",
    "Mythic",
    "54",
    "Asia",
    "71 skins",
    155,
    "Rafi Santos",
    "RS",
    4.9,
  ],
  [
    "Mobile Legends",
    "ML",
    "blue",
    "Full Squad Skin Account",
    "Mythical Honor",
    "49",
    "SEA",
    "58 skins",
    118,
    "Nadia Putri",
    "NP",
    4.7,
  ],
  [
    "Mobile Legends",
    "ML",
    "blue",
    "Season Veteran Collection",
    "Mythic 20",
    "76",
    "NA",
    "44 skins",
    95,
    "Theo James",
    "TJ",
    4.8,
  ],
  [
    "Roblox",
    "RBX",
    "yellow",
    "High Level Roblox Account — Rare Limiteds",
    "Level 210",
    "210",
    "NA",
    "18 limiteds",
    275,
    "Sam Rivera",
    "SR",
    5,
  ],
  [
    "Roblox",
    "RBX",
    "yellow",
    "Robux & Rare Cosmetics Collection",
    "Level 148",
    "148",
    "EU",
    "12 limiteds",
    90,
    "Quinn Park",
    "QP",
    4.8,
  ],
  [
    "Roblox",
    "RBX",
    "yellow",
    "Classic Avatar Collection",
    "Level 92",
    "92",
    "NA",
    "26 items",
    65,
    "Drew Kim",
    "DK",
    4.7,
  ],
  [
    "Fortnite",
    "FN",
    "violet",
    "OG Fortnite Account — Rare Skins",
    "OG Season 2",
    "189",
    "NA",
    "34 skins",
    320,
    "Noah Williams",
    "NW",
    5,
  ],
  [
    "Fortnite",
    "FN",
    "violet",
    "Black Knight Collection Account",
    "Elite",
    "164",
    "EU",
    "28 skins",
    245,
    "Mina Park",
    "MP",
    4.9,
  ],
  [
    "Fortnite",
    "FN",
    "violet",
    "Full Locker — 200+ Cosmetics",
    "Champion",
    "206",
    "NA",
    "212 items",
    198,
    "Chris Moore",
    "CM",
    4.8,
  ],
  [
    "PUBG",
    "PUBG",
    "green",
    "PUBG Mobile Conqueror Account",
    "Conqueror",
    "61",
    "Asia",
    "42 outfits",
    175,
    "Hana Ito",
    "HI",
    4.9,
  ],
  [
    "PUBG",
    "PUBG",
    "green",
    "Premium Weapon Finish Collection",
    "Ace Master",
    "52",
    "EU",
    "31 items",
    120,
    "Omar Ali",
    "OA",
    4.7,
  ],
  [
    "PUBG",
    "PUBG",
    "green",
    "Veteran Season Account",
    "Crown",
    "45",
    "NA",
    "18 outfits",
    72,
    "Milo Reed",
    "MR",
    4.8,
  ],
  [
    "Call of Duty",
    "COD",
    "orange",
    "CODM Legendary Loadout Account",
    "Legendary",
    "88",
    "NA",
    "24 blueprints",
    149,
    "Eli Grant",
    "EG",
    5,
  ],
  [
    "Call of Duty",
    "COD",
    "orange",
    "Damascus Camo Collection",
    "Grand Master",
    "73",
    "EU",
    "19 blueprints",
    110,
    "Sara Fox",
    "SF",
    4.8,
  ],
  [
    "League of Legends",
    "LOL",
    "blue",
    "League Account — 160 Skins",
    "Diamond II",
    "412",
    "EUW",
    "160 skins",
    230,
    "Maya Chen",
    "MC",
    5,
  ],
  [
    "League of Legends",
    "LOL",
    "blue",
    "Seasoned Ranked Collection",
    "Platinum I",
    "288",
    "NA",
    "82 skins",
    125,
    "Owen Cole",
    "OC",
    4.8,
  ],
  [
    "Other",
    "ETC",
    "orange",
    "Minecraft Java Account — Rare Capes",
    "Veteran",
    "—",
    "Global",
    "6 capes",
    88,
    "Jules Tan",
    "JT",
    4.7,
  ],
  [
    "Other",
    "ETC",
    "orange",
    "GTA Online Legacy Account",
    "Level 220",
    "220",
    "NA",
    "Rare items",
    140,
    "Cole Diaz",
    "CD",
    4.9,
  ],
  [
    "Other",
    "ETC",
    "orange",
    "Apex Legends Heirloom Account",
    "Master",
    "156",
    "EU",
    "4 heirlooms",
    260,
    "Iris Young",
    "IY",
    5,
  ],
].map((item, index) => ({
  id: `sample-${index + 1}`,
  game: item[0],
  short: item[1],
  tone: item[2],
  title: item[3],
  rank: item[4],
  level: item[5],
  region: item[6],
  feature: item[7],
  price: item[8],
  seller: item[9],
  avatar: item[10],
  rating: item[11],
  verified: true,
  sample: true,
})) as Listing[];
const catalog = [
  ...seed,
  ...Array.from({ length: 6400 - seed.length }, (_, index) => {
    const base = seed[index % seed.length];
    const variant = Math.floor(index / seed.length) + 1;
    const price = Math.max(
      29,
      Math.round((base.price * (0.72 + ((variant * 17) % 61) / 100)) / 5) * 5,
    );
    return {
      ...base,
      id: `generated-${index + 1}`,
      title: `${base.game} ${variant % 3 === 0 ? "Elite" : variant % 2 === 0 ? "Seasonal" : "Premium"} Account — ${base.feature}`,
      rank: variant % 4 === 0 ? "Veteran" : base.rank,
      level:
        base.level === "—" ? "—" : String(Number(base.level) + (variant % 18)),
      region: ["NA", "EU", "SEA", "Global"][variant % 4],
      price,
      seller: `${["Alex", "Jamie", "Taylor", "Morgan", "Riley", "Casey"][variant % 6]} ${["Reyes", "Patel", "Nguyen", "Santos", "Kim", "Bennett"][(variant + index) % 6]}`,
      avatar: `${["AR", "JP", "TN", "MS", "RK", "CB"][variant % 6]}`,
      rating: Number((4.6 + (variant % 5) / 10).toFixed(1)),
      sample: true,
    };
  }),
];

export function Marketplace({
  onRequest,
  onSell,
  onToast,
}: {
  onRequest: () => void;
  onSell: () => void;
  onToast: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [game, setGame] = useState("All games");
  const [sort, setSort] = useState("Recommended");
  const [verified, setVerified] = useState(false);
  const [selected, setSelected] = useState<Listing | null>(null);
  const custom = JSON.parse(
    localStorage.getItem("gameguard-listings") || "[]",
  ) as Listing[];
  const listings = useMemo(
    () =>
      [...custom, ...catalog]
        .filter(
          (listing) =>
            (game === "All games" || listing.game === game) &&
            (!verified || listing.verified) &&
            `${listing.title} ${listing.game} ${listing.seller} ${listing.rank} ${listing.feature}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "Lowest Price"
            ? a.price - b.price
            : sort === "Highest Price"
              ? b.price - a.price
              : sort === "Highest Rated"
                ? b.rating - a.rating
                : 0,
        ),
    [custom, game, query, sort, verified],
  );
  return (
    <section className="marketplace-page">
      <div className="marketplace-heading">
        <div>
          <p className="eyebrow">MARKETPLACE</p>
          <h1>Marketplace</h1>
          <p className="subheading">Browse and discover gaming accounts.</p>
        </div>
        <div className="marketplace-heading-actions">
          <button className="outline-button" onClick={onSell}>
            ＋ Sell your account
          </button>
          <button className="primary-button" onClick={onRequest}>
            Request a middleman
          </button>
        </div>
      </div>
      <div className="marketplace-toolbar">
        <div className="market-search">
          ⌕
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search game accounts..."
          />
        </div>
        <select value={game} onChange={(e) => setGame(e.target.value)}>
          <option>All games</option>
          {[
            "Valorant",
            "Mobile Legends",
            "Roblox",
            "Fortnite",
            "PUBG",
            "Call of Duty",
            "League of Legends",
            "Other",
          ].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option>Recommended</option>
          <option>Newest</option>
          <option>Lowest Price</option>
          <option>Highest Price</option>
          <option>Highest Rated</option>
        </select>
        <label className="verified-filter">
          <input
            type="checkbox"
            checked={verified}
            onChange={(e) => setVerified(e.target.checked)}
          />{" "}
          Verified only
        </label>
        <button className="grid-toggle active">▦</button>
        <button className="grid-toggle">☷</button>
      </div>
      <div className="marketplace-meta">
        <span>{listings.length} accounts available</span>
        <span>
          All listings are screened for safe in-platform transactions.
        </span>
      </div>
      {listings.length ? (
        <div className="listing-grid">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onClick={() => setSelected(listing)}
            />
          ))}
        </div>
      ) : (
        <div className="market-empty">
          <div>⌕</div>
          <h2>No accounts found</h2>
          <p>Try another game, seller, or search term.</p>
        </div>
      )}
      <p className="market-disclaimer">
        Account transfers may be restricted by game publishers. Review the
        relevant Terms of Service before buying or selling.
      </p>
      {selected && (
        <ListingDetail
          listing={selected}
          close={() => setSelected(null)}
          onRequest={onRequest}
          onToast={onToast}
        />
      )}
    </section>
  );
}

function ListingCard({
  listing,
  onClick,
}: {
  listing: Listing;
  onClick: () => void;
}) {
  return (
    <article className="listing-card">
      <button className={`listing-art ${listing.tone}`} onClick={onClick}>
        <span>{listing.short}</span>
        <b>♡</b>
      </button>
      <div className="listing-body">
        <div className="verified-badge">✓ VERIFIED SELLER</div>
        <button className="listing-title" onClick={onClick}>
          {listing.title}
        </button>
        <div className="listing-facts">
          <span>{listing.rank}</span>
          <span>Lvl {listing.level}</span>
          <span>{listing.region}</span>
          <span>{listing.feature}</span>
        </div>
        <div className="seller-line">
          <div className="avatar tiny purple">{listing.avatar}</div>
          <div>
            <strong>{listing.seller}</strong>
            <small>
              ✓ Verified Seller · <span>★★★★★ {listing.rating}</span>
            </small>
          </div>
        </div>
        <div className="listing-bottom">
          <strong>${listing.price.toFixed(2)}</strong>
          <button className="view-account" onClick={onClick}>
            View account →
          </button>
        </div>
      </div>
    </article>
  );
}
function ListingDetail({
  listing,
  close,
  onRequest,
  onToast,
}: {
  listing: Listing;
  close: () => void;
  onRequest: () => void;
  onToast: (message: string) => void;
}) {
  return (
    <div
      className="listing-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div className="listing-detail">
        <button className="detail-close" onClick={close}>
          ×
        </button>
        <div className={`detail-art ${listing.tone}`}>
          <span>{listing.short}</span>
          <small>IMAGE GALLERY · ACCOUNT PREVIEW</small>
        </div>
        <div className="detail-copy">
          <div className="verified-badge">✓ VERIFIED SELLER</div>
          <h2>{listing.title}</h2>
          <p className="detail-game">
            {listing.game} · {listing.region}
          </p>
          <div className="detail-seller">
            <div className="avatar purple">{listing.avatar}</div>
            <div>
              <strong>{listing.seller}</strong>
              <small>★★★★★ {listing.rating} · Verified seller</small>
            </div>
          </div>
          <strong className="detail-price">${listing.price.toFixed(2)}</strong>
          <div className="detail-actions">
            <button
              className="primary-button"
              onClick={() =>
                onToast("Buy flow requires a protected middleman transaction")
              }
            >
              Buy now
            </button>
            <button className="outline-button" onClick={onRequest}>
              Request a middleman
            </button>
            <button
              className="text-button"
              onClick={() =>
                onToast(
                  "Message seller is available after a transaction is created",
                )
              }
            >
              Message seller
            </button>
          </div>
          <div className="account-details">
            <p className="eyebrow">ACCOUNT DETAILS</p>
            <div>
              <span>Rank</span>
              <strong>{listing.rank}</strong>
              <span>Level</span>
              <strong>{listing.level}</strong>
              <span>Region</span>
              <strong>{listing.region}</strong>
              <span>Included</span>
              <strong>{listing.feature}</strong>
            </div>
          </div>
          <p className="detail-notice">
            Please comply with the relevant game publisher Terms of Service and
            platform rules. Never share account passwords in marketplace
            messages.
          </p>
        </div>
      </div>
    </div>
  );
}

export function SellAccount({
  onBack,
  onPublished,
}: {
  onBack: () => void;
  onPublished: () => void;
}) {
  const [step, setStep] = useState(1);
  const [game, setGame] = useState("Valorant");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [published, setPublished] = useState(false);
  const fields = ["Game", "Details", "Images", "Pricing", "Review"];
  return (
    <section className="sell-page">
      <button className="back-link" onClick={onBack}>
        ← Back to marketplace
      </button>
      <div className="sell-heading">
        <div>
          <p className="eyebrow">SELLER WORKSPACE</p>
          <h1>Sell your account</h1>
          <p className="subheading">
            Create a listing without sharing passwords or sensitive credentials.
          </p>
        </div>
      </div>
      <div className="sell-stepper">
        {fields.map((field, index) => (
          <span className={index + 1 <= step ? "current" : ""} key={field}>
            <b>{index + 1 < step ? "✓" : index + 1}</b>
            {field}
          </span>
        ))}
      </div>
      {published ? (
        <div className="publish-success">
          <div>✓</div>
          <p className="eyebrow">LISTING PUBLISHED</p>
          <h2>Your account is ready for review.</h2>
          <p>
            The listing is saved locally as development data and will appear in
            Marketplace after review.
          </p>
          <button className="primary-button" onClick={onPublished}>
            Return to marketplace →
          </button>
        </div>
      ) : (
        <div className="sell-layout">
          <div className="sell-form panel">
            {step === 1 && (
              <>
                <h2>Select a game</h2>
                <div className="sell-games">
                  {[
                    "Valorant",
                    "Mobile Legends",
                    "Roblox",
                    "Fortnite",
                    "PUBG",
                    "Call of Duty",
                    "League of Legends",
                    "Other",
                  ].map((item) => (
                    <button
                      className={game === item ? "chosen" : ""}
                      onClick={() => setGame(item)}
                      key={item}
                    >
                      {item}
                      <small>Choose category</small>
                    </button>
                  ))}
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <h2>Account information</h2>
                <div className="sell-fields">
                  <label>
                    Listing title
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={`e.g. ${game} premium account`}
                    />
                  </label>
                  <div className="sell-row">
                    <label>
                      Rank
                      <input placeholder="Rank or tier" />
                    </label>
                    <label>
                      Account level
                      <input placeholder="Level" />
                    </label>
                  </div>
                  <div className="sell-row">
                    <label>
                      Region / server
                      <input placeholder="NA, EU, SEA" />
                    </label>
                    <label>
                      Skins / items
                      <input placeholder="Count or summary" />
                    </label>
                  </div>
                  <label>
                    Characters / heroes
                    <input placeholder="Optional" />
                  </label>
                  <label>
                    Other features
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what is included with this account..."
                    />
                  </label>
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <h2>Listing images</h2>
                <p className="field-help">
                  Add screenshots that show the account clearly. Remove
                  usernames, email addresses, and private information first.
                </p>
                <label className="image-drop">
                  ＋ <span>Upload screenshots</span>
                  <small>PNG, JPG up to 10 MB each</small>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    multiple
                    onChange={(e) =>
                      setImages(
                        Array.from(e.target.files || []).map((file) =>
                          URL.createObjectURL(file),
                        ),
                      )
                    }
                  />
                </label>
                {images.length > 0 && (
                  <div className="image-previews">
                    {images.map((image) => (
                      <img src={image} key={image} alt="Listing preview" />
                    ))}
                  </div>
                )}
              </>
            )}
            {step === 4 && (
              <>
                <h2>Set your price</h2>
                <div className="sell-fields">
                  <div className="sell-row">
                    <label>
                      Price
                      <input
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="240.00"
                      />
                    </label>
                    <label>
                      Currency
                      <select>
                        <option>USD ($)</option>
                        <option>EUR (€)</option>
                      </select>
                    </label>
                  </div>
                  <label className="check-field">
                    <input type="checkbox" /> Price is negotiable
                  </label>
                </div>
              </>
            )}
            {step === 5 && (
              <>
                <h2>Preview listing</h2>
                <ListingCard
                  listing={{
                    id: "preview",
                    game,
                    short: game.slice(0, 3).toUpperCase(),
                    tone: game === "Valorant" ? "red" : "blue",
                    title: title || `${game} account`,
                    rank: "Premium rank",
                    level: "—",
                    region: "Global",
                    feature: "Your details",
                    price: Number(price) || 0,
                    seller: "You",
                    avatar: "YO",
                    rating: 0,
                    verified: false,
                  }}
                  onClick={() => undefined}
                />
                <p className="field-help">
                  Publishing sends this development listing into your local
                  marketplace. Real verification must happen server-side before
                  public production listings.
                </p>
              </>
            )}
            <div className="sell-actions">
              <button
                className="back-button"
                onClick={() => (step > 1 ? setStep(step - 1) : onBack)}
              >
                {step > 1 ? "Back" : "Cancel"}
              </button>
              {step < 5 ? (
                <button
                  className="primary-button"
                  onClick={() => setStep(step + 1)}
                >
                  Continue →
                </button>
              ) : (
                <>
                  <button className="outline-button" onClick={() => setStep(4)}>
                    Save draft
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => {
                      const existing = JSON.parse(
                        localStorage.getItem("gameguard-listings") || "[]",
                      );
                      existing.unshift({
                        id: `user-${Date.now()}`,
                        game,
                        short: game.slice(0, 3).toUpperCase(),
                        tone: game === "Valorant" ? "red" : "blue",
                        title: title || `${game} account`,
                        rank: "Premium rank",
                        level: "—",
                        region: "Global",
                        feature: "Seller details",
                        price: Number(price) || 0,
                        seller: "You",
                        avatar: "YO",
                        rating: 0,
                        verified: false,
                      });
                      localStorage.setItem(
                        "gameguard-listings",
                        JSON.stringify(existing),
                      );
                      setPublished(true);
                    }}
                  >
                    Publish listing →
                  </button>
                </>
              )}
            </div>
          </div>
          <aside className="sell-note panel">
            <p className="eyebrow">SELLER SAFETY</p>
            <h3>Keep your account secure.</h3>
            <p>
              GameGuard never needs your password, recovery email, or 2FA codes.
              Only share listing details and sanitized screenshots.
            </p>
            <div className="security-note">
              <span>⌁</span>
              <p>
                Listings are marked for review before production visibility.
              </p>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
