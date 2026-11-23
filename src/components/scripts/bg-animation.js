(() => {
  const canvas = document.getElementById('bg');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });

  const COUNT = Number(canvas.dataset.frames) || 280;
  const PATH = './src/assets/frames/frame_'; // relativo all'index.html
  const EXT = '.webp';
  const SMOOTHING = 0.05; // 0.05 = più morbido, 0.2 = più reattivo

  const src = i => `${PATH}${String(i + 1).padStart(4, '0')}${EXT}`;
  const frames = new Array(COUNT);

  let sized = false;
  let lastDrawn = -1;

  // --- caricamento + decodifica anticipata ---
  async function load(i) {
    if (frames[i]) return;
    try {
      const img = new Image();
      img.src = src(i);
      await img.decode();
      const bmp = await createImageBitmap(img);

      if (!sized) {
        // canvas alla risoluzione nativa dei frame: lo scaling lo fa il CSS
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        sized = true;
        lastDrawn = -1;
      }
      frames[i] = bmp;
    } catch {
      console.warn('Frame non trovato:', src(i));
    }
  }

  // prima pochi frame sparsi, poi si riempiono i buchi
  async function preload() {
    for (const step of [20, 8, 4, 2, 1]) {
      for (let i = 0; i < COUNT; i += step) await load(i);
    }
  }

  // --- ancore: [data-frame] sugli elementi della pagina ---
  let stops = [];

  function buildStops() {
    stops = [...document.querySelectorAll('[data-frame]')]
      .map(el => ({
        y: el.getBoundingClientRect().top + scrollY,
        frame: Math.min(Math.max(Number(el.dataset.frame), 0), COUNT - 1)
      }))
      .sort((a, b) => a.y - b.y);
  }

  // dato lo scroll, restituisce il frame (anche decimale) interpolando tra le ancore
  function frameAtScroll(y) {
    if (!stops.length) return 0;
    if (y <= stops[0].y) return stops[0].frame;

    for (let k = 1; k < stops.length; k++) {
      const a = stops[k - 1];
      const b = stops[k];
      if (y <= b.y) {
        const span = b.y - a.y;
        const t = span > 0 ? (y - a.y) / span : 1;
        return a.frame + (b.frame - a.frame) * t;
      }
    }
    return stops[stops.length - 1].frame;
  }

  // --- scroll ---
  let target = 0;
  let current = 0;

  function updateScroll() {
    target = frameAtScroll(scrollY);
  }

  function refresh() {
    buildStops();
    updateScroll();
  }

  // --- loop ---
  function tick() {
    current += (target - current) * SMOOTHING;
    if (Math.abs(target - current) < 0.01) current = target;

    let i = Math.round(current);
    while (i > 0 && !frames[i]) i--; // fallback al frame caricato più vicino

    if (frames[i] && i !== lastDrawn) {
      ctx.drawImage(frames[i], 0, 0);
      lastDrawn = i;
    }
    requestAnimationFrame(tick);
  }

  // --- avvio ---
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion) {
    load(0).then(() => frames[0] && ctx.drawImage(frames[0], 0, 0));
  } else {
    addEventListener('scroll', updateScroll, { passive: true });
    addEventListener('resize', refresh);
    addEventListener('load', refresh);                   // font/immagini cambiano le altezze
    new ResizeObserver(refresh).observe(document.body);  // layout che cambia dopo
    refresh();
    current = target; // parte già nella posizione corretta (es. refresh a metà pagina)
    preload();
    tick();
  }
})();