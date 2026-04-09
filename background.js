// ── Categories (must match popup.js) ─────────────────────────────────────────
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

// Rule IDs (must match popup.js)
const DOMAIN_BLOCK_ID = {};
let _id = 1000;
for (const cat of Object.values(CATEGORIES))
  for (const d of cat.domains)
    if (!(d in DOMAIN_BLOCK_ID)) DOMAIN_BLOCK_ID[d] = ++_id;

const ALL_RESOURCE_TYPES = [
  "main_frame","sub_frame","stylesheet","script","image",
  "font","object","xmlhttprequest","ping","media","websocket","other",
];

// ── Setup persistent alarms ───────────────────────────────────────────────────
function setupAlarms() {
  chrome.alarms.get("schedule_check", alarm => {
    if (!alarm) chrome.alarms.create("schedule_check", { periodInMinutes: 1 });
  });
}
chrome.runtime.onInstalled.addListener(setupAlarms);
chrome.runtime.onStartup.addListener(setupAlarms);

// ── webNavigation: redirect blocked domains to blocked.html ──────────────────
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (details.url.startsWith("chrome-extension://")) return;
  if (details.url.startsWith("chrome://")) return;

  let hostname;
  try { hostname = new URL(details.url).hostname.toLowerCase(); }
  catch (e) { return; }

  const { blockedCats = [], customDomains = [], breakActive = false } =
    await chrome.storage.local.get(["blockedCats", "customDomains", "breakActive"]);

  // During a break, nothing is blocked
  if (breakActive) return;

  for (const key of blockedCats) {
    const cat = CATEGORIES[key];
    if (!cat) continue;
    for (const domain of cat.domains) {
      if (domainMatches(hostname, domain)) {
        redirectTo(details.tabId, hostname, key);
        incrementBlockStat(key);
        return;
      }
    }
  }
  for (const entry of (customDomains || [])) {
    if (domainMatches(hostname, entry.domain)) {
      redirectTo(details.tabId, hostname, "custom");
      incrementBlockStat("custom");
      return;
    }
  }
});

function domainMatches(hostname, blocked) {
  return hostname === blocked || hostname.endsWith("." + blocked);
}

function redirectTo(tabId, hostname, catKey) {
  const url = chrome.runtime.getURL("blocked.html")
    + "?domain=" + encodeURIComponent(hostname)
    + "&cat="    + encodeURIComponent(catKey);
  chrome.tabs.update(tabId, { url });
}

// ── Stats tracking ────────────────────────────────────────────────────────────
async function incrementBlockStat(catKey) {
  const today = new Date().toISOString().slice(0, 10);
  const { blockStats = {} } = await chrome.storage.local.get({ blockStats: {} });
  if (!blockStats[today]) blockStats[today] = { total: 0 };
  blockStats[today][catKey] = (blockStats[today][catKey] || 0) + 1;
  blockStats[today].total = (blockStats[today].total || 0) + 1;
  // Prune stats older than 30 days
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (const d of Object.keys(blockStats)) {
    if (d < cutoff) delete blockStats[d];
  }
  await chrome.storage.local.set({ blockStats });
}

// ── Alarms: auto-unblock, schedule check, break end ──────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "schedule_check") { await checkSchedules(); return; }
  if (alarm.name === "break_end")      { await endBreak();        return; }
  if (!alarm.name.startsWith("unlock_")) return;
  const key = alarm.name.slice(7);
  await autoUnblock(key);
});

// ── Auto-unblock when timer expires ──────────────────────────────────────────
async function autoUnblock(key) {
  const { blockedCats, customDomains, nextCustomId, timers, scheduledCats = [] } =
    await chrome.storage.local.get({
      blockedCats:[], customDomains:[], nextCustomId:6001, timers:{}, scheduledCats:[]
    });

  const cat = CATEGORIES[key];
  if (!cat) return;

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const activeIds = new Set(existing.map(r => r.id));
  const toRemove  = cat.domains
    .filter(d => activeIds.has(DOMAIN_BLOCK_ID[d]))
    .map(d => DOMAIN_BLOCK_ID[d]);
  if (toRemove.length)
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: toRemove });

  const idx = blockedCats.indexOf(key);
  if (idx > -1) blockedCats.splice(idx, 1);
  delete timers[key];

  await chrome.storage.local.set({ blockedCats, customDomains, nextCustomId, timers });
}

