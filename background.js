(function () {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%',
    zIndex: '-1', pointerEvents: 'none', display: 'block'
  });
  document.body.prepend(canvas);

  let W, H, stars = [], mouse = { x: -9999, y: -9999 };
  const STAR_DENSITY = 1 / 4800;
  const PROXIMITY = 160;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    buildStars();
  }

  function buildStars() {
    const count = Math.round(W * H * STAR_DENSITY);
    stars = Array.from({ length: count }, () => ({
      x:     Math.random() * W,
      y:     Math.random() * H,
      base:  0.4 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
      freq:  0.4 + Math.random() * 0.8,
      warm:  Math.random()
    }));
  }

  class Shockwave {
    constructor(x, y, delay) {
      this.x = x; this.y = y;
      this.radius = 0;
      this.maxR = 340;
      this.alpha = 0;
      this.delay = delay;
      this.started = false;
      this.alive = true;
      this.birth = performance.now();
    }
    update(now) {
      const elapsed = now - this.birth - this.delay;
      if (elapsed < 0) return;
      if (!this.started) this.started = true;
      const t = elapsed / 900;
      if (t >= 1) { this.alive = false; return; }
      this.radius = this.maxR * (1 - Math.pow(1 - t, 2.4));
      this.alpha  = (1 - t) * 0.55;
    }
    draw() {
      if (!this.started || !this.alive) return;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(196, 130, 60, ${this.alpha})`;
      ctx.lineWidth = 2.2 * (1 - this.radius / this.maxR) + 0.4;
      ctx.stroke();
    }
    distTo(sx, sy) {
      return Math.abs(Math.hypot(sx - this.x, sy - this.y) - this.radius);
    }
  }

  let shockwaves = [];

  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });

  window.addEventListener('click', e => {
    shockwaves.push(
      new Shockwave(e.clientX, e.clientY, 0),
      new Shockwave(e.clientX, e.clientY, 90),
      new Shockwave(e.clientX, e.clientY, 200)
    );
  });

  window.addEventListener('resize', resize);

  let last = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = (now - last) / 1000;
    last = now;

    ctx.fillStyle = '#060402';
    ctx.fillRect(0, 0, W, H);

    shockwaves = shockwaves.filter(sw => sw.alive || !sw.started);
    for (const sw of shockwaves) { sw.update(now); sw.draw(); }

    for (const s of stars) {
      const twinkle = Math.sin(now * 0.001 * s.freq + s.phase) * 0.5 + 0.5;

      const dx = s.x - mouse.x;
      const dy = s.y - mouse.y;
      const md = Math.hypot(dx, dy);
      const proximity = md < PROXIMITY ? (1 - md / PROXIMITY) : 0;

      let shockBoost = 0;
      for (const sw of shockwaves) {
        if (!sw.started) continue;
        const d = sw.distTo(s.x, s.y);
        if (d < 28) shockBoost = Math.max(shockBoost, 1 - d / 28);
      }

      const boost   = proximity * 2.8 + shockBoost * 3.2;
      const radius  = s.base * (1 + boost * 1.6) * (0.75 + twinkle * 0.25);
      const opacity = Math.min(1, (0.25 + twinkle * 0.45 + boost * 0.5));

      const r = Math.round(200 + s.warm * 40);
      const g = Math.round(185 + s.warm * 20);
      const b = Math.round(150 + (1 - s.warm) * 30);

      if (boost > 0.02 || proximity > 0.02) {
        const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius * 5);
        glow.addColorStop(0, `rgba(${r},${g},${b},${opacity * 0.55})`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(s.x, s.y, radius * 5, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${opacity})`;
      ctx.fill();
    }
  }

  resize();
  requestAnimationFrame(loop);
})();
