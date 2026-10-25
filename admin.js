const toast = m => { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 4500); };
const errText = e => {
  if (e && e.code === "timeout") return "Cannot reach the database. Publish database.rules.json in Firebase (Realtime Database > Rules) and check your internet.";
  if (/permission[_ ]denied/i.test((e && (e.code || e.message)) || "")) return "Permission denied. Publish database.rules.json in Firebase (Realtime Database > Rules) and sign in with the admin email.";
  return (e && e.message) || String(e);
};
const guard = (fn, ms = 10000) => async () => { try { await withTimeout(fn(), ms); } catch (e) { console.error(e); toast(errText(e)); } };
let started = false, products = [], orders = [], reviews = {}, pending = {}, coupons = [], ofilter = "";
let ed = { id: null, photos: [], created: 0 };
const pname = id => (products.find(p => p.id === id) || {}).name || "(deleted product)";
const flat = o => Object.entries(o || {}).flatMap(([pid, m]) => Object.entries(m || {}).map(([rid, v]) => ({ pid, rid, ...v })));

/* Sign in: only ADMIN_EMAIL (verified Google account) gets in */
if (!fb) {
  $("#login").hidden = false; $("#gbtn").disabled = true;
  $("#loginMsg").textContent = "Firebase is not set up yet. Check firebase-config.js.";
} else {
  $("#gbtn").onclick = () => fb.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => $("#loginMsg").textContent = e.message);
  $("#out").onclick = () => fb.auth.signOut();
  fb.auth.onAuthStateChanged(u => {
    const ok = u && u.emailVerified && u.email && u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    $("#login").hidden = !!ok; $("#app").hidden = !ok;
    if (ok) start();
    else if (u) { $("#loginMsg").textContent = "This account is not allowed."; fb.auth.signOut(); }
  });
}
$$(".menu button").forEach(b => b.onclick = () => {
  $$(".menu button").forEach(x => x.setAttribute("aria-current", x === b));
  $$(".panel").forEach(p => p.hidden = p.id !== b.dataset.t);
  scrollTo(0, 0);
});

async function start() {
  if (started) return; started = true;
  try {
    const s = await withTimeout(ref("settings").once("value"));
    if (!s.exists()) {
      const up = { settings: { ...DEFAULTS.settings, seeded: true } };
      DEFAULTS.products.forEach((p, i) => up["products/" + ref("products").push().key] = { ...p, thumb: "", createdAt: Date.now() - i });
      up["coupons/" + DEFAULTS.coupon.code] = { type: DEFAULTS.coupon.type, value: DEFAULTS.coupon.value, min: DEFAULTS.coupon.min, active: true };
      await fb.db.ref("shop").update(up); toast("Sample products and a WELCOME10 coupon were added. Edit or delete them any time.");
    } else if (/x/i.test(s.val().whatsapp || "x")) await ref("settings").update({ whatsapp: DEFAULTS.settings.whatsapp });
  } catch (e) { toast(errText(e)); }
  const err = e => toast(errText(e));
  ref("products").on("value", s => { products = toList(s.val()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); renderProducts(); renderRev(); renderDash(); }, err);
  ref("orders").on("value", s => { orders = toList(s.val()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); notifyNew(); renderOrders(); renderDash(); }, err);
  ref("coupons").on("value", s => { coupons = Object.entries(s.val() || {}).map(([code, v]) => ({ code, ...v })); renderCoupons(); }, err);
  ref("reviews").on("value", s => { reviews = s.val() || {}; renderRev(); }, err);
  ref("reviewsPending").on("value", s => { pending = s.val() || {}; renderRev(); renderDash(); }, err);
  loadSettings();
}

