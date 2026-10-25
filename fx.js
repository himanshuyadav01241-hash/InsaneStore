/* Visual effects: 3D carousel, card tilt, scroll reveal, fly-to-cart, skeletons, recently viewed. Loaded before shop.js. */
(function () {
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches, FINE = matchMedia("(hover: hover) and (pointer: fine)").matches;
  document.documentElement.classList.add("js");
  const fx = window.fx = { moved: false };
  let lastClick = null; addEventListener("click", e => { lastClick = e.target; }, true);

  /* Scroll progress, back-to-top, pointer glow */
  const sp = $("#sp"), top = $("#toTop"), hero = $(".hero");
  const onScroll = () => { const d = document.documentElement, m = d.scrollHeight - d.clientHeight; sp.style.transform = "scaleX(" + (m > 0 ? scrollY / m : 0) + ")"; top.classList.toggle("show", scrollY > 700); };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  top.onclick = () => scrollTo({ top: 0, behavior: RM ? "auto" : "smooth" });
  if (FINE && !RM) hero.addEventListener("pointermove", e => { const r = hero.getBoundingClientRect(); hero.style.setProperty("--mx", (e.clientX - r.left) + "px"); hero.style.setProperty("--my", (e.clientY - r.top) + "px"); });

  /* Loading skeletons */
  fx.skeletons = () => [...Array(8)].map(() => h("div", { class: "pc sk" }, h("div", { class: "pimg" }), h("div", { class: "pb" }, h("div", { class: "l w1" }), h("div", { class: "l w2" }))));

  /* Scroll reveal for product cards */
  const seen = new Set();
  const io = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .08 }) : null;
  fx.after = () => {
    $$("#grid .pc").forEach((c, i) => {
      const id = c.dataset.id;
      if (!id || seen.has(id) || RM || !io) return c.classList.add("in");
      seen.add(id); c.style.transitionDelay = (i % 4) * 70 + "ms"; io.observe(c);
    });
    fx.ring(); fx.recent();
  };
  setTimeout(() => $$("#grid .pc:not(.in)").forEach(c => c.classList.add("in")), 2200);

  /* 3D tilt with glare on product cards (mouse only) */
  if (FINE && !RM) {
    const g = $("#grid");
    g.addEventListener("pointermove", e => {
      const c = e.target.closest(".pc"); if (!c || c.classList.contains("sk")) return;
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.setProperty("--rx", ((.5 - y) * 10).toFixed(1) + "deg"); c.style.setProperty("--ry", ((x - .5) * 12).toFixed(1) + "deg");
      c.style.setProperty("--gx", (x * 100).toFixed(0) + "%"); c.style.setProperty("--gy", (y * 100).toFixed(0) + "%"); c.classList.add("tilt");
    });
    g.addEventListener("pointerout", e => {
      const c = e.target.closest(".pc"); if (!c || c.contains(e.relatedTarget)) return;
      c.style.removeProperty("--rx"); c.style.removeProperty("--ry"); c.classList.remove("tilt");
    });
    /* hover zoom on the product photo */
    const mb = $("#mbody");
    mb.addEventListener("pointermove", e => { const m = e.target.closest(".main"); if (!m || !m.src) return; const r = m.getBoundingClientRect(); m.style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + "% " + ((e.clientY - r.top) / r.height * 100) + "%"; m.classList.add("zoom"); });
    mb.addEventListener("pointerout", e => { const m = e.target.closest(".main"); if (m) m.classList.remove("zoom"); });
  }

  /* Fly to cart */
  const bump = () => { const c = $("#openCart"); c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump"); };
  fx.fly = () => {
    const card = lastClick && lastClick.closest ? lastClick.closest(".pc") : null;
    const src = card ? card.querySelector(".pimg img, .pimg .ph") : $("#gal .main"), cart = $("#openCart");
    if (RM || !src || !cart || !src.getBoundingClientRect().width) return bump();
    const a = src.getBoundingClientRect(), b = cart.getBoundingClientRect(), el = src.cloneNode(true);
    el.style.cssText = `position:fixed;left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px;margin:0;z-index:95;pointer-events:none;object-fit:cover;border-radius:14px;box-shadow:0 10px 40px rgb(var(--glow2) / .5)`;
    document.body.append(el);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    el.animate([{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: `translate(${dx * .45}px,${dy * .45 - 90}px) scale(.45)`, opacity: .95, offset: .45 }, { transform: `translate(${dx}px,${dy}px) scale(.05)`, opacity: .3 }],
      { duration: 750, easing: "cubic-bezier(.5,0,.3,1)" }).onfinish = () => { el.remove(); bump(); };
  };

  /* Recently viewed */
  const rd = () => { try { return JSON.parse(localStorage.getItem("insane_recent")) || []; } catch (e) { return []; } };
  fx.viewed = id => { try { localStorage.setItem("insane_recent", JSON.stringify([id, ...rd().filter(x => x !== id)].slice(0, 8))); } catch (e) {} };
  fx.recent = () => {
    const box = $("#recent"); if (!box) return;
    const list = rd().map(id => products.find(p => p.id === id)).filter(Boolean);
    $("#recentWrap").hidden = !list.length; box.replaceChildren(...list.map(card));
  };

  /* 3D product carousel: drag or swipe to spin, click to open */
  let sig = "", els = [], ang = 0, vel = 8, R = 300, step = 60, drag = null, vis = true, t0 = 0;
  const stage = $("#stage3d"), ring = $("#ring");
  const apply = () => {
    ring.style.transform = `translateZ(${-R}px) rotateX(-9deg) rotateY(${ang}deg)`;
    els.forEach((el, i) => { const rel = ((i * step + ang) % 360 + 540) % 360 - 180; el.style.opacity = (1 - Math.abs(rel) / 180 * .9).toFixed(2); });
  };
  fx.ring = () => {
    const pick = [...products].sort((a, b) => (b.badge ? 1 : 0) - (a.badge ? 1 : 0) || (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 8);
    const s = pick.map(p => p.id + "|" + p.price + "|" + (p.thumb || "").length).join(",") + "|" + (innerWidth < 600);
    if (s === sig) return; sig = s;
    stage.hidden = !pick.length; if (!pick.length) { els = []; return; }
    let list = pick; while (list.length < 6) list = list.concat(pick); list = list.slice(0, 8);
    const cw = innerWidth < 600 ? 124 : 166, n = list.length; step = 360 / n; R = Math.round(cw / 2 / Math.tan(Math.PI / n)) + 22;
    stage.style.setProperty("--cw", cw + "px");
    els = list.map((p, i) => h("button", { class: "rc", style: `transform:rotateY(${i * step}deg) translateZ(${R}px)`, "aria-label": "View " + p.name, onclick: () => { if (!fx.moved) openP(p.id); } },
      thumb(p), h("span", { class: "rn" }, p.name), h("b", {}, money(p.price))));
    ring.replaceChildren(...els); apply();
  };
  stage.addEventListener("pointerdown", e => { drag = { x: e.clientX, a: ang, lx: e.clientX, lt: performance.now(), big: false }; });
  stage.addEventListener("pointermove", e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, now = performance.now();
    if (!drag.big && Math.abs(dx) > 6) { drag.big = true; try { stage.setPointerCapture(e.pointerId); } catch (x) {} }
    if (!drag.big) return;
    ang = drag.a + dx * .4; const dt = Math.max(.008, (now - drag.lt) / 1000);
    vel = Math.max(-420, Math.min(420, (e.clientX - drag.lx) * .4 / dt)); drag.lx = e.clientX; drag.lt = now; apply();
  });
  const up = () => { if (drag && drag.big) { fx.moved = true; setTimeout(() => fx.moved = false, 80); } drag = null; };
  stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
  if ("IntersectionObserver" in window) new IntersectionObserver(es => { vis = es[0].isIntersecting; }).observe(stage);
  const base = () => RM ? 0 : 9;
  const frame = t => {
    const dt = Math.min(.05, (t - t0) / 1000 || 0); t0 = t;
    if (vis && !document.hidden && els.length && !(drag && drag.big)) { vel += (base() - vel) * (1 - Math.pow(.03, dt)); ang += vel * dt; apply(); }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();
