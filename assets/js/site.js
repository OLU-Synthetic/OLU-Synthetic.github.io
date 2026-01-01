(() => {
  // ---------- Theme (default: light editorial)
  const themeBtn = document.getElementById("themeBtn");
  const savedTheme = localStorage.getItem("theme");
  const initial = savedTheme || "light";
  document.documentElement.setAttribute("data-theme", initial);

  themeBtn?.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "light";
    const next = cur === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  });

  // ---------- Works (EDIT THESE LATER)
  const WORKS = [
    {
      title: "ATHAMAL",
      year: "2026",
      type: "loop",
      medium: "Realtime procedural loop",
      desc: "A ritual engine: slow geometry, signal, and breath. Editorial restraint, alien intent.",
      thumb: "assets/img/thumbs/athamal.jpg",
      href: "works/athamal/"
    },
    {
      title: "Tesseract_Engine",
      year: "2026",
      type: "tool",
      medium: "Realtime system / instrument",
      desc: "A hyperdimensional instrument for form, orbit, and transformation — built for gallery outputs.",
      thumb: "assets/img/thumbs/tesseract_engine.jpg",
      href: "#"
    }
  ];

  // ---------- Render featured
  const featuredCard = document.getElementById("featuredCard");
  if (featuredCard && WORKS[0]) {
    const w = WORKS[0];
    featuredCard.innerHTML = `
      <p class="muted tiny" style="margin:0 0 8px;">Featured</p>
      <h3 style="margin:0 0 6px; letter-spacing:-0.01em;">${escapeHtml(w.title)}</h3>
      <div class="workMeta" style="margin-bottom:10px;">
        <span>${escapeHtml(w.year)}</span>
        <span>•</span>
        <span>${escapeHtml(w.medium)}</span>
        <span class="tag">${escapeHtml(w.type)}</span>
      </div>
      <p class="muted" style="margin:0 0 12px; line-height:1.35;">${escapeHtml(w.desc)}</p>
      <span class="muted tiny">Add links when ready.</span>
    `;
  }

  // ---------- Render grid + filtering
  const grid = document.getElementById("worksGrid");
  const chips = [...document.querySelectorAll(".chip")];

  function render(filter) {
    if (!grid) return;
    const items = WORKS.filter(w => (filter === "all" ? true : w.type === filter));

    grid.innerHTML = items.map(w => `
      <article class="work">
        ${w.href && w.href !== "#"
          ? `<a href="${w.href}" target="_blank" rel="noreferrer" style="text-decoration:none;">${thumbHtml(w)}</a>`
          : `${thumbHtml(w)}`
        }
        <div class="workBody">
          <h3 class="workTitle">${escapeHtml(w.title)}</h3>
          <div class="workMeta">
            <span>${escapeHtml(w.year)}</span>
            <span>•</span>
            <span>${escapeHtml(w.medium)}</span>
            <span class="tag">${escapeHtml(w.type)}</span>
          </div>
          <p class="workDesc">${escapeHtml(w.desc)}</p>
        </div>
      </article>
    `).join("");
  }

  function thumbHtml(w){
    return `<img class="workThumb" src="${w.thumb}" alt="${escapeHtml(w.title)} thumbnail" loading="lazy" />`;
  }

  chips.forEach(btn => {
    btn.addEventListener("click", () => {
      chips.forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      render(btn.dataset.filter || "all");
    });
  });

  render("all");

  // ---------- Footer year
  const y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());

  // ============================================================
  // Ambient Player (Procedural warm loop) — user click required
  // ============================================================
  const toggleBtn = document.getElementById("audioToggle");
  const hint = document.getElementById("audioHint");
  const vol = document.getElementById("vol");
  const warmth = document.getElementById("warmth");
  const texture = document.getElementById("texture");

  let ctx = null;
  let master = null;

  let droneA = null, droneB = null;
  let droneGain = null;

  let noiseSrc = null;
  let noiseGain = null;

  let sat = null;
  let lp = null;
  let hs = null;

  let lfo = null;
  let lfoGain = null;

  let isOn = false;

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  function dbToGain(db){ return Math.pow(10, db / 20); }

  function makeSaturationCurve(amount){
    const n = 2048;
    const curve = new Float32Array(n);
    const k = 1 + amount * 20;
    for (let i = 0; i < n; i++){
      const x = (i * 2) / (n - 1) - 1;
      curve[i] = (1 + k) * x / (1 + k * Math.abs(x));
    }
    return curve;
  }

  function makeNoiseSource(ac){
    const bufferSize = 2 * ac.sampleRate;
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);

    // Brown-ish noise (cheap + warm)
    let last = 0;
    for (let i = 0; i < bufferSize; i++){
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }

    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  }

  function ensureGraph(){
    if (ctx) return;

    ctx = new (window.AudioContext || window.webkitAudioContext)();

    master = ctx.createGain();
    master.gain.value = 0.0;
    master.connect(ctx.destination);

    // tone chain: saturation -> lowpass -> highshelf -> master
    sat = ctx.createWaveShaper();
    sat.curve = makeSaturationCurve(0.9);
    sat.oversample = "4x";

    lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    lp.Q.value = 0.65;

    hs = ctx.createBiquadFilter();
    hs.type = "highshelf";
    hs.frequency.value = 3200;
    hs.gain.value = 0;

    sat.connect(lp);
    lp.connect(hs);
    hs.connect(master);

    // drone
    droneA = ctx.createOscillator();
    droneB = ctx.createOscillator();
    droneA.type = "sine";
    droneB.type = "sine";

    droneGain = ctx.createGain();
    droneGain.gain.value = 0.0;

    droneA.connect(droneGain);
    droneB.connect(droneGain);
    droneGain.connect(sat);

    // slow breath LFO affecting drone amplitude slightly
    lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.035; // ~28s

    lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.08;

    lfo.connect(lfoGain);
    lfoGain.connect(droneGain.gain);

    // start always-on oscillators (we’ll mute/unmute with gains)
    const baseHz = 55; // warm low A
    droneA.frequency.value = baseHz;
    droneB.frequency.value = baseHz * (1.0 + 0.0035);

    droneA.start();
    droneB.start();
    lfo.start();

    // noise sources are one-shot; created on start()
  }

  function applyParams(){
    if (!ctx || !master) return;

    const v = Number(vol?.value ?? 0.55);         // 0..1
    const w = Number(warmth?.value ?? 0);         // -12..12
    const t = Number(texture?.value ?? 0);        // -12..12

    // Volume
    const targetVol = clamp(v, 0, 1);

    // Warmth: lower cutoff + more saturation
    const w01 = (clamp(w, -12, 12) + 12) / 24;   // 0..1
    const cutoff = 900 + (1 - w01) * 2600;       // ~900..3500
    lp.frequency.setTargetAtTime(cutoff, ctx.currentTime, 0.08);
    sat.curve = makeSaturationCurve(0.65 + w01 * 0.7);

    // Texture: noise level + subtle high shelf sparkle/softness
    const t01 = (clamp(t, -12, 12) + 12) / 24;   // 0..1
    const noiseLevel = 0.012 + t01 * 0.055;      // ~0.012..0.067
    if (noiseGain) noiseGain.gain.setTargetAtTime(noiseLevel, ctx.currentTime, 0.12);

    const hsDb = (t01 - 0.5) * 6;                // -3..+3 dB
    hs.gain.setTargetAtTime(hsDb, ctx.currentTime, 0.12);

    // “On” mix levels (safe, not annoying)
    if (isOn){
      droneGain.gain.setTargetAtTime(0.08, ctx.currentTime, 0.15);
      master.gain.setTargetAtTime(targetVol, ctx.currentTime, 0.18);
    }
  }

  function setUI(on){
    if (toggleBtn) toggleBtn.textContent = on ? "Pause" : "Play";
  }

  async function startAudio(){
    ensureGraph();

    if (ctx.state === "suspended") await ctx.resume();

    // create/recreate noise each start
    if (noiseSrc){
      try { noiseSrc.stop(); } catch {}
      noiseSrc.disconnect();
      noiseSrc = null;
    }
    noiseSrc = makeNoiseSource(ctx);
    noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.02;

    noiseSrc.connect(noiseGain);
    noiseGain.connect(sat);

    noiseSrc.start();

    isOn = true;
    setUI(true);
    if (hint) hint.textContent = "Running.";

    applyParams();
  }

  function stopAudio(){
    if (!ctx) return;

    isOn = false;
    setUI(false);
    if (hint) hint.textContent = "Paused.";

    // fade out
    master.gain.setTargetAtTime(0.0, ctx.currentTime, 0.12);
    if (droneGain) droneGain.gain.setTargetAtTime(0.0, ctx.currentTime, 0.12);

    // stop noise
    if (noiseSrc){
      try { noiseSrc.stop(ctx.currentTime + 0.05); } catch {}
      try { noiseSrc.disconnect(); } catch {}
      noiseSrc = null;
    }
    if (noiseGain){
      try { noiseGain.disconnect(); } catch {}
      noiseGain = null;
    }
  }

  toggleBtn?.addEventListener("click", () => {
    if (!isOn) startAudio();
    else stopAudio();
  });

  [vol, warmth, texture].forEach(el => el?.addEventListener("input", applyParams));

  // Helpers
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }
})();