/* Image helpers: photos are resized in the browser so they stay small and load fast */
const fromUrl = u => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
const readImg = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => fromUrl(r.result).then(res, rej); r.onerror = rej; r.readAsDataURL(f); });
const shrink = (img, max, q) => {
  const s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", q);
};
const phStyle = n => { const k = [...String(n)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360; return `background:linear-gradient(135deg,hsl(${k} 70% 62%),hsl(${(k + 50) % 360} 70% 50%))`; };

/* Products */
function renderProducts() {
  $("#catlist").replaceChildren(...[...new Set(products.map(p => p.category).filter(Boolean))].map(c => h("option", { value: c })));
  $("#prodList").replaceChildren(...(products.length ? products.map(p => h("article", { class: "card pa" },
    h("div", { class: "t" }, safeImg(p.thumb) ? h("img", { src: safeImg(p.thumb), alt: p.name }) : h("div", { class: "ph", style: phStyle(p.name) }, String(p.name).charAt(0).toUpperCase())),
    h("div", {}, h("h3", {}, p.name), h("div", { class: "meta" }, money(p.price) + (p.oldPrice > p.price ? " (was " + money(p.oldPrice) + ")" : "")), h("div", { class: "meta" }, (p.category || "No category") + " | " + (p.inStock === false || (typeof p.stock === "number" && p.stock <= 0) ? "Out of stock" : "In stock") + (typeof p.stock === "number" ? " | " + p.stock + " left" : "") + (p.badge ? " | " + p.badge : ""))),
    h("div", { class: "row" },
      h("button", { class: "btn sm", onclick: () => openEditor(p) }, "Edit"),
      h("button", { class: "btn ghost sm", onclick: () => openEditor(p, true) }, "Duplicate"),
      h("button", { class: "btn ghost sm", onclick: guard(() => ref("products/" + p.id + "/inStock").set(p.inStock === false)) }, p.inStock === false ? "Mark in stock" : "Mark out of stock"),
      h("button", { class: "btn ghost sm danger", onclick: guard(async () => {
        if (!confirm("Delete " + p.name + " with its photos and reviews?")) return;
        await fb.db.ref("shop").update({ ["products/" + p.id]: null, ["productPhotos/" + p.id]: null, ["reviews/" + p.id]: null, ["reviewsPending/" + p.id]: null });
        toast("Product deleted");
      }) }, "Delete")))) : [h("p", { class: "empty card" }, "No products yet. Press Add product to create your first one.")]));
}
function renderPhotos() {
  $("#ePhotos").replaceChildren(...ed.photos.map((s, i) => h("div", { class: "ph1" }, h("img", { src: s, alt: "Photo " + (i + 1) }), i ? null : h("i", {}, "Cover"),
    h("button", { "aria-label": "Remove photo", onclick: () => { ed.photos.splice(i, 1); renderPhotos(); } }, "×"))));
}
function openEditor(p, copy) {
  ed = { id: p && !copy ? p.id : null, src: p ? p.id : null, photos: [], created: p && !copy ? p.createdAt : 0 };
  $("#edTitle").textContent = copy ? "Duplicate product" : p ? "Edit product" : "Add product";
  $("#eName").value = p ? p.name + (copy ? " (copy)" : "") : ""; $("#eCat").value = p ? p.category || "" : ""; $("#ePrice").value = p ? p.price : "";
  $("#eOld").value = p && p.oldPrice ? p.oldPrice : ""; $("#eDesc").value = p ? p.desc || "" : ""; $("#eStock").checked = p ? p.inStock !== false : true;
  $("#eBadge").value = p ? p.badge || "" : ""; $("#eQty").value = p && typeof p.stock === "number" ? p.stock : "";
  renderPhotos(); $("#editor").hidden = false; $("#editor").scrollIntoView({ behavior: "smooth", block: "start" });
  if (p) ref("productPhotos/" + p.id).once("value").then(s => { if (ed.src === p.id) { ed.photos = Object.values(s.val() || {}).map(safeImg).filter(Boolean); renderPhotos(); } }).catch(e => toast(errText(e)));
}
$("#addProd").onclick = () => openEditor(null);
$("#eCancel").onclick = () => $("#editor").hidden = true;
$("#eFile").onchange = async e => {
  const files = [...e.target.files].slice(0, 5 - ed.photos.length); e.target.value = "";
  if (!files.length) return toast("You can add up to 5 photos.");
  toast("Processing photos...");
  try { for (const f of files) ed.photos.push(shrink(await readImg(f), 900, .78)); renderPhotos(); toast("Photos added. Press Save product."); }
  catch (err) { toast("One of the files is not a valid image."); }
};
$("#eSave").onclick = guard(async () => {
  const name = $("#eName").value.trim(), price = parseFloat($("#ePrice").value);
  if (!name || !(price >= 0)) return toast("Product name and a valid price are required.");
  const key = ed.id || ref("products").push().key, saveBtn = $("#eSave");
  saveBtn.disabled = true;
  try {
    const thumb = ed.photos.length ? shrink(await fromUrl(ed.photos[0]), 420, .75) : "";
    const qty = $("#eQty").value.trim();
    const data = { name, category: $("#eCat").value.trim(), price, oldPrice: parseFloat($("#eOld").value) || 0, inStock: $("#eStock").checked, desc: $("#eDesc").value.trim(), badge: $("#eBadge").value.trim(), thumb, createdAt: ed.created || Date.now() };
    if (qty !== "" && parseInt(qty, 10) >= 0) data.stock = parseInt(qty, 10);
    await fb.db.ref("shop").update({ ["products/" + key]: data, ["productPhotos/" + key]: ed.photos.length ? ed.photos : null });
    $("#editor").hidden = true; toast("Saved. Your store is updated.");
  } finally { saveBtn.disabled = false; }
}, 40000);

/* Orders */
let known = null;
function beep() { try { const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.setValueAtTime(.15, a.currentTime); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + .6); o.start(); o.stop(a.currentTime + .6); } catch (e) {} }
function notifyNew() {
  if (known) { const fresh = orders.filter(o => !known.has(o.id) && (o.status || "new") === "new"); if (fresh.length) { toast("New order from " + fresh[0].name + " (" + money(fresh[0].total) + ")"); beep(); } }
  known = new Set(orders.map(o => o.id));
}
function renderOrders() {
  const n = k => orders.filter(o => (o.status || "new") === k).length;
  $("#ostats").replaceChildren(...[["", "All", orders.length], ["new", "New", n("new")], ["confirmed", "Confirmed", n("confirmed")], ["delivered", "Delivered", n("delivered")]]
    .map(([k, l, c]) => h("button", { class: "stat" + (ofilter === k ? " on" : ""), onclick: () => { ofilter = k; renderOrders(); } }, h("b", {}, String(c)), h("span", {}, l))));
  $("#obadge").textContent = n("new"); $("#obadge").hidden = !n("new"); document.title = (n("new") ? "(" + n("new") + ") " : "") + "Store admin | INSANE";
  const list = orders.filter(o => !ofilter || (o.status || "new") === ofilter);
  $("#ordList").replaceChildren(...(list.length ? list.map(orderCard) : [h("p", { class: "empty card" }, "No orders here yet. New orders appear the moment a customer places one.")]));
}
function orderCard(o) {
  const digits = (o.phone || "").replace(/\D/g, ""), its = Object.values(o.items || {});
  const st = h("select", { class: "st", onchange: guard(() => setStatus(o, st.value)) },
    ...["new", "confirmed", "delivered", "cancelled"].map(s => h("option", { value: s, selected: s === (o.status || "new") }, s)));
  const wa = "https://wa.me/" + (digits.length === 10 ? "91" + digits : digits) + "?text=" + encodeURIComponent(`Hi ${o.name}, thanks for your order of ${money(o.total)}. I am confirming it now.`);
  return h("article", { class: "card enq " + (o.status || "new") },
    h("div", { class: "e-top" }, h("span", { class: "av" }, (o.name || "?").trim().charAt(0).toUpperCase()),
      h("div", { class: "e-who" }, h("h3", {}, o.name), h("small", { title: o.createdAt ? new Date(o.createdAt).toLocaleString() : "" }, ago(o.createdAt))), st),
    h("div", { class: "chips" }, h("span", { class: "chip" }, money(o.total)), h("span", { class: "chip alt" }, o.phone), o.coupon ? h("span", { class: "chip alt" }, "Coupon " + o.coupon + " (-" + money(o.discount) + ")") : null, o.method === "pickup" ? h("span", { class: "chip" }, "Store pickup") : null),
    h("ul", { class: "items-l" }, its.map(i => h("li", {}, `${i.name} x${i.qty} = ${money(i.price * i.qty)}`))),
    o.address ? h("p", { class: "addr" }, "Deliver to: " + o.address) : null, o.note ? h("p", { class: "addr" }, "Note: " + o.note) : null,
    h("div", { class: "row" },
      digits.length >= 7 ? h("a", { class: "btn sm", target: "_blank", rel: "noopener", href: wa }, "Reply on WhatsApp") : null,
      h("button", { class: "btn ghost sm", onclick: () => invoice(o) }, "Print invoice"),
      h("button", { class: "btn ghost sm danger", onclick: guard(async () => { if (confirm("Delete this order?")) await fb.db.ref("shop").update({ ["orders/" + o.id]: null, ["track/" + o.id]: null }); }) }, "Delete")));
}
$("#csv").onclick = () => {
  const q = v => { v = String(v ?? ""); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
  const rows = [["Date", "Name", "Phone", "Address", "Items", "Total", "Status", "Note"], ...orders.map(o => [o.createdAt ? new Date(o.createdAt).toLocaleString() : "", o.name, o.phone, o.address, Object.values(o.items || {}).map(i => `${i.name} x${i.qty}`).join("; "), o.total, o.status, o.note])];
  h("a", { href: URL.createObjectURL(new Blob([rows.map(r => r.map(q).join(",")).join("\n")], { type: "text/csv" })), download: "orders.csv" }).click();
};

/* Reviews: approve before they show on the store */
function revCard(r, isPending) {
  const body = [h("b", {}, r.name), " ", h("span", { class: "st" }, stars(r.rating)), h("small", {}, " on " + pname(r.pid) + " | " + ago(r.createdAt)), h("p", {}, r.text)];
  return h("article", { class: "card rvc" }, ...body, h("div", { class: "row" },
    isPending ? h("button", { class: "btn sm", onclick: guard(() => fb.db.ref("shop").update({ ["reviews/" + r.pid + "/" + r.rid]: { name: r.name, rating: r.rating, text: r.text, createdAt: r.createdAt }, ["reviewsPending/" + r.pid + "/" + r.rid]: null })) }, "Approve") : null,
    h("button", { class: "btn ghost sm danger", onclick: guard(async () => { if (confirm("Delete this review?")) await fb.db.ref("shop/" + (isPending ? "reviewsPending/" : "reviews/") + r.pid + "/" + r.rid).remove(); }) }, "Delete")));
}
function renderRev() {
  const p = flat(pending).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), a = flat(reviews).sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));
  $("#rbadge").textContent = p.length; $("#rbadge").hidden = !p.length;
  $("#pendList").replaceChildren(...(p.length ? p.map(r => revCard(r, true)) : [h("p", { class: "empty" }, "Nothing waiting.")]));
  $("#pubList").replaceChildren(...(a.length ? a.map(r => revCard(r, false)) : [h("p", { class: "empty" }, "No published reviews yet.")]));
}

