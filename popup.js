// ── Categories (must match background.js) ────────────────────────────────────
const CATEGORIES = {
  social_media: { label:"Social Media", icon:"📱", color:"#e91e8c",
    domains:["facebook.com","instagram.com","twitter.com","x.com","tiktok.com",
      "snapchat.com","reddit.com","pinterest.com","linkedin.com","tumblr.com",
      "discord.com","whatsapp.com","telegram.org","threads.net","bereal.com","vk.com"] },
  ads_trackers: { label:"Ads & Trackers", icon:"🚫", color:"#ff6b35",
    domains:["doubleclick.net","googlesyndication.com","googleadservices.com",
      "adnxs.com","advertising.com","outbrain.com","taboola.com","revcontent.com",
      "media.net","adroll.com","criteo.com","quantserve.com","scorecardresearch.com",
      "googletagmanager.com","google-analytics.com","hotjar.com","mixpanel.com",
      "segment.com","pagead2.googlesyndication.com","ads.facebook.com"] },
  streaming: { label:"Streaming", icon:"🎬", color:"#7c3aed",
    domains:["youtube.com","youtu.be","netflix.com","twitch.tv","hulu.com",
      "disneyplus.com","primevideo.com","max.com","hbomax.com","hbo.com",
      "peacocktv.com","paramountplus.com","crunchyroll.com","funimation.com",
      "vimeo.com","dailymotion.com","rumble.com"] },
  news: { label:"News", icon:"📰", color:"#0ea5e9",
    domains:["cnn.com","foxnews.com","buzzfeed.com","dailymail.co.uk","theguardian.com",
      "huffpost.com","bbc.com","nbcnews.com","abcnews.go.com","cbsnews.com",
      "nypost.com","usatoday.com"] },
  gambling: { label:"Gambling", icon:"🎰", color:"#f59e0b",
    domains:["bet365.com","draftkings.com","fanduel.com","pokerstars.com",
      "888casino.com","betway.com","pointsbet.com","caesarssportsbook.com","bovada.lv"] },
  gaming: { label:"Gaming", icon:"🎮", color:"#10b981",
    domains:["steampowered.com","epicgames.com","roblox.com","miniclip.com",
      "kongregate.com","poki.com","friv.com","coolmathgames.com"] },
};

// ── Rule IDs: 1001-1999 preset, 6001+ custom ─────────────────────────────────
const DOMAIN_BLOCK_ID = {};
let _id = 1000;
for (const cat of Object.values(CATEGORIES))
  for (const d of cat.domains)
    if (!(d in DOMAIN_BLOCK_ID)) DOMAIN_BLOCK_ID[d] = ++_id;

const ALL_RESOURCE_TYPES = [
  "main_frame","sub_frame","stylesheet","script","image",
  "font","object","xmlhttprequest","ping","media","websocket","other",
];

// Redirect main_frame to blocked.html — synchronous & network-level, no race conditions
function makeBlockRule(id, domain, catKey) {
  return {
    id, priority:1,
    action: {
      type: "redirect",
      redirect: {
        extensionPath: `/blocked.html?domain=${encodeURIComponent(domain)}&cat=${encodeURIComponent(catKey || "custom")}`
      }
    },
    condition: { urlFilter:`||${domain}^`, resourceTypes:["main_frame"] },
  };
}

// ── Time options ──────────────────────────────────────────────────────────────
const TIME_OPTIONS = [
  { label:"15 min",  ms: 15*60*1000 },
  { label:"30 min",  ms: 30*60*1000 },
  { label:"1 hour",  ms:  1*60*60*1000 },
  { label:"2 hours", ms:  2*60*60*1000 },
  { label:"4 hours", ms:  4*60*60*1000 },
  { label:"8 hours", ms:  8*60*60*1000 },
  { label:"⚙️ Custom", ms: -2 },
  { label:"🌙 Midnight", ms: -3 },
  { label:"∞ No limit", ms: -1 },
];

