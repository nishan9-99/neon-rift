(function() {
  'use strict';
  const NR = window.NR = window.NR || {};
  const C = NR.CONFIG,
    rng = NR.rng;

  /* ---- Pre-rendered glow sprites (replaces per-draw shadowBlur) ---- */
  const glowCache = {};
  NR.glow = {
    get(color, radius) {
      const r = Math.max(6, Math.ceil(radius / 4) * 4);
      const key = color + '|' + r;
      let c = glowCache[key];
      if (c) return c;
      c = document.createElement('canvas');
      c.width = c.height = r * 2;
      const g = c.getContext('2d');
      const [R, G, B] = NR.utils.hexToRgb(color);
      const grad = g.createRadialGradient(r, r, 0, r, r, r);
      grad.addColorStop(0, 'rgba(' + R + ',' + G + ',' + B + ',0.85)');
      grad.addColorStop(0.35, 'rgba(' + R + ',' + G + ',' + B + ',0.30)');
      grad.addColorStop(1, 'rgba(' + R + ',' + G + ',' + B + ',0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, r * 2, r * 2);
      if (Object.keys(glowCache).length > 192) delete glowCache[Object.keys(glowCache)[0]];
      glowCache[key] = c;
      return c;
    },
    size() {
      return Object.keys(glowCache).length;
    }
  };

  const pool = new NR.Pool(C.perf.particles, () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    max: 0,
    r: 1,
    color: '#fff'
  }));
  NR.particles = {
    pool,
    burst(x, y, color, n, power) {
      n = n || 13;
      power = power || 150;
      if (NR.reduced()) n = Math.ceil(n / 3);
      const cap = {
        high: 500,
        medium: 250,
        low: 100
      } [NR.save.data.settings.particles] || 500;
      pool.max = cap;
      while (pool.list.length > cap) pool.killAt(0);
      for (let i = 0; i < n; i++) {
        let p = pool.spawn();
        if (!p) p = pool.list[0]; /* full: recycle a random live one */
        if (!p) return;
        const a = rng.range(0, Math.PI * 2),
          s = rng.range(20, power),
          life = rng.range(0.25, 0.75);
        p.x = x;
        p.y = y;
        p.vx = Math.cos(a) * s;
        p.vy = Math.sin(a) * s;
        p.life = life;
        p.max = life;
        p.r = rng.range(1, 4);
        p.color = color;
      }
    },
    update(dt) {
      const l = pool.list,
        damp = Math.exp(-dt * 2);
      for (let i = l.length - 1; i >= 0; i--) {
        const p = l[i];
        p.life -= dt;
        if (p.life <= 0) {
          pool.killAt(i);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= damp;
        p.vy *= damp;
      }
    },
    clear() {
      pool.clear();
    }
  };
})();
