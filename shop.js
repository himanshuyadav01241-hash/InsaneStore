const CFG = { ...DEFAULTS.settings };
const BASE_TITLE = document.title;
let products = [], reviews = {}, loaded = false, shown = null, done = null, rv = 5, qtyN = 1, coupon = null, cmsg = "";
const filter = { q: "", cat: "", sort: "new" };
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
let cart = load("insane_cart", {}), wish = load("insane_wish", []), mine = load("insane_orders", []);
let co = { name: "", phone: "", address: "", note: "", ...load("insane_co", {}) };
const saveCo = () => save("insane_co", { name: co.name, phone: co.phone, address: co.address });
const hue = s => [...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
const phStyle = n => `background:linear-gradient(135deg,hsl(${hue(n)} 70% 62%),hsl(${(hue(n) + 50) % 360} 70% 50%))`;
const ph = p => h("div", { class: "ph", style: phStyle(p.name) }, String(p.name).charAt(0).toUpperCase());
const thumb = p => safeImg(p.thumb) ? h("img", { src: safeImg(p.thumb), alt: p.name, loading: "lazy" }) : ph(p);
const stats = id => { const r = Object.values(reviews[id] || {}); const c = r.length; return { c, avg: c ? r.reduce((a, x) => a + (+x.rating || 0), 0) / c : 0 }; };
const hasStock = p => typeof p.stock === "number";
const soldOut = p => p.inStock === false || (hasStock(p) && p.stock <= 0);
const maxQ = p => hasStock(p) ? Math.max(0, Math.min(99, p.stock)) : 99;
const lowText = p => hasStock(p) && p.stock > 0 && p.stock <= 5 ? "Only " + p.stock + " left" : "";
const waLink = t => "https://wa.me/" + CFG.whatsapp + (t ? "?text=" + encodeURIComponent(t) : "");
let tt; const toast = m => { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 2200); };
const lock = () => document.body.classList.toggle("lock", ["#modal", "#trk", "#ov2"].some(s => !$(s).hidden));
$("#year").textContent = new Date().getFullYear();
if ("serviceWorker" in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(() => {});

/* Saved items */
function toggleWish(id) { wish = wish.includes(id) ? wish.filter(x => x !== id) : [...wish, id]; save("insane_wish", wish); render(); }

/* Product grid */
function card(p) {
  const s = stats(p.id), out = soldOut(p), off = p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0, saved = wish.includes(p.id), low = lowText(p);
  return h("article", { class: "pc", "data-id": p.id },
    h("div", { class: "pw" },
      h("button", { class: "pimg", onclick: () => openP(p.id), "aria-label": "View " + p.name }, thumb(p),
        h("span", { class: "tags" }, out ? h("span", { class: "oos" }, "Out of stock") : p.badge ? h("span", { class: "bdg" }, p.badge) : null, off && !out ? h("span", { class: "off" }, "-" + off + "%") : null)),
      h("button", { class: "heart" + (saved ? " on" : ""), "aria-label": (saved ? "Remove from" : "Save to") + " wishlist: " + p.name, "aria-pressed": String(saved), onclick: () => toggleWish(p.id) }, "♥")),
    h("div", { class: "pb" },
      h("h3", {}, h("button", { class: "lnk", onclick: () => openP(p.id) }, p.name)),
      s.c ? h("div", { class: "rt" }, h("span", { class: "st", "aria-label": s.avg.toFixed(1) + " out of 5" }, stars(s.avg)), h("small", {}, "(" + s.c + ")")) : h("div", { class: "rt" }, "No reviews yet"),
      h("div", { class: "pr" }, h("b", {}, money(p.price)), off ? h("s", {}, money(p.oldPrice)) : null),
      low ? h("small", { class: "low" }, low) : null,
      h("button", { class: "btn sm add", disabled: out, onclick: () => add(p.id) }, out ? "Unavailable" : "Add to cart")));
}
function render() {
  const cats = [...new Set(products.map(p => p.category).filter(Boolean))], saved = products.filter(p => wish.includes(p.id)).length;
  const chip = (k, l) => h("button", { class: "chip" + (filter.cat === k ? " on" : ""), onclick: () => { filter.cat = k; render(); } }, l);
  $("#cats").replaceChildren(...[chip("", "All"), saved ? chip("__saved", "♥ Saved (" + saved + ")") : null, ...cats.map(c => chip(c, c))].filter(Boolean));
  const list = products.filter(p => (!filter.cat || (filter.cat === "__saved" ? wish.includes(p.id) : p.category === filter.cat)) && (!filter.q || (p.name + " " + (p.category || "") + " " + (p.desc || "")).toLowerCase().includes(filter.q)));
  const by = { new: (a, b) => (b.createdAt || 0) - (a.createdAt || 0), low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price, rated: (a, b) => stats(b.id).avg - stats(a.id).avg || stats(b.id).c - stats(a.id).c };
  list.sort(by[filter.sort]);
  $("#grid").replaceChildren(...(list.length ? list.map(card) : (loaded ? [h("p", { class: "empty" }, products.length ? "No products match your search." : "New products are coming soon.")] : fx.skeletons())));
  $("#count").textContent = loaded && list.length ? list.length + (list.length === 1 ? " product" : " products") : "";
  fx.after();
  cartUI();
}
$("#q").oninput = e => { filter.q = e.target.value.trim().toLowerCase(); render(); };
$("#sort").onchange = e => { filter.sort = e.target.value; render(); };

/* Product details */
function openP(id) { history.pushState(null, "", "#p-" + id); sync(); }
function closeP() { history.replaceState(null, "", location.pathname + location.search); sync(); }
function sync() {
  const m = location.hash.match(/^#p-(.+)$/);
  if (m && products.find(p => p.id === m[1])) { if (shown !== m[1]) show(m[1]); }
  else if (shown || !$("#modal").hidden) { shown = null; $("#modal").hidden = true; document.title = BASE_TITLE; const l = $("#ld"); if (l) l.remove(); lock(); }
}
addEventListener("popstate", sync);
$("#closeM").onclick = closeP;
$("#modal").onclick = e => { if (e.target.id === "modal") closeP(); };
function gallery(p, arr) {
  const g = $("#gal"); if (!g) return;
  const t = safeImg(p.thumb);
  const main = arr.length || t ? h("img", { class: "main", src: arr[0] || t, alt: p.name }) : h("div", { class: "main phm", style: phStyle(p.name) }, String(p.name).charAt(0).toUpperCase());
  const th = arr.length > 1 ? h("div", { class: "thumbs" }, arr.map((s, i) => h("button", { class: i ? "" : "on", "aria-label": "Photo " + (i + 1), onclick: () => { main.src = s; [...th.children].forEach((b, j) => b.classList.toggle("on", j === i)); } }, h("img", { src: s, alt: "" })))) : null;
  g.replaceChildren(...[main, th].filter(Boolean));
}
function show(id) {
  const p = products.find(x => x.id === id); if (!p) return;
  shown = id; rv = 5; qtyN = 1; fx.viewed(id); const out = soldOut(p), low = lowText(p), url = location.href.split("#")[0] + "#p-" + id;
  const qv = h("span", {}, "1");
  const buy = h("div", { class: "buy" },
    out ? null : h("div", { class: "qty" }, h("button", { "aria-label": "Less", onclick: () => { qtyN = Math.max(1, qtyN - 1); qv.textContent = qtyN; } }, "−"), qv, h("button", { "aria-label": "More", onclick: () => { qtyN = Math.min(maxQ(p), qtyN + 1); qv.textContent = qtyN; } }, "+")),
    h("button", { class: "btn", disabled: out, onclick: () => add(id, qtyN) }, out ? "Out of stock" : "Add to cart"),
    h("a", { class: "btn ghost", target: "_blank", rel: "noopener", href: waLink("Hi, I have a question about " + p.name) }, "Ask on WhatsApp"));
  const heart = h("button", { class: "btn ghost sm", onclick: () => { toggleWish(id); heart.textContent = wish.includes(id) ? "♥ Saved" : "♡ Save"; } }, wish.includes(id) ? "♥ Saved" : "♡ Save");
  const shareB = h("button", { class: "btn ghost sm", onclick: async () => { try { if (navigator.share) await navigator.share({ title: p.name, url }); else { await navigator.clipboard.writeText(url); toast("Link copied"); } } catch (e) {} } }, "Share");
  const info = h("div", { class: "info" }, h("div", { class: "tagrow" }, p.category ? h("span", { class: "cat" }, p.category) : null, p.badge ? h("span", { class: "cat hot" }, p.badge) : null), h("h2", {}, p.name), h("div", { class: "rt", id: "srt" }),
    h("div", { class: "big" }, money(p.price), p.oldPrice > p.price ? h("s", {}, money(p.oldPrice)) : null),
    h("div", { class: "stock " + (out ? "out" : "in") }, out ? "Out of stock" : low || "In stock"),
    p.desc ? h("p", { class: "desc" }, p.desc) : null, buy, h("div", { class: "row2" }, heart, shareB));
  const rel = products.filter(x => x.id !== id && p.category && x.category === p.category).slice(0, 6);
  $("#mbody").replaceChildren(...[h("div", { class: "pd" }, h("div", { class: "gal", id: "gal" }), info), reviewSection(id),
    rel.length ? h("div", { class: "revs" }, h("h3", {}, "You may also like"), h("div", { class: "rel" }, rel.map(card))) : null].filter(Boolean));
  gallery(p, []); renderReviews();
  document.title = p.name + " | INSANE Store";
  const ld = $("#ld") || h("script", { id: "ld", type: "application/ld+json" }); document.head.append(ld);
  ld.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "Product", name: p.name, description: p.desc || p.name, category: p.category || undefined, offers: { "@type": "Offer", priceCurrency: "INR", price: p.price, availability: out ? "https://schema.org/OutOfStock" : "https://schema.org/InStock" } });
  $("#modal").hidden = false; $(".sheet").scrollTop = 0; lock();
  if (fb) ref("productPhotos/" + id).once("value").then(s => { if (shown !== id) return; const arr = Object.values(s.val() || {}).map(safeImg).filter(Boolean); if (arr.length) gallery(p, arr); }).catch(() => {});
}
function renderReviews() {
  if (!shown || !$("#revlist")) return;
  const list = Object.values(reviews[shown] || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), s = stats(shown);
  $("#srt").replaceChildren(...(s.c ? [h("span", { class: "st" }, stars(s.avg)), h("span", {}, s.avg.toFixed(1) + " (" + s.c + (s.c === 1 ? " review)" : " reviews)"))] : ["No reviews yet"]));
  $("#revlist").replaceChildren(...(list.length ? list.map(r => h("div", { class: "rv" }, h("b", {}, r.name), h("span", { class: "st" }, stars(r.rating)), h("small", {}, " " + ago(r.createdAt)), h("p", {}, r.text))) : [h("p", { class: "msg" }, "Be the first to review this product.")]));
}
function reviewSection(id) {
  const pick = h("div", { class: "pick", role: "group", "aria-label": "Your rating" }), paint = () => [...pick.children].forEach((b, i) => b.classList.toggle("on", i < rv));
  for (let i = 1; i <= 5; i++) pick.append(h("button", { type: "button", "aria-label": i + " stars", onclick: () => { rv = i; paint(); } }, "★"));
  paint();
  const nm = h("input", { required: true, maxlength: 60, autocomplete: "name" }), tx = h("textarea", { required: true, rows: 3, maxlength: 1000 }), msg = h("p", { class: "msg", role: "status" });
  const btn = h("button", { class: "btn sm", type: "submit" }, "Submit review");
  const form = h("form", { class: "rform" }, h("h4", {}, "Write a review"), pick, h("label", { class: "f" }, "Your name", nm), h("label", { class: "f" }, "Your review", tx), btn, msg);
  form.onsubmit = async e => {
    e.preventDefault(); btn.disabled = true;
    try {
      if (!fb) throw new Error("offline");
      await withTimeout(ref("reviewsPending/" + id).push().set({ name: nm.value.trim(), rating: rv, text: tx.value.trim(), createdAt: TS() }), 8000);
      form.reset(); rv = 5; paint(); msg.textContent = "Thank you! Your review will appear after approval.";
    } catch (err) { console.error(err); msg.textContent = "Could not send your review. Please try again."; }
    btn.disabled = false;
  };
  return h("div", { class: "revs" }, h("h3", {}, "Reviews"), h("div", { id: "revlist" }), form);
}