// Points shop tiers: cost (pts) → minutes of break
const SHOP_TIERS = [
  { pts:5,  mins:10,  icon:"☕" },
  { pts:10, mins:20,  icon:"🎮" },
  { pts:15, mins:30,  icon:"🍿" },
  { pts:20, mins:40,  icon:"🌟" },
];

// ── Chrome API helpers ────────────────────────────────────────────────────────
async function getActiveRuleIds() {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  return new Set(rules.map(r => r.id));
}
async function applyRuleChanges(addRules, removeIds) {
  if (!addRules.length && !removeIds.length) return;
  const u = {};
  if (addRules.length)  u.addRules      = addRules;
  if (removeIds.length) u.removeRuleIds = removeIds;
  await chrome.declarativeNetRequest.updateDynamicRules(u);
}

// ── Storage ───────────────────────────────────────────────────────────────────
async function loadState() {
  return chrome.storage.local.get({
    blockedCats:[], customDomains:[], nextCustomId:6001, timers:{},
    tasks:[], points:0,
    breakActive:false, breakEndTime:null, breakSavedCats:[],
    blockStats:{}, schedules:{}, scheduledCats:[],
  });
}
async function saveState(s) { return chrome.storage.local.set(s); }

// ── Stale rule cleanup ────────────────────────────────────────────────────────
async function cleanStaleRules() {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  const staleIds = rules.filter(r => r.action.type === "redirect").map(r => r.id);
  if (staleIds.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: staleIds });
    await saveState({ blockedCats:[], customDomains:[], nextCustomId:6001, timers:{} });
    showToast("Old rules cleared — re-enable your categories");
  }
}

// ── Countdown helpers ─────────────────────────────────────────────────────────
function msLeft(endTime) { return Math.max(0, endTime - Date.now()); }

function formatMs(ms) {
  if (ms <= 0) return "Done";
  const s   = Math.floor(ms / 1000);
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2,"0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2,"0")}s`;
  return `${sec}s`;
}

function midnightMs() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()+1, 0, 0, 0).getTime() - Date.now();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = "ok") {
  const t = document.getElementById("toast");
  t.textContent = { ok:"✅ ", err:"❌ ", warn:"⏰ ", gold:"⭐ " }[type] + msg;
  t.className = "show" + (type === "err" ? " err" : type === "warn" ? " warn" : type === "gold" ? " gold" : "");
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.className = ""; }, 2800);
}

// ── Timer Modal ───────────────────────────────────────────────────────────────
let modalResolve = null;

