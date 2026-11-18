/* Time Rich Accelerator — plain JavaScript for the static HTML page. */
(function () {
  "use strict";

  /* ---- Editable settings ---- */
  var COHORT_START = new Date("2027-02-01T00:00:00"); // cohort start (visitor's local midnight)

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ICON_MENU = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-menu size-5\" aria-hidden=\"true\" data-tsd-source=\"/src/components/landing/Nav.tsx:78:50\"><path d=\"M4 5h16\"></path><path d=\"M4 12h16\"></path><path d=\"M4 19h16\"></path></svg>";
  var ICON_X = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-x size-5\" aria-hidden=\"true\" data-tsd-source=\"/src/components/landing/Nav.tsx:78:23\"><path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path></svg>";

  /* ---- Scroll reveals ---- */
  var reveals = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
  reveals.forEach(function (el) {
    var sibs = Array.prototype.filter.call(el.parentElement.children, function (c) { return c.hasAttribute("data-reveal"); });
    var i = sibs.indexOf(el);
    if (i > 0) el.style.setProperty("--reveal-delay", Math.min(i * 0.08, 0.5) + "s");
  });
  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); revealIO.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -80px 0px" });
    reveals.forEach(function (el) { revealIO.observe(el); });
  }

  /* ---- Counting numbers ---- */
  function fmt(el, v) {
    var n = Math.round(v);
    var s = el.getAttribute("data-format") === "1" ? n.toLocaleString("en-US") : String(n);
    el.textContent = (el.getAttribute("data-prefix") || "") + s + (el.getAttribute("data-suffix") || "");
  }
  var counters = Array.prototype.slice.call(document.querySelectorAll("[data-counter]"));
  if (!reduceMotion && "IntersectionObserver" in window) {
    counters.forEach(function (el) { fmt(el, 0); });
    var countIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        countIO.unobserve(e.target);
        var el = e.target, to = Number(el.getAttribute("data-to")), t0 = performance.now(), dur = 1800;
        (function step(now) {
          var p = Math.min(1, (now - t0) / dur);
          fmt(el, to * (1 - Math.pow(1 - p, 4)));
          if (p < 1) requestAnimationFrame(step);
        })(t0);
      });
    }, { rootMargin: "0px 0px -60px 0px" });
    counters.forEach(function (el) { countIO.observe(el); });
  }

  /* ---- Countdown to cohort start ---- */
  function tick() {
    var diff = Math.max(0, COHORT_START.getTime() - Date.now());
    var parts = {
      d: Math.floor(diff / 86400000),
      h: Math.floor((diff / 3600000) % 24),
      m: Math.floor((diff / 60000) % 60),
      s: Math.floor((diff / 1000) % 60)
    };
    document.querySelectorAll("[data-countdown]").forEach(function (el) {
      el.textContent = el.getAttribute("data-countdown").replace("{d}", parts.d);
    });
    document.querySelectorAll("[data-cd]").forEach(function (el) {
      el.textContent = String(parts[el.getAttribute("data-cd")]).padStart(2, "0");
    });
  }
  tick();
  setInterval(tick, 1000);

  /* ---- Header: glass effect on scroll ---- */
  var navbar = document.querySelector("[data-navbar]");
  var SCROLLED = ["glass", "border-border", "shadow-[var(--shadow-soft)]"];
  var TOP = ["border-transparent", "bg-background"];
  function onNavScroll() {
    if (!navbar) return;
    var scrolled = window.scrollY > 12;
    SCROLLED.forEach(function (c) { navbar.classList.toggle(c, scrolled); });
    TOP.forEach(function (c) { navbar.classList.toggle(c, !scrolled); });
  }

  /* ---- Mobile menu ---- */
  var toggle = document.getElementById("menu-toggle");
  var menu = document.getElementById("mobile-menu");
  function setMenu(open) {
    if (!toggle || !menu) return;
    menu.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    toggle.innerHTML = open ? ICON_X : ICON_MENU;
  }
  if (toggle && menu) {
    toggle.addEventListener("click", function () { setMenu(menu.hidden); });
    menu.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
  }

  /* ---- FAQ accordion (one open at a time) ---- */
  var faqButtons = Array.prototype.slice.call(document.querySelectorAll("[data-faq]"));
  function setItem(btn, open) {
    var item = btn.closest("h3").parentElement;
    var region = document.getElementById(btn.getAttribute("aria-controls"));
    [item, btn.closest("h3"), btn, region].forEach(function (el) { el.setAttribute("data-state", open ? "open" : "closed"); });
    btn.setAttribute("aria-expanded", String(open));
    if (open) {
      region.hidden = false;
      region.style.setProperty("--radix-accordion-content-height", region.scrollHeight + "px");
    } else if (!region.hidden) {
      region.style.setProperty("--radix-accordion-content-height", region.scrollHeight + "px");
      setTimeout(function () { if (region.getAttribute("data-state") === "closed") region.hidden = true; }, reduceMotion ? 0 : 200);
    }
  }
  faqButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var isOpen = btn.getAttribute("aria-expanded") === "true";
      faqButtons.forEach(function (b) { if (b !== btn) setItem(b, false); });
      setItem(btn, !isOpen);
    });
  });

  /* ---- "Watch Overview" video window ---- */
  var dialog = document.getElementById("overview-dialog");
  var video = dialog ? dialog.querySelector("video") : null;
  document.querySelectorAll("[data-open-overview]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (!dialog) return;
      dialog.showModal();
      if (video) { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
    });
  });
  function closeDialog() { if (dialog && dialog.open) dialog.close(); }
  if (dialog) {
    dialog.querySelector("[data-close-overview]").addEventListener("click", closeDialog);
    dialog.addEventListener("click", function (e) { if (e.target === dialog) closeDialog(); });
    dialog.addEventListener("close", function () { if (video) video.pause(); });
  }

  /* ---- Curriculum timeline progress line ---- */
  var track = document.querySelector("[data-progress-track]");
  var bar = document.querySelector("[data-progress]");
  function onProgress() {
    if (!track || !bar) return;
    var r = track.getBoundingClientRect(), vh = window.innerHeight;
    var start = r.top - vh * 0.7, end = r.bottom - vh * 0.6;
    var p = Math.min(1, Math.max(0, -start / (end - start)));
    bar.style.transform = "scaleY(" + p.toFixed(4) + ")";
  }

  /* ---- Floating join bar: after the hero, hidden near pricing & final banner ---- */
  var sticky = document.getElementById("sticky-cta");
  var visible = {};
  var pastHero = false;
  function updateSticky() {
    if (!sticky) return;
    var show = pastHero && Object.keys(visible).length === 0;
    sticky.classList.toggle("is-shown", show);
    sticky.setAttribute("aria-hidden", String(!show));
    sticky.querySelectorAll("a").forEach(function (a) { a.tabIndex = show ? 0 : -1; });
  }
  if ("IntersectionObserver" in window) {
    var stickyIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) visible[e.target.id] = true; else delete visible[e.target.id];
      });
      updateSticky();
    }, { threshold: 0.15 });
    ["pricing", "join"].forEach(function (id) { var el = document.getElementById(id); if (el) stickyIO.observe(el); });
  }

  function onScroll() {
    onNavScroll();
    onProgress();
    pastHero = window.scrollY > 760;
    updateSticky();
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onProgress);
  onScroll();
})();

