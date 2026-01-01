(() => {
  // ========= Theme (default dark; remembers choice) =========
  const themeBtn = document.getElementById("themeBtn");
  const savedTheme = localStorage.getItem("theme");
  const initialTheme = savedTheme || document.documentElement.getAttribute("data-theme") || "dark";
  document.documentElement.setAttribute("data-theme", initialTheme);

  themeBtn?.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  });

  // ========= Works (links go to runtimes) =========
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
      href: "works/athamal/", // change later to works/tesseract_engine/
      preview: "assets/video/tesseract_preview.webm",
      poster: "assets/img/thumbs/tesseract_engine.jpg"
    }
  ];

  // ========= Featured card =========
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
      <a class="btnLike" href="${w.href}">Open runtime ↗</a>
    `;
  }

  // add a tiny button style without needing CSS changes
  const style = document.createElement("style");
  style.textContent = `
    .btnLike{display:inline-block;border:1px solid var(--line);padding:8px 12px;border-radius:999px;text-decoration:none}
  `;
  document.head.appendChild(style);

  // ========= Works grid (video previews; click opens runtime) =========
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
  // AUDIO: Minimal icon + volume slider (procedural warm bed)
  // ==========================================================
  const audioBtn = document.getElementById("audioBtn");
  const audioIcon = document.getElementById("audioIcon");
  const vol = document.getElementById("vol");

  // Remember volume
  const savedVol = localStorage.getItem("vol");
  if (savedVol !== null && vol) vol.value = String(clamp(Number(savedVol), 0, 1));

  let ctx = null;
  let master = null;
  let droneA = null, droneB = null, droneGain = null;
  let noiseSrc = null, noiseGain = null;
  let lp = null, sat = null;
  let isOn = false;

  function ensureGraph(){
    if (ctx) return;

    ctx = new (window.AudioContext || window.webkitAudioContext)();

    master = ctx.createGain();
    master.gain.value = 0.0; // start silent
    master.connect(ctx.destination);

    sat = ctx.createWaveShaper();
    sat.curve = makeSaturationCurve(0.95);
    sat.oversample = "4x";

    lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    lp.Q.value = 0.7;

    sat.connect(lp);
    lp.connect(master);

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

    const baseHz = 55;
    droneA.frequency.value = baseHz;
    droneB.frequency.value = baseHz * (1.0 + 0.0035);

    droneA.start();
    droneB.start();
  }

  function makeNoiseSource(ac){
    const bufferSize = 2 * ac.sampleRate;
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);

    let last = 0;
    for (let i = 0; i < bufferSize; i++){
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.0;
    }

    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  }

  function startAudio(){
    ensureGraph();

    // must be user gesture in most browsers
    if (ctx.state === "suspended") ctx.resume();

    // recreate noise each time
    if (noiseSrc){
      try { noiseSrc.stop(); } catch {}
      try { noiseSrc.disconnect(); } catch {}
      noiseSrc = null;
    }
    if (noiseGain){
      try { noiseGain.disconnect(); } catch {}
      noiseGain = null;
    }

    noiseSrc = makeNoiseSource(ctx);
    noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.02;

    noiseSrc.connect(noiseGain);
    noiseGain.connect(sat);
    noiseSrc.start();

    isOn = true;
    setIcon(true);

    // fade in at safe levels
    const v = Number(vol?.value ?? 0.15);
    master.gain.setTargetAtTime(clamp(v,0,1), ctx.currentTime, 0.12);
    droneGain.gain.setTargetAtTime(0.08, ctx.currentTime, 0.12);
  }

  function stopAudio(){
    if (!ctx) return;
    isOn = false;
    setIcon(false);

    master.gain.setTargetAtTime(0.0, ctx.currentTime, 0.10);
    if (droneGain) droneGain.gain.setTargetAtTime(0.0, ctx.currentTime, 0.10);

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

  function setIcon(on){
    if (!audioIcon) return;
    audioIcon.innerHTML = on
      // pause icon
      ? `<path d="M7 5h4v14H7zM13 5h4v14h-4z"></path>`
      // play icon
      : `<path d="M8 5v14l12-7z"></path>`;
  }

  function applyVolume(){
    const v = clamp(Number(vol?.value ?? 0.15), 0, 1);
    localStorage.setItem("vol", String(v));
    if (!ctx || !master) return;
    if (isOn) master.gain.setTargetAtTime(v, ctx.currentTime, 0.10);
  }

  audioBtn?.addEventListener("click", () => {
    if (!isOn) startAudio();
    else stopAudio();
  });

  vol?.addEventListener("input", applyVolume);

  // Keep default volume low (you asked ~15% of current)
  applyVolume();

  // Helpers
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

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
})();