function openTimerModal(catKey) {
  return new Promise(resolve => {
    modalResolve = resolve;
    const cat = CATEGORIES[catKey];
    const overlay = document.getElementById("timerModal");
    const emoji   = document.getElementById("modalEmoji");
    const nameEl  = document.getElementById("modalCatName");
    const grid    = document.getElementById("timeGrid");
    const lockBtn = document.getElementById("btnModalLock");

    emoji.textContent = cat.icon;
    emoji.style.setProperty("--modal-color", cat.color);
    nameEl.textContent = cat.label;

    let selectedMs = TIME_OPTIONS[2].ms;

    grid.innerHTML = "";
    TIME_OPTIONS.forEach(opt => {
      const btn = document.createElement("button");
      btn.className = "time-btn" + (opt.ms === selectedMs ? " selected" : "")
                    + (opt.ms === -1 ? " nolimit" : "");
      btn.textContent = opt.label;
      btn.addEventListener("click", () => {
        grid.querySelectorAll(".time-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedMs = opt.ms;
        document.getElementById("customDurRow").classList.toggle("show", opt.ms === -2);
        lockBtn.className = "modal-btn modal-btn-lock" + (opt.ms === -1 ? " free" : "");
        lockBtn.textContent = opt.ms === -1 ? "✅ Block (No Lock)" : "🔒 Lock It";
      });
      grid.appendChild(btn);
    });

    grid.querySelectorAll(".time-btn")[2].classList.add("selected");
    lockBtn.className = "modal-btn modal-btn-lock";
    lockBtn.textContent = "🔒 Lock It";
    overlay.classList.add("open");

    lockBtn.onclick = () => {
      let ms = selectedMs;
      if (ms === -2) {
        const val = parseInt(document.getElementById("customDurInput").value);
        if (!val || val < 1) { showToast("Enter a valid number of minutes", "err"); return; }
        ms = val * 60 * 1000;
      }
      if (ms === -3) ms = midnightMs();
      overlay.classList.remove("open");
      resolve(ms);
    };
  });
}

document.getElementById("btnModalCancel").addEventListener("click", () => {
  document.getElementById("timerModal").classList.remove("open");
  if (modalResolve) { modalResolve(null); modalResolve = null; }
});

// ── Schedule Modal ────────────────────────────────────────────────────────────
let schedResolve = null;
let schedCurrentKey = null;
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function openScheduleModal(catKey, existingSched) {
  return new Promise(resolve => {
    schedResolve = resolve;
    schedCurrentKey = catKey;
    const cat = CATEGORIES[catKey];
    document.getElementById("schedModalEmoji").textContent = cat.icon;
    document.getElementById("schedCatName").textContent = cat.label;

    const days = existingSched?.days || [1,2,3,4,5];
    const startH = existingSched?.startH ?? 9;
    const startM = existingSched?.startM ?? 0;
    const endH   = existingSched?.endH   ?? 17;
    const endM   = existingSched?.endM   ?? 0;

    document.getElementById("schedStart").value =
      String(startH).padStart(2,"0") + ":" + String(startM).padStart(2,"0");
    document.getElementById("schedEnd").value =
      String(endH).padStart(2,"0") + ":" + String(endM).padStart(2,"0");

    const dayRow = document.getElementById("dayRow");
    dayRow.innerHTML = "";
    DAY_NAMES.forEach((name, i) => {
      const btn = document.createElement("button");
      btn.className = "day-btn" + (days.includes(i) ? " sel" : "");
      btn.textContent = name;
      btn.dataset.day = i;
      btn.addEventListener("click", () => btn.classList.toggle("sel"));
      dayRow.appendChild(btn);
    });

    document.getElementById("schedModal").classList.add("open");
  });
}

document.getElementById("btnSchedCancel").addEventListener("click", () => {
  document.getElementById("schedModal").classList.remove("open");
  if (schedResolve) { schedResolve(null); schedResolve = null; }
});

document.getElementById("btnSchedSave").addEventListener("click", async () => {
  const selDays = [...document.querySelectorAll("#dayRow .day-btn.sel")]
    .map(b => parseInt(b.dataset.day));
  if (!selDays.length) { showToast("Select at least one day", "err"); return; }

  const startVal = document.getElementById("schedStart").value;
  const endVal   = document.getElementById("schedEnd").value;
  const [startH, startM] = startVal.split(":").map(Number);
  const [endH,   endM  ] = endVal.split(":").map(Number);

  if (startH * 60 + startM >= endH * 60 + endM) {
    showToast("End time must be after start time", "err"); return;
  }

  const sched = { enabled:true, days:selDays, startH, startM, endH, endM };
  document.getElementById("schedModal").classList.remove("open");
  if (schedResolve) { schedResolve(sched); schedResolve = null; }
});

// ── Render ────────────────────────────────────────────────────────────────────
const expanded = new Set();
let countdownInterval = null;

async function render() {
  const { blockedCats, customDomains, timers, points, tasks,
          breakActive, breakEndTime, blockStats, schedules, scheduledCats } = await loadState();
  const activeIds  = await getActiveRuleIds();
  const lockedCats = blockedCats.filter(k => timers[k]?.locked);

  // Stats
  document.getElementById("statRules").textContent  = activeIds.size;
  document.getElementById("statCats").textContent   = blockedCats.length;
  document.getElementById("statLocked").textContent = lockedCats.length;
  document.getElementById("statPoints").textContent = points;
  document.getElementById("pointsDisplay").textContent = points;

  // Break strip
  const breakStrip = document.getElementById("breakStrip");
  if (breakActive && breakEndTime) {
    breakStrip.classList.add("show");
    document.getElementById("breakCountdown").textContent = formatMs(msLeft(breakEndTime));
  } else {
    breakStrip.classList.remove("show");
  }

  // Focus progress table
  const focusPanel = document.getElementById("focusPanel");
  const tbody      = document.getElementById("focusTableBody");
  if (blockedCats.length) {
    focusPanel.style.display = "";
    tbody.innerHTML = "";
    blockedCats.forEach(key => {
      const cat    = CATEGORIES[key];
      if (!cat) return;
      const timer  = timers[key];
      const locked = timer?.locked && timer?.endTime;
      const sched  = scheduledCats.includes(key);
      const tr     = document.createElement("tr");
      tr.innerHTML = `
        <td><div class="td-cat">${cat.icon} ${cat.label}</div></td>
        <td>
          <span class="td-badge ${locked ? "badge-locked" : sched ? "badge-sched" : "badge-free"}">
            ${locked ? "🔒 Locked" : sched ? "📅 Scheduled" : "∞ Free"}
          </span>
        </td>
        <td class="td-countdown ${locked ? "" : "free"}" data-end="${locked ? timer.endTime : ""}">
          ${locked ? formatMs(msLeft(timer.endTime)) : "—"}
        </td>`;
      tbody.appendChild(tr);
    });
  } else {
    focusPanel.style.display = "none";
  }

  // Category cards
  const list = document.getElementById("catList");
  list.innerHTML = "";
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    const isActive   = blockedCats.includes(key);
    const timer      = timers[key];
    const isLocked   = isActive && timer?.locked && timer?.endTime && msLeft(timer.endTime) > 0;
    const isScheduled = scheduledCats.includes(key);
    const hasSched    = schedules[key]?.enabled;
    const isOpen      = expanded.has(key);

    const card = document.createElement("div");
    card.className = ["cat-card", isActive ? "active" : "", isLocked ? "locked" : ""].join(" ").trim();
    card.style.setProperty("--cat-color", cat.color);

    const tagsHtml = cat.domains
      .map(d => `<span class="domain-tag"><span class="dot"></span>${d}</span>`)
      .join("");

    const schedBtnHtml = `<button class="sched-btn ${hasSched ? "active-sched" : ""}" data-schedkey="${key}">
      ${hasSched ? "📅 Scheduled" : "📅 Schedule"}
    </button>`;

    card.innerHTML = `
      <div class="cat-header">
        <div class="cat-emoji-wrap">${cat.icon}</div>
        <div class="cat-info">
          <div class="cat-name-row">
            <span class="cat-name">${cat.label}</span>
            ${isLocked ? `<span class="lock-badge">🔒 <span class="cat-countdown" data-end="${timer.endTime}">${formatMs(msLeft(timer.endTime))}</span></span>` : ""}
            ${isScheduled && !isLocked ? `<span class="sched-badge">📅 Auto</span>` : ""}
          </div>
          <div class="cat-meta">
            <span class="cat-count">${cat.domains.length} domains</span>
            <button class="expand-btn ${isOpen ? "open" : ""}" data-key="${key}">
              ${isOpen ? "▲ Hide" : "▼ Show sites"}
            </button>
            ${schedBtnHtml}
          </div>
        </div>
        <label class="toggle ${isLocked ? "disabled" : ""}" id="toggle-${key}">
          <input type="checkbox" data-key="${key}" ${isActive ? "checked" : ""} ${isLocked ? "disabled" : ""} />
          <span class="slider"></span>
        </label>
      </div>
      <div class="domain-list ${isOpen ? "open" : ""}">
        <div class="domain-inner">${tagsHtml}</div>
      </div>
    `;

    card.querySelector(`#toggle-${key}`).addEventListener("click", e => e.stopPropagation());
    card.querySelector(".expand-btn").addEventListener("click", e => {
      e.stopPropagation();
      if (expanded.has(key)) expanded.delete(key); else expanded.add(key);
      render();
    });
    card.querySelector("input[type=checkbox]").addEventListener("change", e => {
      handleToggle(key, e.target.checked);
    });
    card.querySelector(".sched-btn").addEventListener("click", async e => {
      e.stopPropagation();
      await handleSchedule(key);
    });
    card.querySelector(".cat-header").addEventListener("click", e => {
      if (e.target.closest(".expand-btn") || e.target.closest(".toggle") || e.target.closest(".sched-btn")) return;
      const cb = card.querySelector("input[type=checkbox]");
      if (cb.disabled) {
        showToast(`${cat.label} is locked for ${formatMs(msLeft(timer.endTime))}`, "warn");
        return;
      }
      cb.checked = !cb.checked;
      handleToggle(key, cb.checked);
    });

    list.appendChild(card);
  }

  // Custom chips
  const chipList = document.getElementById("chipList");
  chipList.innerHTML = "";
  if (!customDomains.length) {
    chipList.innerHTML = '<span class="no-custom">No custom sites blocked.</span>';
  } else {
    customDomains.forEach(entry => {
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.innerHTML = `${entry.domain}<button class="chip-x" title="Unblock">✕</button>`;
      chip.querySelector(".chip-x").addEventListener("click", () => removeCustomDomain(entry.domain));
      chipList.appendChild(chip);
    });
  }

  // Tasks
  renderTasks(tasks);

  // Shop
  renderShop(points);

  startCountdown();
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
function renderTasks(tasks) {
  const list = document.getElementById("taskList");
  list.innerHTML = "";
  if (!tasks.length) {
    list.innerHTML = '<span class="no-tasks">No tasks yet — add one to earn ⭐ points!</span>';
    return;
  }
  const sorted = [...tasks].sort((a, b) => a.done - b.done);
  sorted.forEach(task => {
    const item = document.createElement("div");
    item.className = "task-item" + (task.done ? " done" : "");
    item.innerHTML = `
      <button class="task-check" data-id="${task.id}">${task.done ? "✓" : ""}</button>
      <span class="task-text">${escapeHtml(task.text)}</span>
      <button class="task-del" data-id="${task.id}" title="Delete">✕</button>
    `;
    item.querySelector(".task-check").addEventListener("click", () => toggleTask(task.id));
    item.querySelector(".task-del").addEventListener("click", () => deleteTask(task.id));
    list.appendChild(item);
  });
}

function escapeHtml(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

async function addTask() {
  const input = document.getElementById("taskInput");
  const text  = input.value.trim();
  if (!text) return;
  const { tasks, ...rest } = await loadState();
  const task = { id: Date.now(), text, done: false };
  tasks.push(task);
  await saveState({ tasks });
  input.value = "";
  showToast("Task added!", "ok");
  render();
}

async function toggleTask(id) {
  const { tasks, points } = await loadState();
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const wasNotDone = !task.done;
  task.done = !task.done;
  let newPoints = points;
  if (wasNotDone) {
    newPoints += 1;
    showToast("+1 ⭐ point earned!", "gold");
  } else {
    newPoints = Math.max(0, newPoints - 1);
    showToast("Task undone (-1 point)", "warn");
  }
  await saveState({ tasks, points: newPoints });
  render();
}

async function deleteTask(id) {
  const { tasks } = await loadState();
  const idx = tasks.findIndex(t => t.id === id);
  if (idx > -1) tasks.splice(idx, 1);
  await saveState({ tasks });
  render();
}

// ── Points Shop ───────────────────────────────────────────────────────────────
function renderShop(points) {
  const grid = document.getElementById("shopGrid");
  grid.innerHTML = "";
  SHOP_TIERS.forEach(tier => {
    const canAfford = points >= tier.pts;
    const item = document.createElement("div");
    item.className = "shop-item" + (canAfford ? "" : " locked-shop");
    item.innerHTML = `
      <div class="shop-item-icon">${tier.icon}</div>
      <div class="shop-item-mins">${tier.mins} min</div>
      <div class="shop-item-cost">${tier.pts} ⭐ pts</div>
    `;
    if (canAfford) {
      item.addEventListener("click", () => buyBreak(tier.mins, tier.pts));
    }
    grid.appendChild(item);
  });
}

async function buyBreak(minutes, cost) {
  const { points, blockedCats, customDomains, nextCustomId, timers, breakActive } = await loadState();
  if (breakActive) { showToast("Break already active!", "warn"); return; }
  if (points < cost) { showToast("Not enough points", "err"); return; }

  const newPoints  = points - cost;
  const breakEndTime = Date.now() + minutes * 60 * 1000;

  // Remove all block rules temporarily
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  if (rules.length)
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: rules.map(r => r.id) });

  // Save which cats were blocked so we can restore them
  chrome.alarms.create("break_end", { when: breakEndTime });

  await saveState({
    points: newPoints,
    breakActive: true,
    breakEndTime,
    breakSavedCats: [...blockedCats],
    // Clear blocking state during break (background will restore)
    blockedCats: [],
    timers: {},
  });

  showToast(`🎉 ${minutes}-min break! Enjoy — blocking resumes after.`, "gold");
  render();
}

