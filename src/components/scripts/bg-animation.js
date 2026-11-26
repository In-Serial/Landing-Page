(() => {
  const canvas = document.getElementById('bg');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });

  const BASE = './src/assets/frames/';
  const EXT = '.webp';
  const SMOOTHING = 0.05;

  const DESKTOP_COUNT = Number(canvas.dataset.framesDesktop) || 142;
  const MOBILE_COUNT = Number(canvas.dataset.framesMobile) || DESKTOP_COUNT;

  let variant = 'mobile';
  if (matchMedia('(min-width: 768px)').matches) variant = 'desktop';

  const conn = navigator.connection;
  if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) {
    variant = 'mobile';
  }

  const CONFIG = {
    mobile:  { count: MOBILE_COUNT,  width: 800,  concurrency: 4, lookahead: 3 },
    desktop: { count: DESKTOP_COUNT, width: 1280, concurrency: 8, lookahead: 6 }
  }[variant];

  const COUNT = CONFIG.count;
  const TARGET_W = CONFIG.width;

  const pad = n => String(n + 1).padStart(4, '0');
  const srcFor = (v, i) => `${BASE}${v}/frame_${pad(i)}${EXT}`;
  const src = i => srcFor(variant, i);

  const toDesktop = i =>
    Math.round((i / Math.max(COUNT - 1, 1)) * (DESKTOP_COUNT - 1));

  const frames = new Array(COUNT);
  const pending = new Set();

  let sized = false;
  let lastDrawn = -1;

  async function fetchFrame(i) {
    let res = await fetch(src(i));
    if (!res.ok && variant === 'mobile') {
      res = await fetch(srcFor('desktop', toDesktop(i)));
    }
    if (!res.ok) throw new Error(res.status);
    return res.blob();
  }

  async function load(i) {
    if (frames[i] || pending.has(i)) return;
    pending.add(i);
    try {
      const bmp = await createImageBitmap(await fetchFrame(i), {
        resizeWidth: TARGET_W,
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

  let target = 0;
  let current = 0;

  async function preload() {
    await load(Math.round(current));

    const queue = buildQueue();
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) await load(queue[cursor++]);
    };
    await Promise.all(Array.from({ length: CONFIG.concurrency }, worker));
  }

  let stops = [];

  function buildStops() {
    stops = [...document.querySelectorAll('[data-progress]')]
      .map(el => {
        const p = Math.min(Math.max(Number(el.dataset.progress), 0), 1);
        return {
          y: el.getBoundingClientRect().top + scrollY,
          frame: p * (COUNT - 1)
        };
      })
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

    for (let d = 0; d < CONFIG.lookahead; d++) {
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