/* Cohort 1 screenshot slider (added 18 Nov) */
(function () {
  var slider = document.querySelector(".tr-c1-slider");
  if (!slider) return;
  var track = slider.querySelector(".tr-c1-track");
  var slides = track.querySelectorAll(".tr-c1-slide");
  var dotsBox = slider.querySelector(".tr-c1-dots");
  var dots = [];
  function go(i) {
    i = (i + slides.length) % slides.length;
    track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
  }
  function current() { return Math.round(track.scrollLeft / track.clientWidth); }
  Array.prototype.forEach.call(slides, function (s, i) {
    var d = document.createElement("button");
    d.type = "button";
    d.setAttribute("aria-label", "Show recommendation " + (i + 1));
    d.addEventListener("click", function () { go(i); });
    dotsBox.appendChild(d);
    dots.push(d);
  });
  function mark() {
    var c = current();
    dots.forEach(function (d, i) { d.setAttribute("aria-current", i === c ? "true" : "false"); });
    if (slides[c]) track.style.height = (slides[c].offsetHeight + 34) + "px";
  }
  window.addEventListener("resize", mark);
  Array.prototype.forEach.call(track.querySelectorAll("img"), function (im) { im.addEventListener("load", mark); });
  slider.querySelectorAll(".tr-c1-btn").forEach(function (b) {
    b.addEventListener("click", function () { go(current() + Number(b.getAttribute("data-dir"))); });
  });
  track.addEventListener("scroll", function () { window.requestAnimationFrame(mark); });
  mark();
  /* Auto-advance one screenshot every 4.5s, like the original page.
     Pauses while the pointer or focus is on the slider. */
  var paused = false;
  slider.addEventListener("mouseenter", function () { paused = true; });
  slider.addEventListener("mouseleave", function () { paused = false; });
  slider.addEventListener("focusin", function () { paused = true; });
  slider.addEventListener("focusout", function () { paused = false; });
  setInterval(function () {
    if (!paused && !document.hidden) go(current() + 1);
  }, 4500);
})();

/* Testimonial carousel: arrows, dots and swipe (added 18 Nov) */
(function () {
  var root = document.getElementById("results");
  if (!root) return;
  var track = root.querySelector(".tr-ttrack");
  var dotsBox = root.querySelector(".tr-tdots");
  if (!track || !dotsBox) return;
  var slides = track.querySelectorAll(".tr-tslide");
  var prev = root.querySelector('[aria-label="Previous testimonial"]');
  var next = root.querySelector('[aria-label="Next testimonial"]');
  function step() { return slides.length > 1 ? slides[1].offsetLeft - slides[0].offsetLeft : track.clientWidth; }
  function perView() { return Math.max(1, Math.round(track.clientWidth / step())); }
  function pages() { return Math.max(1, slides.length - perView() + 1); }
  function current() { return Math.min(pages() - 1, Math.round(track.scrollLeft / step())); }
  function go(i) {
    var n = pages();
    i = (i + n) % n;
    track.scrollTo({ left: i * step(), behavior: "smooth" });
  }
  function build() {
    dotsBox.innerHTML = "";
    for (var i = 0; i < pages(); i++) {
      var d = document.createElement("button");
      d.type = "button";
      d.setAttribute("aria-label", "Go to testimonial " + (i + 1));
      d.addEventListener("click", (function (k) { return function () { go(k); }; })(i));
      dotsBox.appendChild(d);
    }
    mark();
  }
  function mark() {
    var c = current();
    Array.prototype.forEach.call(dotsBox.children, function (d, i) { d.setAttribute("aria-current", i === c ? "true" : "false"); });
  }
  if (prev) prev.addEventListener("click", function () { go(current() - 1); });
  if (next) next.addEventListener("click", function () { go(current() + 1); });
  track.addEventListener("scroll", function () { window.requestAnimationFrame(mark); });
  window.addEventListener("resize", build);
  build();
})();