/* Settings: details, colour theme, store location */
const THEMES = [["sunset", "Sunset", "#FF7A18,#FF3D71,#9B5CFF"], ["neon", "Neon", "#9B5CFF,#3355FF,#00C8FF"], ["emerald", "Emerald", "#00D68F,#00B4D8,#3355FF"], ["gold", "Gold", "#F5C542,#F08A24,#E0562C"], ["ocean", "Ocean", "#00C6FF,#0072FF,#7B2FF7"]];
let theme = "sunset", pin = { lat: 0, lng: 0 };
function renderThemes() {
  $("#themes").replaceChildren(...THEMES.map(([k, l, c]) => h("button", { type: "button", class: "th" + (theme === k ? " on" : ""), "aria-pressed": String(theme === k), onclick: () => { theme = k; renderThemes(); } }, h("span", { class: "sw3", style: "background:linear-gradient(135deg," + c + ")" }), l)));
}
function renderPin() {
  $("#locNote").textContent = pin.lat && pin.lng ? "Map pin set at " + pin.lat.toFixed(5) + ", " + pin.lng.toFixed(5) + ". Customers can also see how far they are. Press Save all settings." : "No pin yet: the map will search your address. For an exact spot, stand at your shop and press the button above.";
  $("#clrLoc").hidden = !(pin.lat && pin.lng);
}
$("#useLoc").onclick = () => {
  if (!navigator.geolocation) return toast("This browser cannot share your location.");
  toast("Finding your location...");
  navigator.geolocation.getCurrentPosition(p => { pin = { lat: p.coords.latitude, lng: p.coords.longitude }; renderPin(); toast("Location captured. Press Save all settings."); }, () => toast("Location permission was not given."), { enableHighAccuracy: true, timeout: 10000 });
};
$("#clrLoc").onclick = () => { pin = { lat: 0, lng: 0 }; renderPin(); };
async function loadSettings() {
  try {
    const s = await withTimeout(ref("settings").once("value")), v = { ...DEFAULTS.settings, ...(s.val() || {}) };
    if (/x/i.test(v.whatsapp || "x")) v.whatsapp = DEFAULTS.settings.whatsapp;
    $("#sName").value = v.name; $("#sWa").value = v.whatsapp; $("#sMail").value = v.email; $("#sAnn").value = v.announce || ""; $("#sFee").value = v.deliveryFee ?? 0; $("#sFree").value = v.freeAbove ?? 0;
    $("#sAddr").value = v.addr || ""; $("#sPhone").value = v.phone || ""; $("#sMap").value = v.mapLink || ""; $("#sOpen").value = v.openAt || ""; $("#sClose").value = v.closeAt || ""; $("#sHours").value = v.hours || ""; $("#sPickup").checked = !!v.pickup;
    theme = v.theme || "sunset"; pin = { lat: +v.lat || 0, lng: +v.lng || 0 }; renderThemes(); renderPin();
  } catch (e) { toast(errText(e)); }
}
$("#saveSet").onclick = guard(async () => {
  let wa = $("#sWa").value.replace(/\D/g, ""); if (wa.length === 10) wa = "91" + wa;
  const map = $("#sMap").value.trim(); if (map && !/^https?:\/\//.test(map)) return toast("The Google Maps link must start with https://");
  await ref("settings").update({ name: $("#sName").value.trim(), whatsapp: wa, email: $("#sMail").value.trim(), announce: $("#sAnn").value.trim(), deliveryFee: parseFloat($("#sFee").value) || 0, freeAbove: parseFloat($("#sFree").value) || 0,
    theme, addr: $("#sAddr").value.trim(), phone: $("#sPhone").value.trim(), mapLink: map, hours: $("#sHours").value.trim(), openAt: $("#sOpen").value, closeAt: $("#sClose").value, lat: pin.lat, lng: pin.lng, pickup: $("#sPickup").checked });
  $("#sWa").value = wa; toast("Settings saved. Your store is updated.");
});

/* Order status: updates the customer tracking page and the stock count */
async function setStatus(o, status) {
  await fb.db.ref("shop").update({ ["orders/" + o.id + "/status"]: status, ["track/" + o.id + "/status"]: status, ["track/" + o.id + "/updatedAt"]: TS() });
  const move = async dir => {
    for (const i of Object.values(o.items || {})) {
      const p = products.find(x => x.id === i.id); if (!p || typeof p.stock !== "number") continue;
      const r = await ref("products/" + p.id + "/stock").transaction(c => typeof c === "number" ? Math.max(0, c + dir * i.qty) : c);
      if (r.snapshot.val() === 0) await ref("products/" + p.id + "/inStock").set(false);
      else if (dir > 0 && p.inStock === false) await ref("products/" + p.id + "/inStock").set(true);
    }
  };
  if (status === "confirmed" && !o.stockDone) { await move(-1); await ref("orders/" + o.id + "/stockDone").set(true); toast("Order confirmed and stock updated."); }
  else if (status === "cancelled" && o.stockDone) { await move(1); await ref("orders/" + o.id + "/stockDone").set(false); toast("Order cancelled and stock restored."); }
  else toast("Status updated. The customer sees it on their tracking page.");
}
function invoice(o) {
  const w = open("", "_blank"); if (!w) return toast("Allow pop-ups to print the invoice.");
  const d = w.document, its = Object.values(o.items || {}), cell = (t, r) => h("td", r ? { class: "r" } : {}, t);
  d.title = "Invoice " + o.id.slice(-6).toUpperCase();
  d.head.append(h("style", {}, "body{font:15px system-ui,sans-serif;margin:32px;max-width:720px;color:#111}h1{margin:0 0 4px}table{width:100%;border-collapse:collapse;margin:18px 0}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}.r{text-align:right}.t td{font-weight:700;border:0}p{margin:4px 0}"));
  d.body.append(h("h1", {}, CFG_NAME()), h("p", {}, "Invoice " + o.id.slice(-6).toUpperCase() + " | " + (o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "")),
    h("p", {}, "Bill to: " + o.name + ", " + o.phone), h("p", {}, o.method === "pickup" ? "Store pickup" : "Deliver to: " + (o.address || "")),
    h("table", {}, h("tr", {}, h("th", {}, "Item"), h("th", { class: "r" }, "Qty"), h("th", { class: "r" }, "Price"), h("th", { class: "r" }, "Amount")),
      its.map(i => h("tr", {}, cell(i.name), cell(String(i.qty), 1), cell(money(i.price), 1), cell(money(i.price * i.qty), 1))),
      o.discount ? h("tr", { class: "t" }, cell("Discount" + (o.coupon ? " (" + o.coupon + ")" : "")), cell(""), cell("", 1), cell("-" + money(o.discount), 1)) : null,
      o.delivery ? h("tr", { class: "t" }, cell("Delivery"), cell(""), cell("", 1), cell(money(o.delivery), 1)) : null,
      h("tr", { class: "t" }, cell("Total"), cell(""), cell("", 1), cell(money(o.total), 1))),
    h("p", {}, "Thank you for shopping with us."));
  setTimeout(() => w.print(), 300);
}
const CFG_NAME = () => $("#sName").value || DEFAULTS.settings.name;

/* Dashboard */
const sv = (t, a = {}, ...k) => { const e = document.createElementNS("http://www.w3.org/2000/svg", t); for (const [n, v] of Object.entries(a)) e.setAttribute(n, v); k.flat().filter(Boolean).forEach(c => e.append(c)); return e; };
function renderDash() {
  if (!$("#kpis")) return;
  const ok = orders.filter(o => o.status !== "cancelled"), rev = ok.reduce((a, o) => a + (+o.total || 0), 0), n = k => orders.filter(o => (o.status || "new") === k).length;
  const kpi = (v, l, c) => h("div", { class: "kpi " + (c || "") }, h("b", {}, String(v)), h("span", {}, l));
  $("#kpis").replaceChildren(kpi(money(rev), "Revenue (not cancelled)", "hot"), kpi(ok.length, "Orders"), kpi(n("new"), "New orders to confirm"), kpi(flat(pending).length, "Reviews to approve"));
  $("#dnote").textContent = products.length + " products in your store";
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return { k: d.toDateString(), l: d.toLocaleDateString(undefined, { weekday: "short" }), v: 0 }; });
  ok.forEach(o => { const d = days.find(x => x.k === new Date(o.createdAt || 0).toDateString()); if (d) d.v += +o.total || 0; });
  const W = 700, H = 170, bw = W / 7, max = Math.max(1, ...days.map(d => d.v));
  const svg = sv("svg", { viewBox: "0 0 " + W + " " + (H + 34), class: "chart", role: "img", "aria-label": "Sales for the last 7 days" },
    sv("defs", {}, sv("linearGradient", { id: "g", x1: 0, y1: 0, x2: 0, y2: 1 }, sv("stop", { offset: "0", "stop-color": "#9B5CFF" }), sv("stop", { offset: "1", "stop-color": "#00C8FF" }))));
  days.forEach((d, i) => { const bh = Math.round(d.v / max * H), x = i * bw + bw * .2, cx = x + bw * .3;
    svg.append(sv("rect", { x, y: H - bh, width: bw * .6, height: Math.max(bh, 3), rx: 6, fill: "url(#g)" }), sv("text", { x: cx, y: H + 22, "text-anchor": "middle", class: "cl" }, d.l));
    if (d.v) svg.append(sv("text", { x: cx, y: H - bh - 6, "text-anchor": "middle", class: "cv" }, money(d.v))); });
  $("#chart").replaceChildren(svg);
  const sold = {}; ok.forEach(o => Object.values(o.items || {}).forEach(i => sold[i.name] = (sold[i.name] || 0) + i.qty));
  const top = Object.entries(sold).sort((a, b) => b[1] - a[1]).slice(0, 5), tm = top.length ? top[0][1] : 1;
  $("#top").replaceChildren(...(top.length ? top.map(([nm, q]) => h("div", {}, h("div", { class: "lr" }, h("span", {}, nm), h("b", {}, q + " sold")), h("div", { class: "bar2", style: "width:" + Math.round(q / tm * 100) + "%" })))
    : [h("p", { class: "tiny" }, "Sales will show here once orders come in.")]));
  const low = products.filter(p => typeof p.stock === "number" && p.stock <= 5).sort((a, b) => a.stock - b.stock);
  $("#lowst").replaceChildren(...(low.length ? low.map(p => h("div", { class: "lr" }, h("span", {}, p.name), h("b", { style: p.stock ? "" : "color:#C62828" }, p.stock ? p.stock + " left" : "Sold out"))) : [h("p", { class: "tiny" }, "Nothing is running low. Add a stock count to a product to track it.")]));
  $("#recent").replaceChildren(...(orders.length ? orders.slice(0, 5).map(o => h("div", { class: "lr" }, h("span", {}, o.name + " | " + ago(o.createdAt)), h("b", {}, money(o.total) + " | " + (o.status || "new")))) : [h("p", { class: "tiny" }, "No orders yet.")]));
}