// ── Schedule ──────────────────────────────────────────────────────────────────
async function handleSchedule(catKey) {
  const { schedules } = await loadState();
  const existing = schedules[catKey];
  const result = await openScheduleModal(catKey, existing);
  if (!result) return;

  const newSchedules = { ...schedules, [catKey]: result };
  await saveState({ schedules: newSchedules });
  showToast(`📅 Schedule saved for ${CATEGORIES[catKey].label}`, "ok");
  render();
}

// ── Live countdown ticker ─────────────────────────────────────────────────────
function startCountdown() {
  clearInterval(countdownInterval);
  countdownInterval = setInterval(async () => {
    const { timers, blockedCats, breakActive, breakEndTime } = await loadState();

    // Update timer countdowns
    document.querySelectorAll("[data-end]").forEach(el => {
      const end = parseInt(el.dataset.end);
      if (!end) return;
      el.textContent = msLeft(end) > 0 ? formatMs(msLeft(end)) : "Unlocking…";
    });

    // Update break countdown
    if (breakActive && breakEndTime) {
      const left = msLeft(breakEndTime);
      document.getElementById("breakCountdown").textContent = formatMs(left);
      if (left <= 0) render();
    }

    // Check for expired timed locks
    let changed = false;
    for (const key of Object.keys(timers)) {
      const t = timers[key];
      if (t.locked && t.endTime && msLeft(t.endTime) <= 0) {
        await doUnblock(key);
        changed = true;
      }
    }
    if (changed) render();
  }, 1000);
}

