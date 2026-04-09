// ── Motivational quotes ───────────────────────────────────────────────────────
const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "The successful warrior is the average man, with laser-like focus.", author: "Bruce Lee" },
  { text: "It's not about having time. It's about making time.", author: "Unknown" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "Deep work is the superpower of the 21st century.", author: "Cal Newport" },
  { text: "Your future is created by what you do today, not tomorrow.", author: "Robert Kiyosaki" },
  { text: "One hour of focused work is worth more than four hours of distracted effort.", author: "Unknown" },
  { text: "The ability to concentrate and to use time well is everything.", author: "Lee Iacocca" },
  { text: "Small disciplines repeated with consistency every day lead to great achievements.", author: "John C. Maxwell" },
  { text: "Starve your distractions. Feed your focus.", author: "Unknown" },
  { text: "You are what you repeatedly do. Excellence is not an event — it's a habit.", author: "Aristotle" },
  { text: "Lack of direction, not lack of time, is the problem.", author: "Zig Ziglar" },
  { text: "Don't count the days. Make the days count.", author: "Muhammad Ali" },
  { text: "Concentrate all your thoughts upon the work at hand.", author: "Alexander Graham Bell" },
  { text: "The more you sweat in practice, the less you bleed in battle.", author: "Unknown" },
  { text: "Energy flows where attention goes.", author: "James Redfield" },
];

let lastQuoteIdx = -1;

function loadQuote() {
  let idx;
  do { idx = Math.floor(Math.random() * QUOTES.length); } while (idx === lastQuoteIdx);
  lastQuoteIdx = idx;
  const q       = QUOTES[idx];
  const textEl   = document.getElementById("quoteText");
  const authorEl = document.getElementById("quoteAuthor");
  textEl.style.opacity = authorEl.style.opacity = "0";
  setTimeout(() => {
    textEl.textContent   = q.text;
    authorEl.textContent = q.author;
    textEl.style.transition = authorEl.style.transition = "opacity .5s";
    textEl.style.opacity = authorEl.style.opacity = "1";
  }, 200);
}

// ── Memes ─────────────────────────────────────────────────────────────────────
let lastMemeIdx = -1;

function spongebobify(text) {
  return text.split("").map((c, i) => i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()).join("");
}

function getMemes(domain) {
  const site = domain || "that site";
  return [
    `<div class="drake">
      <div class="drake-row no">
        <div class="drake-face">🙅</div>
        <div>Actually being productive and finishing my work</div>
      </div>
      <div class="drake-row yes">
        <div class="drake-face">👉😏</div>
        <div>Trying to open <strong>${site}</strong> for the 12th time today</div>
      </div>
    </div>`,

    `<div class="fine-scene">
      <div class="fine-flames">🔥🔥🔥🔥🔥🔥🔥🔥</div>
      <div class="fine-dog">🐕</div>
      <div class="fine-speech">This is fine.</div>
      <div class="fine-flames" style="margin-top:8px">🔥🔥🔥🔥🔥🔥🔥🔥</div>
      <div class="fine-caption">Me, opening ${site} right before a deadline</div>
    </div>`,

    `<div class="brain-wrap">
      <div class="brain-row">
        <div class="brain-emoji">🧠</div>
        <div class="brain-text">Checking ${site} once quickly</div>
      </div>
      <div class="brain-row">
        <div class="brain-emoji">🧠✨</div>
        <div class="brain-text">Checking ${site} just one more time</div>
      </div>
      <div class="brain-row">
        <div class="brain-emoji">🧠⚡✨</div>
        <div class="brain-text">Refreshing ${site} every 5 minutes</div>
      </div>
      <div class="brain-row">
        <div class="brain-emoji">🌌🧠💥</div>
        <div class="brain-text">Blocking ${site} and actually getting stuff done</div>
      </div>
    </div>`,

    `<div class="pikachu-wrap">
      <div class="pikachu-setup">
        <div class="pikachu-line">
          <span class="pikachu-speaker">Me:</span>
          <span>I need to focus. I'm blocking ${site} forever.</span>
        </div>
        <div class="pikachu-line">
          <span class="pikachu-speaker">Also me:</span>
          <span>*immediately tries to open ${site}*</span>
        </div>
      </div>
      <div class="pikachu-pika">😮</div>
    </div>`,

    `<div class="sponge-wrap">
      <div class="sponge-img">🧽</div>
      <div class="sponge-normal">"I'll just check ${site} for 2 minutes"</div>
      <div class="sponge-mock">${spongebobify("i'll just check " + site + " for 2 minutes")}</div>
    </div>`,

    `<div class="change-wrap">
      <div class="change-table-img">🪑</div>
      <div class="change-person">🧍</div>
      <div class="change-sign">${site} can wait.<br>Your goals cannot. 💪</div>
      <div class="change-caption">Change my mind.</div>
    </div>`,

    `<div style="padding:22px;text-align:center">
      <div style="font-size:2.2rem;margin-bottom:14px">😰</div>
      <div style="font-weight:800;font-size:.95rem;margin-bottom:18px;color:#e2e8f0">Two buttons. One choice.</div>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <div style="background:rgba(99,102,241,.15);border:2px solid #6366f1;border-radius:10px;padding:12px 20px;font-weight:700;font-size:.9rem;color:#a5b4fc">
          😤 Actually finish<br>my work
        </div>
        <div style="background:rgba(239,68,68,.15);border:2px solid #ef4444;border-radius:10px;padding:12px 20px;font-weight:700;font-size:.9rem;color:#fca5a5">
          📱 Open ${site}<br>one more time
        </div>
      </div>
      <div style="margin-top:14px;font-size:1.8rem">🔴 BLOCKED 🔴</div>
    </div>`,

    `<div style="padding:20px 22px;text-align:center">
      <div style="font-size:1rem;font-weight:700;color:#64748b;margin-bottom:16px">POV: You</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="background:rgba(99,102,241,.1);border-radius:10px;padding:10px 16px;font-size:.88rem">
          🕐 "I'll be productive after just 10 mins on ${site}"
        </div>
        <div style="font-size:1.4rem">⬇️</div>
        <div style="background:rgba(239,68,68,.1);border-radius:10px;padding:10px 16px;font-size:.88rem">
          🕓 3 hours later…
        </div>
        <div style="font-size:1.4rem">⬇️</div>
        <div style="background:rgba(34,197,94,.1);border-radius:10px;padding:10px 16px;font-size:.88rem;font-weight:700;color:#86efac">
          🛡️ FocusFlow: "Not today."
        </div>
      </div>
    </div>`,
  ];
}

