(() => {
  const canvas = document.getElementById('bg');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });

  let COUNT = Number(canvas.dataset.frames) || 142;
  const BASE = './src/assets/frames/';
  const EXT = '.webp';
  const SMOOTHING = 0.05;

  // --- Mobile first: i valori di base sono quelli mobile,
  // --- il desktop li sovrascrive solo se il media query combacia.
  const DESKTOP_QUERY = '(min-width: 768px)';

  let variant = 'mobile';
  let TARGET_W = 800;
  let CONCURRENCY = 4;

  if (matchMedia(DESKTOP_QUERY).matches) {
    variant = 'desktop';
    TARGET_W = 1280;
    CONCURRENCY = 8;
    COUNT = 283; 
  }

  // Risparmio dati: forza mobile se la connessione è lenta
  const conn = navigator.connection;
  if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) {
    variant = 'mobile';
    TARGET_W = 800;
    CONCURRENCY = 3;
  }

  const PATH = `${BASE}${variant}/frame_`;

  const src = i => `${PATH}${String(i + 1).padStart(4, '0')}${EXT}`;
  const frames = new Array(COUNT);
  const pending = new Set();

  let sized = false;
  let lastDrawn = -1;

  async function load(i) {
    if (frames[i] || pending.has(i)) return;
    pending.add(i); // resta in pending anche se fallisce: niente retry infiniti
    try {
      const res = await fetch(src(i));
      if (!res.ok) throw new Error(res.status);
      const bmp = await createImageBitmap(await res.blob(), {
        resizeWidth: TARGET_W,      // l'altezza segue le proporzioni
        resizeQuality: 'low'
      });

      if (!sized) {
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

  function buildQueue() {
    const seen = new Set();
    const queue = [];
    for (const step of [20, 8, 4, 2, 1]) {
      for (let i = 0; i < COUNT; i += step) {
        if (!seen.has(i)) { seen.add(i); queue.push(i); }
      }
    }
    return queue;
  }

  async function preload() {
    await load(Math.round(current));

    const queue = buildQueue();
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) await load(queue[cursor++]);
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  let stops = [];

  function buildStops() {
    stops = [...document.querySelectorAll('[data-frame]')]
      .map(el => ({
        y: el.getBoundingClientRect().top + scrollY,
        frame: Math.min(Math.max(Number(el.dataset.frame), 0), COUNT - 1)
      }))
      .sort((a, b) => a.y - b.y);
  }

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

  let target = 0;
  let current = 0;

  function updateScroll() {
    target = frameAtScroll(scrollY);
  }

  function refresh() {
    buildStops();
    updateScroll();
  }

  function tick() {
    current += (target - current) * SMOOTHING;
    if (Math.abs(target - current) < 0.01) current = target;

    const near = Math.round(current);

    // Mobile: finestra di prefetch più stretta per risparmiare banda
    const lookahead = variant === 'mobile' ? 3 : 6;
    for (let d = 0; d < lookahead; d++) {
      load(Math.min(near + d, COUNT - 1));
      load(Math.max(near - d, 0));
    }

    let i = near;
    while (i > 0 && !frames[i]) i--;

    if (frames[i] && i !== lastDrawn) {
      ctx.drawImage(frames[i], 0, 0);
      lastDrawn = i;
    }
    requestAnimationFrame(tick);
  }

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion) {
    load(0).then(() => frames[0] && ctx.drawImage(frames[0], 0, 0));
  } else {
    addEventListener('scroll', updateScroll, { passive: true });
    addEventListener('resize', refresh);
    addEventListener('load', refresh);
    new ResizeObserver(refresh).observe(document.body);
    refresh();
    current = target;
    preload();
    tick();
  }
})();