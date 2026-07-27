const STANCE = {
  bearish:   { cls: "c-bear", label: "Bearish" },
  bullish:   { cls: "c-bull", label: "Bullish" },
  neutral:   { cls: "c-neut", label: "Neutral" },
  hawkish:   { cls: "c-hawk", label: "Hawkish" },
  catalyst:  { cls: "c-hawk", label: "Catalyst" },
  developing:{ cls: "c-neut", label: "Developing" },
};
const stance = (s) => STANCE[(s || "").toLowerCase()] || { cls: "c-neut", label: (s || "Note") };
const arrow = (d) => (d === "up" ? "▲" : d === "down" ? "▼" : "■");
const dirClass = (d) => (d === "up" ? "up" : d === "down" ? "down" : "flat");

function renderTape(tape) {
  document.getElementById("tape").innerHTML = tape.map((t) =>
    `<div class="tk"><div class="n">${t.n}</div><div class="v">${t.v}</div>` +
    `<div class="c ${dirClass(t.d)}">${arrow(t.d)} ${t.c}</div></div>`
  ).join("");
}

function renderTabs(regions) {
  document.getElementById("tabs").innerHTML = regions.map((r, i) =>
    `<button class="tab ${i === 0 ? "active" : ""}" data-i="${i}">${r.code}<span class="sub">${r.name}</span></button>`
  ).join("");
}

function regionHTML(r, i) {
  const devs = (r.developments || []).map((d, n) => {
    const st = stance(d.stance);
    return `<div class="dev"><div class="rk">${String(n + 1).padStart(2, "0")}</div>` +
      `<div><h3>${d.title}<span class="chip ${st.cls}">${st.label}</span></h3><p>${d.body}</p></div></div>`;
  }).join("");

  const snap = (r.snapshot || []).map((s) =>
    `<tr><td class="asset">${s.asset}</td><td class="num">${s.level}</td>` +
    `<td class="num ${dirClass(s.d)}">${s.session}</td><td class="trend">${s.trend || ""}</td></tr>`
  ).join("");

  const cal = (r.calendar || []).map((c) =>
    `<li><span class="d">${c.date}</span><span class="e ${c.hot ? "hot" : ""}">${c.event}</span></li>`
  ).join("");

  const watch = (r.watch || []).map((w) => `<li>${w}</li>`).join("");

  return `<section class="region ${i === 0 ? "active" : ""}" data-i="${i}">
    <div class="eyebrow">${r.name} · the one line</div>
    <p class="lede">${r.lede || ""}</p>
    <p class="region-meta">${r.meta || ""}</p>
    <div class="grid">
      <div>
        <h2 class="sec">Ranked developments <span>by market impact</span></h2>
        ${devs}
        <h2 class="sec" style="margin-top:30px">Snapshot <span>${r.asOfLabel || ""}</span></h2>
        <table><thead><tr><th>Instrument</th><th>Level</th><th>Session</th><th>Trend</th></tr></thead><tbody>${snap}</tbody></table>
      </div>
      <div>
        <div class="side"><h2 class="sec">Week ahead <span>next 1–2 wks</span></h2><ul class="cal">${cal}</ul></div>
        <div class="side"><h2 class="sec">What to watch</h2><ul class="watch">${watch}</ul></div>
      </div>
    </div>
  </section>`;
}

function wireTabs() {
  document.getElementById("tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    const i = btn.dataset.i;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.i === i));
    document.querySelectorAll(".region").forEach((s) => s.classList.toggle("active", s.dataset.i === i));
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function render(data) {
  document.getElementById("edition").textContent =
    "· " + (data.marketStatus || "briefing").toLowerCase();

  document.getElementById("status-badge").innerHTML =
    `<span class="dot"></span><b>${data.marketStatus || "—"}</b>`;

  if (data.generatedAt) {
    const dt = new Date(data.generatedAt).toLocaleString("en-GB", {
      timeZone: "Europe/London", weekday: "short", day: "2-digit", month: "short",
      hour: "2-digit", minute: "2-digit",
    });
    document.getElementById("updated").textContent = "UPDATED " + dt.toUpperCase();
  }

  document.getElementById("tape-label").textContent =
    "Global tape · as of " + (data.asOf || "latest");

  renderTape(data.tape || []);
  renderTabs(data.regions || []);
  document.getElementById("panels").innerHTML = (data.regions || []).map(regionHTML).join("");
  wireTabs();
}

function errorState(msg) {
  document.getElementById("panels").innerHTML =
    `<div class="state"><div class="eyebrow">No briefing loaded</div>` +
    `<h2>Couldn't load today's briefing</h2>` +
    `<p>${msg} If you just deployed, run the <b>Daily briefing</b> workflow once from the Actions tab, then refresh.</p></div>`;
}

fetch("./data/briefing.json", { cache: "no-store" })
  .then((res) => {
    if (!res.ok) throw new Error(`Request failed (${res.status}).`);
    return res.json();
  })
  .then(render)
  .catch((err) => errorState(err.message + "."));
