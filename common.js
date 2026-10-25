/* Shared code: starter content, Firebase (Realtime Database) start-up, helpers. Shop data lives under "shop/". */
const DEFAULTS = {
  settings: { name: "INSANE Store", whatsapp: "919034830336", email: ADMIN_EMAIL, announce: "Free delivery on orders above ₹999", deliveryFee: 49, freeAbove: 999, theme: "sunset", pickup: false },
  coupon: { code: "WELCOME10", type: "percent", value: 10, min: 500, active: true },
  products: [
    { name: "Classic Hoodie", category: "Fashion", price: 1499, oldPrice: 1999, inStock: true, badge: "Bestseller", stock: 12, desc: "Soft, warm and made to last.\nAvailable in all sizes." },
    { name: "Wireless Earbuds", category: "Electronics", price: 2499, oldPrice: 0, inStock: true, badge: "New", stock: 4, desc: "Clear sound and long battery life." },
    { name: "Desk Lamp", category: "Home", price: 899, oldPrice: 0, inStock: true, desc: "Adjustable light for work and study." }
  ]
};
let fb = null;
try {
  if (typeof firebase !== "undefined" && FIREBASE_CONFIG.apiKey) {
    firebase.initializeApp(FIREBASE_CONFIG);
    fb = { db: firebase.database(), auth: firebase.auth ? firebase.auth() : null };
  }
} catch (e) { console.warn("Firebase not started:", e); }
const ref = p => fb.db.ref("shop/" + p);
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
/* h("div",{class:"x"}, child, "text"): text is always inserted as plain text (safe) */
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el[k] = v;
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  kids.flat().filter(c => c != null && c !== false).forEach(c => el.append(c));
  return el;
};
const TS = () => firebase.database.ServerValue.TIMESTAMP;
const toList = obj => Object.entries(obj || {}).map(([id, v]) => ({ id, ...v }));
const money = n => "₹" + Number(n || 0).toLocaleString("en-IN");
const safeImg = s => /^data:image\/(jpeg|png|webp);base64,/.test(s || "") ? s : "";
const withTimeout = (p, ms = 9000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error("timeout"), { code: "timeout" })), ms))]);
const stars = v => "★".repeat(Math.round(v)) + "☆".repeat(5 - Math.round(v));
const ago = t => {
  if (!t) return "just now";
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now"; if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " h ago"; return new Date(t).toLocaleDateString();
};