function loadMeme() {
  const params = new URLSearchParams(location.search);
  const domain = params.get("domain") || "that site";
  const memes  = getMemes(domain);
  let idx;
  do { idx = Math.floor(Math.random() * memes.length); } while (idx === lastMemeIdx && memes.length > 1);
  lastMemeIdx = idx;
  const card = document.getElementById("memeCard");
  card.style.opacity   = "0";
  card.style.transform = "scale(.97)";
  setTimeout(() => {
    card.innerHTML = memes[idx];
    card.style.transition = "opacity .35s, transform .35s";
    card.style.opacity    = "1";
    card.style.transform  = "scale(1)";
  }, 180);
}

// ── Parse URL params & init page ──────────────────────────────────────────────
function init() {
  const params = new URLSearchParams(location.search);
  const domain = params.get("domain");
  const cat    = params.get("cat");

  if (domain) {
    document.getElementById("domainLabel").textContent = domain;
    document.title = "Blocked \u2014 " + domain;
  }

  const CAT_LABELS = {
    social_media: "📱 Social Media",
    ads_trackers: "🚫 Ads & Trackers",
    streaming:    "🎬 Streaming",
    news:         "📰 News",
    gambling:     "🎰 Gambling",
    gaming:       "🎮 Gaming",
    custom:       "✏️ Custom Block",
  };
  if (cat && CAT_LABELS[cat]) {
    document.getElementById("catBadge").textContent = CAT_LABELS[cat];
  }

  loadQuote();
  loadMeme();
  loadTimeSaved();
}

function loadTimeSaved() {
  chrome.storage.local.get({ blockStats: {}, tasks: [], points: 0 }, ({ blockStats, tasks, points }) => {
    const today = new Date().toISOString().slice(0, 10);
    const count  = blockStats[today]?.total || 0;
    const mins   = count * 2; // ~2 min saved per blocked attempt
    const strip  = document.getElementById("savedStrip");
    const label  = document.getElementById("savedLabel");
    if (mins > 0 || points > 0 || tasks.filter(t => t.done).length > 0) {
      const parts = [];
      if (mins > 0) parts.push(`~${mins} min saved today`);
      if (points > 0) parts.push(`${points} ⭐ pts`);
      const done = tasks.filter(t => t.done).length;
      if (done > 0) parts.push(`${done} task${done > 1 ? "s" : ""} done`);
      label.textContent = parts.join(" · ");
      strip.classList.add("show");
    }
  });
}

// ── Particle canvas ───────────────────────────────────────────────────────────
(function () {
  const canvas = document.getElementById("canvas");
  const ctx    = canvas.getContext("2d");
  let W, H;
  const particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  function rand(a, b) { return a + Math.random() * (b - a); }

  for (let i = 0; i < 60; i++) {
    particles.push({
      x: rand(0, W), y: rand(0, H),
      r: rand(0.5, 2.2),
      vx: rand(-0.15, 0.15), vy: rand(-0.25, -0.05),
      alpha: rand(0.1, 0.5),
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.y < -4) { p.y = H + 4; p.x = rand(0, W); }
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(180,180,255," + p.alpha + ")";
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

// ── Focus streak timer (25 min Pomodoro) ─────────────────────────────────────
(function () {
  const GOAL   = 25 * 60;
  const start  = Date.now();
  const timeEl = document.getElementById("focusTime");
  const barEl  = document.getElementById("focusBar");

  function tick() {
    const elapsed = Math.floor((Date.now() - start) / 1000);
    const capped  = Math.min(elapsed, GOAL);
    const m = String(Math.floor(capped / 60)).padStart(2, "0");
    const s = String(capped % 60).padStart(2, "0");
    timeEl.textContent = m + ":" + s;
    barEl.style.width  = (capped / GOAL * 100) + "%";
    if (elapsed < GOAL) setTimeout(tick, 1000);
    else timeEl.textContent = "✓ Done!";
  }
  tick();
})();

// ── Button event listeners ────────────────────────────────────────────────────
document.getElementById("btnBack").addEventListener("click", function () {
  if (history.length > 1) {
    history.back();
  } else {
    // No history — open new tab instead of getting stuck
    chrome.tabs.update({ url: "chrome://newtab" });
  }
});

document.getElementById("btnNewQuote").addEventListener("click", loadQuote);
document.getElementById("btnNewMeme").addEventListener("click", loadMeme);

init();