/* Cart, coupons and checkout */
const items = () => Object.entries(cart).map(([id, q]) => ({ p: products.find(x => x.id === id), q })).filter(x => x.p);
function totals(it) {
  const sub = it.reduce((a, x) => a + x.p.price * x.q, 0);
  let disc = 0; if (coupon && sub >= (coupon.min || 0)) disc = coupon.type === "percent" ? Math.round(sub * Math.min(100, coupon.value) / 100) : Math.min(coupon.value, sub);
  const after = sub - disc, fee = (+CFG.freeAbove > 0 && after >= +CFG.freeAbove) || !it.length ? 0 : (+CFG.deliveryFee || 0);
  return { sub, disc, after, fee, total: after + fee };
}
function add(id, q = 1) {
  const p = products.find(x => x.id === id); if (!p || soldOut(p)) return;
  const n = Math.min(maxQ(p), (cart[id] || 0) + q); if (n === (cart[id] || 0)) return toast("That is all we have in stock");
  cart[id] = n; save("insane_cart", cart); cartUI(); toast("Added to cart"); fx.fly();
}
function setQ(id, q) { const p = products.find(x => x.id === id); if (q <= 0) delete cart[id]; else cart[id] = Math.min(p ? maxQ(p) : 99, q); save("insane_cart", cart); cartUI(); }
function cartUI() {
  const n = items().reduce((a, x) => a + x.q, 0);
  $("#cn").textContent = n; $("#cn").hidden = !n;
  if (loaded) renderCart();
}
function openCart() { $("#drawer").classList.add("open"); $("#ov2").hidden = false; lock(); }
function closeCart() { $("#drawer").classList.remove("open"); $("#ov2").hidden = true; if (done && !items().length) done = null; lock(); renderCart(); }
$("#openCart").onclick = openCart; $("#closeC").onclick = closeCart; $("#ov2").onclick = closeCart;
addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if ($("#drawer").classList.contains("open")) closeCart(); else if (!$("#trk").hidden) closeTrack(); else if (shown) closeP();
});
async function applyCoupon(raw) {
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(code)) { cmsg = "Enter a valid code."; return renderCart(); }
  try {
    if (!fb) throw new Error("offline");
    const c = (await withTimeout(ref("coupons/" + code).once("value"), 6000)).val(), sub = totals(items()).sub;
    if (!c || !c.active) { coupon = null; cmsg = "This code is not valid."; }
    else if (sub < (c.min || 0)) { coupon = null; cmsg = "Add items worth " + money(c.min) + " to use this code."; }
    else { coupon = { code, ...c }; cmsg = "Code applied: " + (c.type === "percent" ? c.value + "% off" : money(c.value) + " off"); }
  } catch (e) { cmsg = "Could not check the code. Try again."; }
  renderCart();
}
function renderCart() {
  const body = $("#dbody"), it = items(), a = document.activeElement;
  if (a && body.contains(a) && /^(INPUT|TEXTAREA)$/.test(a.tagName)) return;
  if (done) return body.replaceChildren(done);
  if (!it.length) return body.replaceChildren(h("p", { class: "empty" }, "Your cart is empty."));
  const t = totals(it), line = (l, v, c) => h("div", { class: "ln " + (c || "") }, h("span", {}, l), h("span", {}, v));
  const field = (label, key, at = {}) => { const i = h(at.rows ? "textarea" : "input", { ...at, oninput: e => { co[key] = e.target.value; saveCo(); } }); i.value = co[key]; return h("label", { class: "f" }, label, i); };
  const cin = h("input", { placeholder: "Coupon code", maxlength: 20, "aria-label": "Coupon code" }); cin.value = coupon ? coupon.code : "";
  const cbox = h("div", { class: "cpn" }, h("div", { class: "crow" }, cin, h("button", { class: "btn ghost sm", type: "button", onclick: () => applyCoupon(cin.value) }, coupon ? "Change" : "Apply")), cmsg ? h("p", { class: "msg" }, cmsg) : null);
  const btn = h("button", { class: "btn", type: "submit" }, "Place order");
  const form = h("form", { class: "co" }, field("Your name", "name", { required: true, maxlength: 100, autocomplete: "name" }), field("Phone number", "phone", { required: true, maxlength: 20, type: "tel", autocomplete: "tel", inputmode: "tel" }),
    field("Delivery address", "address", { required: true, rows: 3, maxlength: 500 }), field("Note (optional)", "note", { rows: 2, maxlength: 500 }), btn,
    h("p", { class: "msg" }, "Your order is saved and sent to me. I confirm it with you on WhatsApp."));
  form.onsubmit = async e => { e.preventDefault(); btn.disabled = true; btn.textContent = "Placing order..."; await place(it, t); };
  const need = +CFG.freeAbove > 0 && t.fee > 0 ? +CFG.freeAbove - t.after : 0;
  body.replaceChildren(...[...it.map(({ p, q }) => h("div", { class: "ci" }, h("div", { class: "t" }, thumb(p)),
    h("div", {}, h("h4", {}, p.name), h("small", {}, money(p.price)),
      h("div", { class: "qty" }, h("button", { "aria-label": "Less", onclick: () => setQ(p.id, q - 1) }, "−"), h("span", {}, String(q)), h("button", { "aria-label": "More", onclick: () => setQ(p.id, q + 1) }, "+"))),
    h("div", { class: "lt" }, money(p.price * q), h("br"), h("button", { class: "rm", onclick: () => setQ(p.id, 0) }, "Remove")))),
    need > 0 ? h("p", { class: "free" }, "Add " + money(need) + " more for free delivery") : null, cbox,
    h("div", { class: "sum" }, line("Subtotal", money(t.sub)), t.disc ? line("Discount (" + coupon.code + ")", "-" + money(t.disc), "disc") : null, line("Delivery", t.fee ? money(t.fee) : "Free"),
      h("div", { class: "total" }, h("span", {}, "Total"), h("span", {}, money(t.total)))), form].filter(Boolean));
}
async function place(it, t) {
  const order = { name: co.name.trim(), phone: co.phone.trim(), address: co.address.trim(), note: co.note.trim(), subtotal: t.sub, discount: t.disc, delivery: t.fee, total: t.total, status: "new", createdAt: TS(),
    items: it.map(x => ({ id: x.p.id, name: x.p.name, price: Number(x.p.price), qty: x.q })) };
  if (coupon && t.disc) order.coupon = coupon.code;
  const text = `New order from ${order.name} (${order.phone})\n` + it.map((x, i) => `${i + 1}. ${x.p.name} x${x.q} = ${money(x.p.price * x.q)}`).join("\n") + (t.disc ? `\nDiscount: -${money(t.disc)}` : "") + `\nDelivery: ${t.fee ? money(t.fee) : "Free"}\nTotal: ${money(t.total)}\nAddress: ${order.address}` + (order.note ? `\nNote: ${order.note}` : "");
  let saved = true, id = "";
  try {
    if (!fb) throw new Error("offline");
    id = ref("orders").push().key;
    await withTimeout(fb.db.ref("shop").update({ ["orders/" + id]: order, ["track/" + id]: { status: "new", createdAt: TS(), total: t.total } }), 8000);
  } catch (err) { saved = false; console.error(err); }
  if (saved) { mine = [id, ...mine].slice(0, 20); save("insane_orders", mine); cart = {}; save("insane_cart", cart); co.note = ""; coupon = null; cmsg = ""; }
  done = h("div", { class: "okbox" }, h("h3", {}, saved ? "Order received" : "Almost done"),
    h("p", {}, saved ? "Thank you! Tap below to send your order on WhatsApp so I can confirm it." : "Your order could not be saved online. Please send it on WhatsApp to place it."),
    h("a", { class: "btn", href: waLink(text), target: "_blank", rel: "noopener" }, "Send order on WhatsApp"),
    saved ? h("button", { class: "btn ghost", onclick: () => { done = null; closeCart(); openTrack(); } }, "Track this order") : null,
    saved ? h("small", { class: "oid" }, "Order ID: " + id) : null,
    h("button", { class: "btn ghost", onclick: () => { done = null; closeCart(); } }, "Continue shopping"));
  cartUI();
}