// ── Schedule checker (runs every minute) ─────────────────────────────────────
async function checkSchedules() {
  const {
    blockedCats, customDomains, nextCustomId, timers,
    schedules = {}, scheduledCats = [], breakActive = false
  } = await chrome.storage.local.get({
    blockedCats:[], customDomains:[], nextCustomId:6001, timers:{},
    schedules:{}, scheduledCats:[], breakActive:false
  });

  if (breakActive) return; // don't auto-block during break

  const now = new Date();
  const day = now.getDay();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  let changed = false;
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const activeIds = new Set(existing.map(r => r.id));

  for (const [key, sched] of Object.entries(schedules)) {
    if (!sched.enabled) continue;
    const startMins = sched.startH * 60 + sched.startM;
    const endMins   = sched.endH   * 60 + sched.endM;
    const inWindow  = sched.days.includes(day) && currentMins >= startMins && currentMins < endMins;
    const isBlocked  = blockedCats.includes(key);
    const isScheduled = scheduledCats.includes(key);
    const isManuallyLocked = isBlocked && timers[key]?.locked;

    if (inWindow && !isBlocked) {
      // Enable via schedule
      const cat = CATEGORIES[key];
      if (!cat) continue;
      const toAdd = cat.domains
        .filter(d => !activeIds.has(DOMAIN_BLOCK_ID[d]))
        .map(d => ({
          id: DOMAIN_BLOCK_ID[d], priority:1,
          action: { type:"block" },
          condition: { urlFilter:`||${d}^`, resourceTypes: ALL_RESOURCE_TYPES }
        }));
      if (toAdd.length) await chrome.declarativeNetRequest.updateDynamicRules({ addRules: toAdd });
      blockedCats.push(key);
      timers[key] = { endTime: null, locked: false };
      if (!scheduledCats.includes(key)) scheduledCats.push(key);
      changed = true;
    } else if (!inWindow && isScheduled && isBlocked && !isManuallyLocked) {
      // Disable via schedule end
      const cat = CATEGORIES[key];
      if (!cat) continue;
      const toRemove = cat.domains
        .filter(d => activeIds.has(DOMAIN_BLOCK_ID[d]))
        .map(d => DOMAIN_BLOCK_ID[d]);
      if (toRemove.length) await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: toRemove });
      const idx = blockedCats.indexOf(key);
      if (idx > -1) blockedCats.splice(idx, 1);
      delete timers[key];
      const si = scheduledCats.indexOf(key);
      if (si > -1) scheduledCats.splice(si, 1);
      changed = true;
    }
  }

  if (changed) await chrome.storage.local.set({ blockedCats, timers, scheduledCats });
}

// ── Break expiry: restore blocking ───────────────────────────────────────────
async function endBreak() {
  const { breakSavedCats = [], customDomains, nextCustomId, timers } =
    await chrome.storage.local.get({
      breakSavedCats:[], customDomains:[], nextCustomId:6001, timers:{}
    });

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const activeIds = new Set(existing.map(r => r.id));
  const toAdd = [];

  for (const key of breakSavedCats) {
    const cat = CATEGORIES[key];
    if (!cat) continue;
    for (const d of cat.domains) {
      if (!activeIds.has(DOMAIN_BLOCK_ID[d])) {
        toAdd.push({
          id: DOMAIN_BLOCK_ID[d], priority:1,
          action: { type:"block" },
          condition: { urlFilter:`||${d}^`, resourceTypes: ALL_RESOURCE_TYPES }
        });
      }
    }
  }
  if (toAdd.length) await chrome.declarativeNetRequest.updateDynamicRules({ addRules: toAdd });

  await chrome.storage.local.set({
    breakActive: false,
    breakEndTime: null,
    breakSavedCats: [],
    blockedCats: breakSavedCats,
  });
}
