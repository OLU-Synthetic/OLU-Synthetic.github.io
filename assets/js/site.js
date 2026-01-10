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
      title: "Data_Scrape",
      year: "2026",
      type: "loop",
      medium: "Realtime procerdual field",
      desc: "A tiled atmosphere of discrete states. Packets pass, thresholds click, and color reorganizes without drama—an image that feels like harvesting, indexing, and forgetting.",
      href: "works/DataScrape/",
      preview: "assets/video/data_scrape_loop.webm",
      poster: "assets/img/thumbs/data_scrape_preview.png"
    },
    {
      title: "Tesseract_Engine",
      year: "2026",
      type: "hyperobject",
      medium: "Realtime procedural loop",
      desc: "Hyperdimensional instrument for form, orbit, and transformation — built for gallery outputs.",
      href: "works/Tesseract_Engine/",
      preview: "assets/video/TesseractPreview03.webm"
    },
    {
      title: "Study_01: CHROMA",
      year: "2026",
      type: "loop",
      medium: "Realtime procedural field",
      desc: "A disciplined colour-field study computed in realtime. Concentric planes contract toward a centre square; hue and luminance shift through a fixed cycle for seamless long-duration display.",
      href: "works/ColourStudy/",
      preview: "assets/video/olu_colour_study_oklch_cycle_64s (1).webm"  
    },  
    {
      title: "KLEE_MATION",
      year: "2026",
      type: "tool",
      medium: "Realtime instrument",
      desc: "Hyperdimensional instrument for form, orbit, and transformation — built for gallery outputs.",
      href: "works/Klee_Mation/",
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
  // AUDIO: click-to-start procedural bed (robust)
  // ==========================================================
  const audioBtn = document.getElementById("audioBtn");
  const audioIcon = document.getElementById("audioIcon");
  const vol = document.getElementById("vol");

  // Default low volume + remember
  const savedVol = localStorage.getItem("vol");
  if (savedVol !== null && vol) vol.value = String(clamp(Number(savedVol), 0, 1));
  if (vol && savedVol === null) vol.value = "0.10";

  let ctx = null;
  let master = null;
  let comp = null;

  let droneA = null, droneB = null;
  let droneGain = null;

  let noiseSrc = null, noiseGain = null;

  let sat = null, lp = null;
  let isOn = false;

  function setIcon(on){
    if (!audioIcon) return;
    audioIcon.innerHTML = on
      ? `<path d="M7 5h4v14H7zM13 5h4v14h-4z"></path>`
      : `<path d="M8 5v14l12-7z"></path>`;
  }

  async function ensureAudio(){
    if (ctx) return;

    ctx = new (window.AudioContext || window.webkitAudioContext)();

    // IMPORTANT: resume first (some browsers are picky)
    if (ctx.state === "suspended") {
      try { await ctx.resume(); } catch (e) { console.warn("Audio resume failed", e); }
    }

    master = ctx.createGain();
    master.gain.value = 0.0;

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.knee.value = 30;
    comp.ratio.value = 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;

    // saturation -> lowpass -> compressor -> master -> destination
    sat = ctx.createWaveShaper();
    sat.curve = makeSaturationCurve(0.95);
    sat.oversample = "4x";

    lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1600;
    lp.Q.value = 0.7;

    sat.connect(lp);
    lp.connect(comp);
    comp.connect(master);
    master.connect(ctx.destination);

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
      data[i] = last * 2.8;
    }

    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  }

  async function startAudio(){
    await ensureAudio();

    if (ctx && ctx.state === "suspended") {
      try { await ctx.resume(); } catch (e) { console.warn("Audio resume failed", e); }
    }

    // recreate noise each start
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
    noiseGain.gain.value = 0.015;

    noiseSrc.connect(noiseGain);
    noiseGain.connect(sat);
    noiseSrc.start();

    isOn = true;
    setIcon(true);

    const v = clamp(Number(vol?.value ?? 0.10), 0, 1);

    // safe fade-in
    master.gain.setTargetAtTime(v, ctx.currentTime, 0.10);
    droneGain.gain.setTargetAtTime(0.06, ctx.currentTime, 0.10);
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

  function applyVolume(){
    const v = clamp(Number(vol?.value ?? 0.10), 0, 1);
    localStorage.setItem("vol", String(v));
    if (!ctx || !master) return;
    if (isOn) master.gain.setTargetAtTime(v, ctx.currentTime, 0.10);
  }

  audioBtn?.addEventListener("click", () => {
    if (!isOn) startAudio();
    else stopAudio();
  });

  vol?.addEventListener("input", applyVolume);

  // initialize icon + volume
  setIcon(false);
  applyVolume();

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

  // ========= Utilities =========
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
})();
