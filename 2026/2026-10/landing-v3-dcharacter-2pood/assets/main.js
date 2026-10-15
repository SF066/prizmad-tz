(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const body = document.body;
  const nav = document.querySelector(".nav");

  // ---------- reveal on scroll ----------
  const items = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-in"));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.1 });
    items.forEach((el) => io.observe(el));
  }

  // ---------- 3D coverflow (template D) ----------
  const cf = document.getElementById("cf");
  let cfGo = null;
  let cfStop = null;
  let openShot = null;   // set by the lightbox below
  if (cf) {
    const cards = [...cf.querySelectorAll(".cf-card")];
    const dots = [...cf.querySelectorAll(".cf-dot")];
    const n = cards.length;
    let active = 0;
    let timer = null;

    const offset = (i) => {
      let d = i - active;
      if (d > n / 2) d -= n;
      if (d < -n / 2) d += n;
      return d;
    };
    const layout = () => {
      const stepX = window.innerWidth < 768 ? 58 : 64;
      cards.forEach((card, i) => {
        const d = offset(i);
        const a = Math.abs(d);
        const scale = a === 0 ? 1 : a === 1 ? 0.8 : 0.64;
        card.style.transform = `translateX(${d * stepX * (a === 2 ? 0.92 : 1)}%) translateZ(${-a * 140}px) rotateY(${-Math.sign(d) * Math.min(a, 2) * 22}deg) scale(${scale})`;
        card.style.zIndex = String(10 - a);
        card.classList.toggle("is-active", d === 0);
        card.classList.toggle("is-hidden", a > 2);
        card.tabIndex = d === 0 ? 0 : -1;
        card.setAttribute("aria-hidden", a > 2 ? "true" : "false");
      });
      dots.forEach((dot, i) => {
        dot.classList.toggle("is-active", i === active);
        dot.setAttribute("aria-current", i === active ? "true" : "false");
      });
    };
    const go = (i) => { active = ((i % n) + n) % n; layout(); };
    const stop = () => { clearInterval(timer); timer = null; };
    const start = () => {
      if (reduce || timer) return;
      timer = setInterval(() => { if (!document.hidden) go(active + 1); }, 3800);
    };
    cfGo = go;
    cfStop = stop;

    let swiped = false;
    cards.forEach((card, i) => card.addEventListener("click", () => {
      if (swiped) { swiped = false; return; }
      // a side card only rotates into the middle, the middle one opens
      if (i !== active) { stop(); go(i); }
      else if (openShot) openShot(i);
    }));
    dots.forEach((dot, i) => dot.addEventListener("click", () => { stop(); go(i); }));
    cf.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { stop(); go(active - 1); }
      if (e.key === "ArrowRight") { stop(); go(active + 1); }
    });

    let x0 = null;
    const stage = cf.querySelector(".cf-stage");
    stage.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
    stage.addEventListener("pointerup", (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) {
        swiped = true;
        setTimeout(() => { swiped = false; }, 350);
        stop(); go(active + (dx < 0 ? 1 : -1));
      }
    });
    cf.addEventListener("mouseenter", stop);
    cf.addEventListener("mouseleave", start);
    cf.addEventListener("focusin", stop);
    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0.3 }).observe(cf);
    window.addEventListener("resize", layout);
    layout();
  }

  // ---------- lightbox: any [data-lb] grows into place ----------
  const lightbox = document.getElementById("lightbox");
  const shots = [...document.querySelectorAll("[data-lb]")].sort(
    (a, b) => Number(a.dataset.lb) - Number(b.dataset.lb)
  );
  if (lightbox && shots.length) {
    const lbImg = lightbox.querySelector(".lb-img");
    const cap = lightbox.querySelector(".lb-cap");
    const n = shots.length;
    let current = 0;
    const fill = (i) => {
      current = ((i % n) + n) % n;
      const src = shots[current].querySelector("img");
      lbImg.src = src.currentSrc || src.src;
      lbImg.alt = src.alt;
      cap.textContent = shots[current].dataset.caption || "";
    };
    let openedByPointer = false;
    const open = (i) => {
      if (cfStop) cfStop();
      fill(i);
      const from = shots[i].getBoundingClientRect();
      lightbox.showModal();
      body.classList.add("is-locked");
      if (reduce) return;
      const grow = () => {
        const to = lbImg.getBoundingClientRect();
        if (!to.width) return;
        lbImg.animate([
          { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`, borderRadius: "28px" },
          { transform: "none", borderRadius: "20px" },
        ], { duration: 520, easing: "cubic-bezier(.16,1,.3,1)" });
      };
      lbImg.complete ? requestAnimationFrame(grow) : lbImg.addEventListener("load", grow, { once: true });
    };
    openShot = open;
    shots.forEach((el, i) => {
      if (el.classList.contains("cf-card")) return;   // the coverflow calls openShot itself
      el.addEventListener("pointerdown", () => { openedByPointer = true; });
      el.addEventListener("keydown", () => { openedByPointer = false; });
      el.addEventListener("click", () => open(i));
    });
    lightbox.addEventListener("close", () => {
      body.classList.remove("is-locked");
      if (cfGo) cfGo(current);
      // Keyboard users get the focus back; a mouse click should not leave a ring behind.
      if (!openedByPointer) shots[current].focus({ preventScroll: true });
    });
    lightbox.querySelector(".lb-close").addEventListener("click", () => lightbox.close());
    lightbox.addEventListener("click", (e) => { if (e.target === lightbox) lightbox.close(); });
    lightbox.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") fill(current - 1);
      if (e.key === "ArrowRight") fill(current + 1);
    });
  }

  // ---------- sample videos ----------
  document.querySelectorAll(".player").forEach((player) => {
    const video = player.querySelector("video");
    const playBtn = player.querySelector(".play");
    if (!video || !playBtn) return;
    playBtn.addEventListener("click", () => {
      // only one plays at a time
      document.querySelectorAll(".player.is-playing video").forEach((v) => {
        if (v !== video) { v.pause(); v.closest(".player").classList.remove("is-playing"); }
      });
      player.classList.add("is-playing");
      video.play().catch(() => player.classList.remove("is-playing"));
    });
  });

  // ---------- 72h offer timer: starts on the first visit, kept per landing; digits roll on change ----------
  const timers = document.querySelectorAll("[data-timer]");
  const inline = document.querySelectorAll("[data-timer-inline]");
  if (timers.length || inline.length) {
    const key = "pz-deadline-" + body.dataset.slug;
    let deadline = 0;
    try { deadline = Number(localStorage.getItem(key)) || 0; } catch (e) {}
    if (!deadline) {
      deadline = Date.now() + 72 * 3600 * 1000;
      try { localStorage.setItem(key, String(deadline)); } catch (e) {}
    }
    const pad = (n) => String(n).padStart(2, "0");
    const setDigit = (cell, ch) => {
      const cur = cell.querySelector("b");
      if (cur.textContent === ch) return;
      cur.textContent = ch;
      cur.classList.remove("in"); void cur.offsetWidth; cur.classList.add("in");
    };
    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      const s = Math.floor(left / 1000);
      const parts = { h: pad(Math.min(99, Math.floor(s / 3600))), m: pad(Math.floor(s / 60) % 60), s: pad(s % 60) };
      timers.forEach((el) => {
        for (const k of "hms") for (const i of [0, 1]) setDigit(el.querySelector(`[data-d="${k}${i}"]`), parts[k][i]);
        el.classList.toggle("is-over", left === 0);
        const bar = el.querySelector(".dt-bar i");
        if (bar) bar.style.transform = `scaleX(${left / (72 * 3600 * 1000)})`;
      });
      inline.forEach((el) => { el.textContent = `${parts.h}:${parts.m}:${parts.s}`; });
    };
    tick();
    setInterval(tick, 1000);
  }

  // ---------- work grid: muted clips play only while on screen ----------
  const clips = document.querySelectorAll(".wclip video");
  if (clips.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => entries.forEach(({ target: v, isIntersecting }) => {
      if (isIntersecting) {
        if (!v.src) v.src = v.dataset.src;
        v.play().catch(() => {});
      } else v.pause();
    }), { rootMargin: "120px" });
    clips.forEach((v) => io.observe(v));
  }

  // ---------- channels: all three present = tabs that rotate, paused on hover and after a tap ----------
  const chNav = document.querySelector(".ch-nav");
  if (chNav) {
    const tabs = [...chNav.querySelectorAll("[data-ch]")];
    const rows = [...document.querySelectorAll(".ch-rows.is-tabs > .ch-row")];
    const bars = tabs.map((t) => t.querySelector(".ch-bar i"));
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const SPAN = 7000;
    let cur = 0, timer = 0, held = false;
    const show = (i) => {
      cur = (i + tabs.length) % tabs.length;
      tabs.forEach((t, k) => t.setAttribute("aria-selected", String(k === cur)));
      rows.forEach((r, k) => r.classList.toggle("is-on", k === cur));
      // each tab has its own bar: the shown one fills over SPAN, the ones before it stay full
      bars.forEach((b, k) => { b.style.transition = "none"; b.style.transform = `scaleX(${k < cur ? 1 : 0})`; });
      chNav.offsetWidth;
      const prog = bars[cur];
      clearTimeout(timer);
      if (still || held) prog.style.transform = "scaleX(1)";
      else {
        prog.style.transition = `transform ${SPAN}ms linear`; prog.style.transform = "scaleX(1)";
        timer = setTimeout(() => show(cur + 1), SPAN);
      }
    };
    tabs.forEach((t, k) => t.addEventListener("click", () => { held = true; show(k); }));
    const box = document.querySelector(".ch-rows.is-tabs");
    box.addEventListener("mouseenter", () => { held = true; show(cur); });
    box.addEventListener("mouseleave", () => { held = false; show(cur); });
    let x0 = null;
    box.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) { held = true; show(cur + (dx < 0 ? 1 : -1)); }
    });
    show(0);
  }

  // ---------- booking popup: Cal.com inline, fallback form ----------
  const modal = document.getElementById("book");
  if (!modal) return;
  const calLink = modal.dataset.calLink;
  const calWrap = modal.querySelector(".cal-wrap");
  const form = document.getElementById("lead-form");
  const slug = body.dataset.slug;
  let calReady = false;

  const track = (name, extra) => {
    // Hook for analytics: window.dataLayer (GTM) or any listener of "prizmad:track".
    const detail = { event: name, landing: slug, ...extra };
    (window.dataLayer = window.dataLayer || []).push(detail);
    window.dispatchEvent(new CustomEvent("prizmad:track", { detail }));
  };

  const loadCal = () => {
    if (calReady) return;
    calReady = true;
    const origin = modal.dataset.calOrigin || "https://cal.com";
    // Official Cal.com embed loader
    (function (C, A, L) {
      const p = function (a, ar) { a.q.push(ar); };
      const d = C.document;
      C.Cal = C.Cal || function () {
        const cal = C.Cal; const ar = arguments;
        if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; }
        if (ar[0] === L) {
          const api = function () { p(api, arguments); };
          const namespace = ar[1]; api.q = api.q || [];
          if (typeof namespace === "string") { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ["initNamespace", namespace]); }
          else p(cal, ar);
          return;
        }
        p(cal, ar);
      };
    })(window, "https://app.cal.com/embed/embed.js", "init");

    window.Cal("init", "prizmad", { origin });
    const ns = window.Cal.ns.prizmad;
    ns("inline", {
      elementOrSelector: "#cal-inline",
      calLink,
      config: {
        layout: "month_view",
        theme: "light",
        // The video is built before the call, so the booker opens on the day after tomorrow
        ...(() => { const d = new Date(Date.now() + 2 * 864e5); const iso = d.toISOString().slice(0, 10); return { month: iso.slice(0, 7), date: iso }; })(),
        "metadata[landing]": slug,
        "metadata[brand]": body.dataset.brand,
        "metadata[page]": location.href,
        // Outreach pages know the product the scenes were built around; the booker only picks a time.
        ...(modal.dataset.prefill ? { notes: modal.dataset.prefill } : {}),
      },
    });
    ns("ui", {
      theme: "light",
      cssVarsPerTheme: { light: { "cal-brand": "#f54900" } },
      hideEventTypeDetails: false,
      layout: "month_view",
    });
    const skeleton = modal.querySelector(".cal-loading");
    const dropSkeleton = () => skeleton && skeleton.remove();
    ns("on", { action: "linkReady", callback: dropSkeleton });
    ns("on", { action: "linkFailed", callback: dropSkeleton });
    setTimeout(dropSkeleton, 10000);
    ns("on", {
      action: "bookingSuccessful",
      callback: (e) => track("booking_successful", { booking: e.detail && e.detail.data }),
    });
  };

  const open = (e) => {
    if (e) e.preventDefault();
    if (calLink) {
      calWrap.hidden = false;
      modal.classList.remove("is-form");
      loadCal();
    } else {
      form.hidden = false;
      modal.classList.add("is-form");
    }
    modal.showModal();
    body.classList.add("is-locked");
    track("booking_open");
    if (!calLink) setTimeout(() => form.elements.product.focus(), 50);
  };
  document.querySelectorAll("[data-book]").forEach((a) => a.addEventListener("click", open));
  modal.querySelector("[data-close]").addEventListener("click", () => modal.close());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });
  modal.addEventListener("close", () => body.classList.remove("is-locked"));
  if (location.hash === "#book") open();

  // Fallback form (used only while no Cal.com link is set)
  const checks = {
    product: (v) => /^https?:\/\/\S+\.\S+/i.test(v),
    messenger: (v) => v.trim().length >= 3,
  };
  const validate = (name) => {
    const input = form.elements[name];
    const ok = checks[name](input.value.trim());
    input.closest(".field").classList.toggle("invalid", !ok);
    input.setAttribute("aria-invalid", String(!ok));
    return ok;
  };
  Object.keys(checks).forEach((k) => form.elements[k].addEventListener("blur", () => {
    if (form.elements[k].value) validate(k);
  }));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (Object.keys(checks).map(validate).includes(false)) {
      form.querySelector(".field.invalid input").focus();
      return;
    }
    const data = Object.fromEntries(new FormData(form));
    data.landing = slug;
    data.page = location.href;
    const endpoint = modal.dataset.endpoint;
    const btn = form.querySelector('button[type="submit"]');

    if (!endpoint) {
      const text = `Product: ${data.product}\nFormat: ${data.format}\nMessenger: ${data.messenger}\nTime: ${data.time || "-"}\nPage: ${data.page}`;
      location.href = `mailto:${modal.dataset.mailto}?subject=${encodeURIComponent("Free ad request: " + body.dataset.brand)}&body=${encodeURIComponent(text)}`;
      modal.classList.add("is-done");
      track("form_submit", { via: "mailto" });
      return;
    }
    btn.disabled = true;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(String(res.status));
      modal.classList.add("is-done");
      track("form_submit", { via: "endpoint" });
    } catch {
      btn.disabled = false;
      alert("Could not send the form. Please try again or email " + modal.dataset.mailto);
    }
  });
})();