/* Order tracking: works with the order IDs saved on this device, or any ID typed in */
const STEPS = ["Placed", "Confirmed", "Delivered"], IDX = { new: 0, confirmed: 1, delivered: 2 };
function trackCard(id, d) {
  const cancelled = d.status === "cancelled", i = IDX[d.status] ?? 0;
  return h("div", { class: "tc" }, h("div", { class: "tch" }, h("b", {}, "Order " + id.slice(-6).toUpperCase()), h("small", {}, new Date(d.createdAt).toLocaleDateString() + " | " + money(d.total))),
    cancelled ? h("p", { class: "canc" }, "This order was cancelled.") : h("div", { class: "ts" }, STEPS.map((s, k) => h("span", { class: k <= i ? "on" : "" }, s))),
    d.msg ? h("p", { class: "msg" }, d.msg) : null);
}
async function renderTrack(extra) {
  const box = $("#tres"); box.replaceChildren(h("p", { class: "msg" }, "Loading..."));
  const ids = [...new Set([...(extra ? [extra] : []), ...mine])];
  if (!fb || !ids.length) return box.replaceChildren(h("p", { class: "empty" }, ids.length ? "Tracking needs the live store." : "No orders on this device yet. Enter an order ID above."));
  const res = await Promise.all(ids.map(id => withTimeout(ref("track/" + id).once("value"), 6000).then(s => ({ id, d: s.val() })).catch(() => ({ id, d: null }))));
  const ok = res.filter(r => r.d).sort((a, b) => b.d.createdAt - a.d.createdAt);
  box.replaceChildren(...(ok.length ? ok.map(r => trackCard(r.id, r.d)) : [h("p", { class: "empty" }, extra ? "We could not find that order ID." : "No orders found.")]));
}
function openTrack() {
  const inp = h("input", { placeholder: "Order ID", "aria-label": "Order ID", maxlength: 40 });
  $("#tbody").replaceChildren(h("h3", { class: "th" }, "Track your order"), h("form", { class: "crow", onsubmit: e => { e.preventDefault(); if (inp.value.trim()) renderTrack(inp.value.trim()); } }, inp, h("button", { class: "btn sm", type: "submit" }, "Track")), h("div", { id: "tres", class: "tres" }));
  $("#trk").hidden = false; lock(); renderTrack();
}
function closeTrack() { $("#trk").hidden = true; lock(); }
$("#openTrack").onclick = $("#heroTrack").onclick = openTrack; $("#closeT").onclick = closeTrack; $("#trk").onclick = e => { if (e.target.id === "trk") closeTrack(); };

/* Live data: changes made in the admin panel show here instantly */
function applyCfg() {
  $$("[data-wa]").forEach(a => a.href = waLink());
  const an = $("#ann"); an.textContent = CFG.announce || ""; an.hidden = !CFG.announce;
}
if (!fb) { products = DEFAULTS.products.map((p, i) => ({ id: "s" + i, createdAt: Date.now() - i, ...p })); loaded = true; applyCfg(); render(); }
else {
  applyCfg(); render();
  ref("settings").on("value", s => { Object.assign(CFG, DEFAULTS.settings, s.val() || {}); if (/x/i.test(CFG.whatsapp || "x")) CFG.whatsapp = DEFAULTS.settings.whatsapp; applyCfg(); cartUI(); });
  ref("products").on("value", s => { products = toList(s.val()); loaded = true; render(); sync(); }, e => { console.warn(e); loaded = true; render(); });
  ref("reviews").on("value", s => { reviews = s.val() || {}; render(); renderReviews(); });
}
