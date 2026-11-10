const API = "https://europe-west1-ksmanagement-eba9f.cloudfunctions.net";
const root = document.documentElement;
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const lang = () => root.dataset.l;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// Język
const setLang = (l) => {
  root.dataset.l = l;
  root.lang = l;
  try { localStorage.setItem("l", l); } catch {}
  $$(".lang button").forEach((b) => { b.classList.toggle("on", b.dataset.set === l); b.setAttribute("aria-pressed", b.dataset.set === l); });
  $$("[data-ph-pl]").forEach((el) => (el.placeholder = el.dataset[l === "pl" ? "phPl" : "phEn"]));
  renderCalendar();
};
$$(".lang button").forEach((b) => b.addEventListener("click", () => {
  if (document.startViewTransition && !still) document.startViewTransition(() => setLang(b.dataset.set));
  else setLang(b.dataset.set);
}));

// Pasek u góry: tło po przewinięciu, postęp czytania, aktywna sekcja
const bar = $(".bar");
const progress = $(".progress");
const links = $$(".nav a");
const sections = links.map((a) => $(a.getAttribute("href")));
let queued = false;
const onScroll = () => {
  queued = false;
  const max = root.scrollHeight - innerHeight;
  bar.classList.toggle("solid", scrollY > innerHeight * 0.6);
  progress.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  let current = -1;
  sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top < innerHeight * 0.4) current = i; });
  links.forEach((a, i) => a.classList.toggle("on", i === current));
};
addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(onScroll); } }, { passive: true });
onScroll();

// Odsłanianie treści przy przewijaniu
const reveal = $$(".head, .gallery figure, .facts, .book, .near-list ul, .mapbox, .idea, .tabs, .tips div, .contact > *");
reveal.forEach((el) => {
  el.classList.add("rv");
  const sibs = [...el.parentElement.children].filter((c) => c.classList.contains("rv"));
  el.style.setProperty("--d", Math.min(sibs.indexOf(el) % 3, 2) * 0.09 + "s");
});
const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (!e.isIntersecting) return;
  e.target.classList.add("in");
  io.unobserve(e.target);
}), { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });
reveal.forEach((el) => io.observe(el));

// Powiększanie zdjęć z galerii
const lb = $(".lb");
const shots = $$(".gallery img");
let shot = 0;
let opener = null;
const show = (i) => { shot = (i + shots.length) % shots.length; $("img", lb).src = shots[shot].src; $("img", lb).alt = shots[shot].alt; };
const closeLb = () => { lb.classList.remove("on"); opener?.focus(); };
shots.forEach((img, i) => {
  img.tabIndex = 0;
  img.setAttribute("role", "button");
  const open = () => { opener = img; show(i); lb.classList.add("on"); $("button", lb).focus(); };
  img.addEventListener("click", open);
  img.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
});
lb.addEventListener("click", closeLb);
addEventListener("keydown", (e) => {
  if (!lb.classList.contains("on")) return;
  if (e.key === "Escape") closeLb();
  if (e.key === "ArrowRight") show(shot + 1);
  if (e.key === "ArrowLeft") show(shot - 1);
});

// Zakładki dojazdu
const tabs = $$(".tabs button");
const pick = (tab, focus) => {
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute("aria-selected", on);
    t.tabIndex = on ? 0 : -1;
    $("#" + t.getAttribute("aria-controls")).hidden = !on;
  });
  if (focus) tab.focus();
};
tabs.forEach((t, i) => {
  t.addEventListener("click", () => pick(t));
  t.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") pick(tabs[(i + 1) % tabs.length], true);
    if (e.key === "ArrowLeft") pick(tabs[(i - 1 + tabs.length) % tabs.length], true);
  });
});