// ── Block / unblock logic ─────────────────────────────────────────────────────
async function handleToggle(key, enable) {
  if (enable) {
    const durationMs = await openTimerModal(key);
    if (durationMs === null) { render(); return; }
    await doBlock(key, durationMs);
  } else {
    await doUnblock(key);
  }
}

async function doBlock(key, durationMs) {
  const { blockedCats, customDomains, nextCustomId, timers } = await loadState();
  const cat       = CATEGORIES[key];
  const activeIds = await getActiveRuleIds();

  const toAdd = cat.domains
    .filter(d => !activeIds.has(DOMAIN_BLOCK_ID[d]))
    .map(d => makeBlockRule(DOMAIN_BLOCK_ID[d], d));
  await applyRuleChanges(toAdd, []);

  if (!blockedCats.includes(key)) blockedCats.push(key);

  if (durationMs === -1) {
    timers[key] = { endTime: null, locked: false };
    showToast(`${cat.label} blocked`);
  } else {
    const endTime = Date.now() + durationMs;
    timers[key] = { endTime, locked: true };
    chrome.alarms.create(`unlock_${key}`, { when: endTime });
    showToast(`${cat.icon} ${cat.label} locked for ${formatMs(durationMs)}`);
  }

  await saveState({ blockedCats, customDomains, nextCustomId, timers });
  render();
}

