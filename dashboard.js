const CATEGORIES = {
  social_media: { label:"Social Media",  icon:"📱", color:"#e91e8c" },
  ads_trackers: { label:"Ads & Trackers", icon:"🚫", color:"#ff6b35" },
  streaming:    { label:"Streaming",     icon:"🎬", color:"#7c3aed" },
  news:         { label:"News",          icon:"📰", color:"#0ea5e9" },
  gambling:     { label:"Gambling",      icon:"🎰", color:"#f59e0b" },
  gaming:       { label:"Gaming",        icon:"🎮", color:"#10b981" },
};

const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAY_FULL  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// ── Load everything from storage and render ───────────────────────────────────
chrome.storage.local.get({
  blockStats: {},
  tasks: [],
  points: 0,
  schedules: {},
}, render);

function render({ blockStats, tasks, points, schedules }) {

  // ── Build 7-day date array ─────────────────────────────────────────────────
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    days.push(d.toISOString().slice(0, 10));
  }

  // ── Week totals ────────────────────────────────────────────────────────────
  const weekBlocks  = days.reduce((sum, d) => sum + (blockStats[d]?.total || 0), 0);
  const timeSaved   = weekBlocks * 2;
  const tasksDone   = tasks.filter(t => t.done).length;

  document.getElementById("statWeekBlocks").textContent = weekBlocks;
  document.getElementById("statTimeSaved").textContent  = timeSaved + "m";
  document.getElementById("statPoints").textContent     = points;
  document.getElementById("statTasksDone").textContent  = tasksDone;

  // ── 7-day chart ────────────────────────────────────────────────────────────
  drawChart(days, blockStats);

  // ── Category breakdown ─────────────────────────────────────────────────────
  const totals = {};
  for (const d of days) {
    const s = blockStats[d] || {};
    for (const [k, v] of Object.entries(s)) {
      if (k === "total") continue;
      totals[k] = (totals[k] || 0) + v;
    }
  }
  const maxTotal = Math.max(1, ...Object.values(totals));
  const grid = document.getElementById("breakdownGrid");
  grid.innerHTML = "";

  const catKeys = Object.keys(CATEGORIES);
  const sorted  = catKeys.sort((a, b) => (totals[b] || 0) - (totals[a] || 0));

  let anyData = false;
  sorted.forEach(key => {
    const cat   = CATEGORIES[key];
    const count = totals[key] || 0;
    if (!count && !anyData) return; // skip empties initially unless nothing else
    if (count > 0) anyData = true;
    const pct = (count / maxTotal * 100).toFixed(1);
    const row = document.createElement("div");
    row.className = "breakdown-row";
    row.innerHTML = `
      <span class="breakdown-icon">${cat.icon}</span>
      <span class="breakdown-name">${cat.label}</span>
      <div class="breakdown-bar-wrap">
        <div class="breakdown-bar" style="width:${pct}%;background:${cat.color};"></div>
      </div>
      <span class="breakdown-count">${count}</span>
    `;
    grid.appendChild(row);
  });

  if (!anyData) {
    grid.innerHTML = '<div class="empty">No blocks recorded yet this week.</div>';
  } else {
    // Show zeros too
    sorted.forEach(key => {
      const count = totals[key] || 0;
      if (count > 0) return; // already shown
      const cat = CATEGORIES[key];
      const row = document.createElement("div");
      row.className = "breakdown-row";
      row.innerHTML = `
        <span class="breakdown-icon">${cat.icon}</span>
        <span class="breakdown-name">${cat.label}</span>
        <div class="breakdown-bar-wrap">
          <div class="breakdown-bar" style="width:0%;background:${cat.color};"></div>
        </div>
        <span class="breakdown-count" style="color:var(--muted)">0</span>
      `;
      grid.appendChild(row);
    });
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────
  document.getElementById("tsTotal").textContent  = tasks.length;
  document.getElementById("tsDone").textContent   = tasksDone;
  document.getElementById("tsPoints").textContent = points;

  const taskListEl = document.getElementById("taskListFull");
  taskListEl.innerHTML = "";
  if (!tasks.length) {
    taskListEl.innerHTML = '<div class="empty">No tasks yet — add them in the extension popup.</div>';
  } else {
    const sorted = [...tasks].sort((a, b) => a.done - b.done);
    sorted.forEach(t => {
      const row = document.createElement("div");
      row.className = "task-row" + (t.done ? " done" : "");
      row.innerHTML = `
        <span class="task-check-icon">${t.done ? "✅" : "⬜"}</span>
        <span class="task-row-text">${escHtml(t.text)}</span>
        ${t.done ? '<span class="task-pts">+1 ⭐</span>' : ""}
      `;
      taskListEl.appendChild(row);
    });
  }

  // ── Schedules ──────────────────────────────────────────────────────────────
  const schedGrid = document.getElementById("schedGrid");
  schedGrid.innerHTML = "";
  const schedEntries = Object.entries(schedules).filter(([,s]) => s && s.enabled !== undefined);

  if (!schedEntries.length) {
    schedGrid.innerHTML = '<div class="empty">No schedules set — click 📅 Schedule on any category in the popup.</div>';
  } else {
    schedEntries.forEach(([key, sched]) => {
      const cat = CATEGORIES[key];
      if (!cat) return;
      const startStr = pad(sched.startH) + ":" + pad(sched.startM);
      const endStr   = pad(sched.endH)   + ":" + pad(sched.endM);
      const dayChips = sched.days.map(d =>
        `<span class="sched-day-chip">${DAY_NAMES[d]}</span>`).join("");

      // Check if currently in window
      const now = new Date();
      const curDay  = now.getDay();
      const curMins = now.getHours() * 60 + now.getMinutes();
      const startMins = sched.startH * 60 + sched.startM;
      const endMins   = sched.endH   * 60 + sched.endM;
      const active = sched.days.includes(curDay) && curMins >= startMins && curMins < endMins;

      const row = document.createElement("div");
      row.className = "sched-row";
      row.innerHTML = `
        <span class="sched-icon">${cat.icon}</span>
        <div class="sched-info">
          <div class="sched-name">${cat.label}</div>
          <div class="sched-time">⏰ ${startStr} – ${endStr}</div>
          <div class="sched-days">${dayChips}</div>
        </div>
        <span class="sched-status ${sched.enabled ? (active ? "sched-on" : "sched-off") : "sched-off"}">
          ${sched.enabled ? (active ? "🟢 Active now" : "⏸ Waiting") : "Off"}
        </span>
      `;
      schedGrid.appendChild(row);
    });
  }
}

