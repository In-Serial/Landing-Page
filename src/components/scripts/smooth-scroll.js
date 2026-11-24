(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (typeof Lenis === 'undefined') return;

  const lenis = new Lenis({
    duration: 4,                                   // più alto = più lento e morbido
    easing: t => 1 - Math.pow(1 - t, 4),             // ease out (CUBE)
    wheelMultiplier: 0.7,                            // riduce la velocità della rotellina
    touchMultiplier: 0.5,
    smoothWheel: true,
    syncTouch: false                                 // su touch resta lo scroll nativo (più fluido su mobile)
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // link ancora della navbar: scroll morbido con ease out
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      const target = id.length > 1 && document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { duration: 2.2, easing: t => 1 - Math.pow(1 - t, 4) });
    });
  });

  window.lenis = lenis; // utile per debug
})();