async function doUnblock(key) {
  const { blockedCats, customDomains, nextCustomId, timers } = await loadState();
  const cat       = CATEGORIES[key];
  const activeIds = await getActiveRuleIds();

  const toRemove = cat.domains
    .filter(d => activeIds.has(DOMAIN_BLOCK_ID[d]))
    .map(d => DOMAIN_BLOCK_ID[d]);
  await applyRuleChanges([], toRemove);

  const idx = blockedCats.indexOf(key);
  if (idx > -1) blockedCats.splice(idx, 1);
  delete timers[key];
  chrome.alarms.clear(`unlock_${key}`);

  await saveState({ blockedCats, customDomains, nextCustomId, timers });
  showToast(`${cat.label} unblocked`);
}

async function blockAll() {
  const { customDomains, nextCustomId, timers } = await loadState();
  const activeIds = await getActiveRuleIds();
  const toAdd = [];
  for (const [key, cat] of Object.entries(CATEGORIES))
    for (const d of cat.domains)
      if (!activeIds.has(DOMAIN_BLOCK_ID[d]))
        toAdd.push(makeBlockRule(DOMAIN_BLOCK_ID[d], d));
  await applyRuleChanges(toAdd, []);

  const durationMs = await openTimerModal(Object.keys(CATEGORIES)[0]);
  if (durationMs === null) return;

  const blockedCats = Object.keys(CATEGORIES);
  const endTime = durationMs === -1 ? null : Date.now() + durationMs;
  for (const key of blockedCats) {
    timers[key] = { endTime, locked: durationMs !== -1 };
    if (endTime) chrome.alarms.create(`unlock_${key}`, { when: endTime });
  }
  await saveState({ blockedCats, customDomains, nextCustomId, timers });
  showToast("All categories blocked");
  render();
}