// Kalendarz dostępności: zajęte noce przychodzą z serwera jako pary [przyjazd, wyjazd)
const book = $(".book");
const months = $(".months");
const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date());
let booked = null;
let offset = 0;
const MAX_OFFSET = 10;
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const isBusy = (day) => booked.some(([from, to]) => day >= from && day < to);
function renderCalendar() {
  if (!booked || !months) return;
  const locale = lang() === "pl" ? "pl-PL" : "en-GB";
  const [ty, tm] = today.split("-").map(Number);
  const words = lang() === "pl" ? { free: "wolny", busy: "zajęty" } : { free: "available", busy: "booked" };
  months.innerHTML = "";
  for (let k = 0; k < 2; k++) {
    const first = new Date(Date.UTC(ty, tm - 1 + offset + k, 1));
    const y = first.getUTCFullYear();
    const m = first.getUTCMonth();
    const box = document.createElement("div");
    box.className = "month";
    const title = document.createElement("h3");
    title.textContent = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
    const grid = document.createElement("div");
    grid.className = "days";
    for (let w = 0; w < 7; w++) {
      const wd = document.createElement("span");
      wd.className = "wd";
      wd.textContent = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + w)));
      grid.append(wd);
    }
    for (let b = 0; b < (first.getUTCDay() + 6) % 7; b++) grid.append(document.createElement("span"));
    const count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    for (let d = 1; d <= count; d++) {
      const day = iso(y, m, d);
      const cell = document.createElement("span");
      cell.textContent = d;
      if (day < today) cell.className = "past";
      else {
        const busy = isBusy(day);
        cell.className = busy ? "busy" : "free";
        cell.title = `${d}: ${busy ? words.busy : words.free}`;
      }
      grid.append(cell);
    }
    box.append(title, grid);
    months.append(box);
  }
  $("[data-cal='prev']").disabled = offset === 0;
  $("[data-cal='next']").disabled = offset >= MAX_OFFSET;
}
$$("[data-cal]").forEach((b) => b.addEventListener("click", () => {
  offset = Math.max(0, Math.min(MAX_OFFSET, offset + (b.dataset.cal === "next" ? 1 : -1)));
  renderCalendar();
}));
if (book) {
  fetch(`${API}/siteAvailability`)
    .then((r) => r.json())
    .then((data) => {
      if (!data.ready || !Array.isArray(data.booked)) return;
      booked = data.booked;
      book.dataset.state = "on";
      renderCalendar();
    })
    .catch(() => {});
}

// Formularz kontaktowy
const form = $("#contact-form");
const status = $(".status", form);
const TEXT = {
  pl: { name: "Podaj imię i nazwisko.", email: "Sprawdź adres e-mail.", message: "Napisz wiadomość, co najmniej 10 znaków.", dates: "Termin jest za długi, skróć go do 60 znaków.", sent: "Wiadomość wysłana. Odpowiemy na podany adres e-mail.", limit: "Dzisiaj wysłano już kilka wiadomości z tego adresu. Spróbuj jutro albo napisz przez Booking.com.", fail: "Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę.", sending: "Wysyłanie…" },
  en: { name: "Enter your name.", email: "Check the e-mail address.", message: "Write a message of at least 10 characters.", dates: "The dates are too long, keep them under 60 characters.", sent: "Message sent. We will reply to the e-mail address you gave.", limit: "Several messages were already sent from this address today. Try tomorrow or write via Booking.com.", fail: "The message could not be sent. Try again in a moment.", sending: "Sending…" },
};
const say = (key, kind) => { status.textContent = key ? TEXT[lang()][key] : ""; status.className = "status" + (kind ? " " + kind : ""); };
const flag = (field) => {
  $$("label", form).forEach((l) => l.classList.remove("bad"));
  if (!field || !form.elements[field]) return;
  form.elements[field].closest("label").classList.add("bad");
  form.elements[field].focus();
};
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  data.lang = lang();
  const wrong = data.name.trim().length < 2 ? "name" : !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(data.email.trim()) ? "email" : data.message.trim().length < 10 ? "message" : null;
  flag(wrong);
  if (wrong) return say(wrong, "err");
  const button = $("button[type='submit']", form);
  button.disabled = true;
  say("sending");
  try {
    const res = await fetch(`${API}/siteContact`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const out = await res.json().catch(() => ({}));
    if (res.ok && out.ok) { form.reset(); say("sent", "ok"); }
    else if (res.status === 400 && TEXT.pl[out.field]) { flag(out.field); say(out.field, "err"); }
    else say(res.status === 429 ? "limit" : "fail", "err");
  } catch {
    say("fail", "err");
  }
  button.disabled = false;
});

setLang(lang());