/* Coupons */
function renderCoupons() {
  $("#couList").replaceChildren(...(coupons.length ? coupons.map(c => h("article", { class: "card" }, h("h3", {}, c.code),
    h("p", { class: "tiny" }, (c.type === "percent" ? c.value + "% off" : money(c.value) + " off") + (c.min ? ", minimum order " + money(c.min) : "") + " | " + (c.active ? "Active" : "Paused")),
    h("div", { class: "row" },
      h("button", { class: "btn ghost sm", onclick: guard(() => ref("coupons/" + c.code + "/active").set(!c.active)) }, c.active ? "Pause" : "Activate"),
      h("button", { class: "btn ghost sm danger", onclick: guard(async () => { if (confirm("Delete coupon " + c.code + "?")) await ref("coupons/" + c.code).remove(); }) }, "Delete")))) : [h("p", { class: "empty card" }, "No coupons yet.")]));
}
$("#cSave").onclick = guard(async () => {
  const code = $("#cCode").value.trim().toUpperCase(), value = parseFloat($("#cVal").value), type = $("#cType").value;
  if (!/^[A-Z0-9]{3,20}$/.test(code)) return toast("Code must be 3 to 20 letters or numbers.");
  if (!(value > 0) || (type === "percent" && value > 100)) return toast("Enter a valid value.");
  await ref("coupons/" + code).set({ type, value, min: parseFloat($("#cMin").value) || 0, active: true });
  $("#cCode").value = $("#cVal").value = $("#cMin").value = ""; toast("Coupon saved. Customers can use it now.");
});
