(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (typeof Lenis === 'undefined') return;

  const ease = t => 1 - Math.pow(1 - t, 3); 

  const lenis = new Lenis({
    duration: 1.1,
    easing: ease,
    wheelMultiplier: 0.6,   
    smoothWheel: true,
    syncTouch: false
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      const target = id.length > 1 && document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { duration: 1.8, easing: ease });
    });
  });

  window.lenis = lenis;
})();