(() => {
  // ========= Theme (default dark; remembers choice) =========
  const themeBtn = document.getElementById("themeBtn");
  const savedTheme = localStorage.getItem("theme");
  const initialTheme = savedTheme || "dark";
  document.documentElement.setAttribute("data-theme", initialTheme);

  themeBtn?.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  });

  // ========= Works =========
  const WORKS = [
    {
      title: "ATHAMAL",
      year: "2026",
      type: "loop",
      medium: "Realtime procedural toy",
      desc: "A ritual engine: slow geometry, signal, and breath. Editorial restraint, alien intent.",
      href: "works/athamal/",
      preview: "assets/video/athamal_preview.webm",
      poster: "assets/img/thumbs/athamal.jpg"
    },
    {
      title: "Tesseract_Engine",
      year: "2026",
      type: "tool",
      medium: "Realtime instrument",
      desc: "Hyperdimensional instrument for form, orbit, and transformation — built for gallery outputs.",
      href: "works/athamal/", // TODO: change later to works/tesseract_engine/
      preview: "assets/video/tesseract_preview.webm",
      poster: "assets/img/thumbs/tesseract_engine.jpg"
    }
  ];

  // ========= Featured card =========
  const featuredCard = document.getElementById("featuredCard");
  if (featuredCard && WORKS[0]) {
    const w = WORKS[0];
    featuredCard.innerHTML = `
      <p style="margin:0 0 8px;opacity:.75;font-size:12px;letter-spacing:.14em;text-transform:uppercase">Featured</p>
      <h3 style="margin:0 0 6px; letter-spacing:-0.01em;">${escapeHtml(w.title)}</h3>
      <div style="display:flex;gap:10px;flex-wrap:wrap;opacity:.75;font-size:13px;margin-bottom:10px">
        <span>${escapeHtml(w.year)}</span>
        <span>•</span>
        <span>${escapeHtml(w.medium)}</span>
        <span style="border:1px solid var(--line);padding:2px 8px;border-radius:999px;font-size:12px">${escapeHtml(w.type)}</span>
      </div>
      <p style="margin:0 0 12px;opacity:.75;line-height:1.35;">${escapeHtml(w.desc)}</p>
      <a href="${w.href}" style="display:inline-block;border:1px solid var(--line);padding:8px 12px;border-radius:999px;text-decoration:none">Open runtime ↗</a>
    `;
  }

  // ========= Works grid =========
  const grid = document.getElementById("worksGrid");
  if (grid) {
    grid.innerHTML = WORKS.map(w => `
      <a class="work" href="${w.href}">
        <video class="workPreview" autoplay loop muted playsinline preload="metadata"
          src="${w.preview}" poster="${w.poster || ""}"></video>
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
      </a>
    `).join("");
  }

  // ========= Footer year =========
  const y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());

  // ==========================================================
  // PROCEDURAL AUDIO: warm ambient + subtle space
  // - starts on first gesture (scroll/click/touch/wheel/keydown)
  // - play/pause icon + one slim volume slider
  // ==========================================================
  const audioBtn = document.getElementById("audioBtn");
  const audioIcon = document.getElementById("audioIcon");
  const vol = document.getElementById("vol");

  // default volume low
  const savedVol = localStorage.getItem("vol");
  if (savedVol !== null && vol) vol.value = String(clamp(Number(savedVol), 0, 1));
  if (vol && savedVol === null) vol.value = "0.10";

  let ctx = null;
  let master = null;

  // main shaping
  let sat = null;
  let lp = null;

  // space (gentle delay network)
  let delay = null;
  let fb = null;
  let fbLP = null;
  let wet = null;

  // sources
  let droneGain = null;
  let noiseGain = null;

  let oscA = null, oscB = null, oscC = null;
  let noiseSrc = null;

  // LFO for slow movement
  let lfo = null;
  let lfoGain = null;

  let isOn = false;
  let armed = true;
  let driftTimer = null;

  function setIcon(on){
    if (!audioIcon) return;
    audioIcon.innerHTML = on
      ? `<path d="M7 5h4v14H7zM13 5h4v14h-4z"></path>` // pause
      : `<path d="M8 5v14l12-7z"></path>`;           // play
  }

  function applyVolume(){
    const v = clamp(Number(vol?.value ?? 0.10), 0, 1);
    localStorage.setItem("vol", String(v));
    if (master && ctx) master.gain.setTargetAtTime(v, ctx.currentTime, 0.08);
  }
  vol?.addEventListener("input", applyVolume);

  async function ensureAudio(){
    if (ctx) return;

    ctx = new (window.AudioContext || window.webkitAudioContext)();

    // try resume now; still must be triggered by gesture in some cases
    if (ctx.state === "suspended") {
      try { await ctx.resume(); } catch {}
    }

    master = ctx.createGain();
    master.gain.value = 0.0;
    master.connect(ctx.destination);

    sat = ctx.createWaveShaper();
    sat.curve = makeSaturationCurve(0.85);
    sat.oversample = "4x";

    lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    lp.Q.value = 0.65;

    // subtle “space”: low feedback, filtered loop
    delay = ctx.createDelay(1.2);
    delay.delayTime.value = 0.24;

    fb = ctx.createGain();
    fb.gain.value = 0.18;

    fbLP = ctx.createBiquadFilter();
    fbLP.type = "lowpass";
    fbLP.frequency.value = 1600;
    fbLP.Q.value = 0.6;

    wet = ctx.createGain();
    wet.gain.value = 0.22;

    // Routing:
    // drone+noise -> sat -> lp -> dry to master, and also to delay -> wet -> master
    sat.connect(lp);
    lp.connect(master);
    lp.connect(delay);

    delay.connect(wet);
    wet.connect(master);

    // feedback: delay -> fbLP -> fb -> delay
    delay.connect(fbLP);
    fbLP.connect(fb);
    fb.connect(delay);

    // gains
    droneGain = ctx.createGain();
    droneGain.gain.value = 0.0;
    droneGain.connect(sat);

    noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.0;
    noiseGain.connect(sat);

    // drones
    const base = 55; // warm low register
    oscA = ctx.createOscillator();
    oscB = ctx.createOscillator();
    oscC = ctx.createOscillator();

    oscA.type = "sine";
    oscB.type = "triangle";
    oscC.type = "sine";

    oscA.frequency.value = base;
    oscB.frequency.value = base * 1.5; // fifth
    oscC.frequency.value = base * 2.0; // octave

    oscA.detune.value = -6;
    oscB.detune.value = +4;
    oscC.detune.value = +9;

    const mixA = ctx.createGain(); mixA.gain.value = 0.55;
    const mixB = ctx.createGain(); mixB.gain.value = 0.28;
    const mixC = ctx.createGain(); mixC.gain.value = 0.18;

    oscA.connect(mixA); mixA.connect(droneGain);
    oscB.connect(mixB); mixB.connect(droneGain);
    oscC.connect(mixC); mixC.connect(droneGain);

    oscA.start(); oscB.start(); oscC.start();

    // noise
    noiseSrc = makeNoise(ctx);
    noiseSrc.connect(noiseGain);
    noiseSrc.start();

    // slow movement (filter cutoff)
    lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.03; // ~33s
    lfoGain = ctx.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain);
    lfoGain.connect(lp.frequency);
    lfo.start();

    applyVolume();
  }

  function makeNoise(ac){
    const bufferSize = 2 * ac.sampleRate;
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);

    let last = 0;
    for (let i = 0; i < bufferSize; i++){
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 2.6;
    }

    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  }

  function makeSaturationCurve(amount){
    const n = 2048;
    const curve = new Float32Array(n);
    const k = 1 + amount * 18;
    for (let i = 0; i < n; i++){
      const x = (i * 2) / (n - 1) - 1;
      curve[i] = (1 + k) * x / (1 + k * Math.abs(x));
    }
    return curve;
  }

  async function startAudio(){
    await ensureAudio();
    if (ctx && ctx.state === "suspended") {
      try { await ctx.resume(); } catch (e) { console.warn("Audio resume failed", e); }
    }

    isOn = true;
    setIcon(true);

    const now = ctx.currentTime;
    const v = clamp(Number(vol?.value ?? 0.10), 0, 1);

    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(v, now, 0.12);

    droneGain.gain.setTargetAtTime(0.18, now, 0.25);
    noiseGain.gain.setTargetAtTime(0.03, now, 0.25);

    beginDrift();
  }

  function stopAudio(){
    if (!ctx) return;
    isOn = false;
    setIcon(false);

    const now = ctx.currentTime;
    master.gain.setTargetAtTime(0.0, now, 0.10);
    droneGain.gain.setTargetAtTime(0.0, now, 0.18);
    noiseGain.gain.setTargetAtTime(0.0, now, 0.18);

    if (driftTimer) {
      clearInterval(driftTimer);
      driftTimer = null;
    }
  }

  audioBtn?.addEventListener("click", async () => {
    if (!isOn) await startAudio();
    else stopAudio();
  });

  // Autostart on first gesture (scroll counts)
  function armAutoStart(){
    if (!armed) return;
    armed = false;

    const kick = async () => {
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
      window.removeEventListener("wheel", kick);
      window.removeEventListener("touchstart", kick);
      window.removeEventListener("scroll", kick);
      if (!isOn) {
        try { await startAudio(); } catch (e) { console.warn(e); }
      }
    };

    window.addEventListener("pointerdown", kick, { once:true, passive:true });
    window.addEventListener("keydown", kick, { once:true });
    window.addEventListener("wheel", kick, { once:true, passive:true });
    window.addEventListener("touchstart", kick, { once:true, passive:true });
    window.addEventListener("scroll", kick, { once:true, passive:true });
  }

  // tiny drift in delay time (adds life without heavy chorus)
  function beginDrift(){
    if (!ctx || !delay) return;
    if (driftTimer) return;

    const t0 = performance.now();
    driftTimer = setInterval(() => {
      if (!isOn || !ctx) { clearInterval(driftTimer); driftTimer = null; return; }
      const t = (performance.now() - t0) * 0.001;
      const drift = 0.012 * Math.sin(t * 0.12) + 0.007 * Math.sin(t * 0.07);
      delay.delayTime.setTargetAtTime(0.24 + drift, ctx.currentTime, 0.08);
    }, 220);
  }

  // init
  setIcon(false);
  applyVolume();
  armAutoStart();

  // ========= Utilities =========
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
})();