// ── Chart ─────────────────────────────────────────────────────────────────────
function drawChart(days, blockStats) {
  const canvas = document.getElementById("blockChart");
  const dpr    = window.devicePixelRatio || 1;
  const cssW   = canvas.parentElement.clientWidth - 48;
  const cssH   = 180;
  canvas.style.width  = cssW + "px";
  canvas.style.height = cssH + "px";
  canvas.width  = cssW * dpr;
  canvas.height = cssH * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const counts = days.map(d => blockStats[d]?.total || 0);
  const maxVal = Math.max(1, ...counts);

  const paddingL = 36;
  const paddingR = 12;
  const paddingT = 12;
  const paddingB = 36;
  const chartW   = cssW - paddingL - paddingR;
  const chartH   = cssH - paddingT - paddingB;
  const barW     = Math.floor(chartW / days.length) - 6;
  const gap      = Math.floor(chartW / days.length);

  // Gridlines
  ctx.strokeStyle = "rgba(42,48,80,.6)";
  ctx.lineWidth = 1;
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = paddingT + chartH - (i / gridLines) * chartH;
    ctx.beginPath();
    ctx.moveTo(paddingL, y);
    ctx.lineTo(paddingL + chartW, y);
    ctx.stroke();

    // Y-axis labels
    const val = Math.round((i / gridLines) * maxVal);
    ctx.fillStyle = "rgba(100,116,139,.8)";
    ctx.font = `${10 * dpr / dpr}px Segoe UI, system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(val, paddingL - 6, y + 3.5);
  }

  // Bars
  const today = new Date().toISOString().slice(0, 10);
  days.forEach((d, i) => {
    const count  = counts[i];
    const x      = paddingL + i * gap + (gap - barW) / 2;
    const barH   = count > 0 ? Math.max(4, (count / maxVal) * chartH) : 0;
    const y      = paddingT + chartH - barH;
    const isToday = d === today;

    // Bar gradient
    const grad = ctx.createLinearGradient(x, y, x, y + barH);
    if (isToday) {
      grad.addColorStop(0, "#f472b6");
      grad.addColorStop(1, "#a855f7");
    } else {
      grad.addColorStop(0, "#818cf8");
      grad.addColorStop(1, "#6366f1");
    }

    ctx.fillStyle = grad;
    const radius = Math.min(5, barH / 2);
    if (barH > 0) {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + barW - radius, y);
      ctx.arcTo(x + barW, y, x + barW, y + radius, radius);
      ctx.lineTo(x + barW, y + barH);
      ctx.lineTo(x, y + barH);
      ctx.arcTo(x, y, x + radius, y, radius);
      ctx.closePath();
      ctx.fill();
    } else {
      // Zero bar — just a thin line
      ctx.fillStyle = "rgba(42,48,80,.6)";
      ctx.fillRect(x, paddingT + chartH - 2, barW, 2);
    }

    // Count label on top
    if (count > 0) {
      ctx.fillStyle = isToday ? "#f9a8d4" : "#a5b4fc";
      ctx.font = "bold 10px Segoe UI, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(count, x + barW / 2, y - 5);
    }

    // Day label
    const dayName = DAY_NAMES[new Date(d + "T12:00:00").getDay()];
    ctx.fillStyle = isToday ? "#e2e8f0" : "rgba(100,116,139,.8)";
    ctx.font = (isToday ? "bold " : "") + "10px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(isToday ? "Today" : dayName, x + barW / 2, paddingT + chartH + 18);
  });

  // Legend
  const legend = document.getElementById("chartLegend");
  legend.innerHTML = `
    <div class="legend-item"><div class="legend-dot" style="background:#818cf8"></div>Past days</div>
    <div class="legend-item"><div class="legend-dot" style="background:#f472b6"></div>Today</div>
    <div class="legend-item" style="color:#e2e8f0">Total: <strong>${counts.reduce((a,b)=>a+b,0)}</strong> blocks → ~<strong>${counts.reduce((a,b)=>a+b,0)*2}</strong> min saved</div>
  `;
}

function pad(n) { return String(n).padStart(2, "0"); }
function escHtml(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