async function removeAll() {
  const { timers } = await loadState();
  const locked = Object.entries(timers).filter(([,t]) => t.locked && t.endTime && msLeft(t.endTime) > 0);
  if (locked.length) {
    showToast(`${locked.length} category locked — wait for timer`, "warn"); return;
  }
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  if (rules.length)
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: rules.map(r => r.id) });
  await chrome.alarms.clearAll();
  await saveState({ blockedCats:[], customDomains:[], nextCustomId:6001, timers:{} });
  showToast("All blocks removed");
  render();
}

async function addCustomDomain() {
  const input = document.getElementById("domainInput");
  let domain  = input.value.trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!domain) return;

  const { blockedCats, customDomains, nextCustomId, timers } = await loadState();
  if (customDomains.some(e => e.domain === domain)) {
    showToast("Already blocked", "err"); return;
  }
  await applyRuleChanges([makeBlockRule(nextCustomId, domain)], []);
  customDomains.push({ domain, id: nextCustomId });
  await saveState({ blockedCats, customDomains, nextCustomId: nextCustomId + 1, timers });
  input.value = "";
  showToast(`${domain} blocked`);
  render();
}

async function removeCustomDomain(domain) {
  const { blockedCats, customDomains, nextCustomId, timers } = await loadState();
  const entry = customDomains.find(e => e.domain === domain);
  if (!entry) return;
  await applyRuleChanges([], [entry.id]);
  customDomains.splice(customDomains.indexOf(entry), 1);
  await saveState({ blockedCats, customDomains, nextCustomId, timers });
  showToast(`${domain} unblocked`);
  render();
}

// ── Event listeners ───────────────────────────────────────────────────────────
document.getElementById("btnAll").addEventListener("click", blockAll);
document.getElementById("btnClear").addEventListener("click", removeAll);
document.getElementById("btnAdd").addEventListener("click", addCustomDomain);
document.getElementById("domainInput").addEventListener("keydown", e => {
  if (e.key === "Enter") addCustomDomain();
});
document.getElementById("btnTaskAdd").addEventListener("click", addTask);
document.getElementById("taskInput").addEventListener("keydown", e => {
  if (e.key === "Enter") addTask();
});
document.getElementById("btnDashboard").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  await cleanStaleRules();
  render();
})();
