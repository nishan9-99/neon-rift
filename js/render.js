(function() {
  'use strict';
  const NR = window.NR = window.NR || {};
  const C = NR.CONFIG,
    col = C.colors;
  let ctx = null,
    canvas = null,
    glowLayer = null,
    vignetteLayer = null;
  const TAU = Math.PI * 2;

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w);
    c.height = Math.max(1, h);
    return c;
  }

  function poly(n, r, rot) {
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const a = (rot || 0) + k * TAU / n;
      if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  }

  function glow(color, x, y, r, alpha) {
    const s = NR.glow.get(color, r),
      prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * alpha;
    ctx.drawImage(s, x - s.width / 2, y - s.height / 2);
    ctx.globalAlpha = prev;
  }

  function drawGrid(W) {
    const sp = C.world.gridSpacing * W.S,
      off = (W.t * C.world.gridDrift) % sp;
    ctx.strokeStyle = (NR.ARENAS[NR.save.data.loadout.arena] || NR.ARENAS.origin).grid + '66';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = off; x < W.W; x += sp) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H(W));
    }
    for (let y = off; y < W.H; y += sp) {
      ctx.moveTo(0, y);
      ctx.lineTo(W.W, y);
    }
    ctx.stroke();
  }

  function H(W) {
    return W.H;
  }

  function drawStars(W) {
    ctx.fillStyle = (NR.ARENAS[NR.save.data.loadout.arena] || NR.ARENAS.origin).starTint;
    for (let i = 0; i < W.stars.length; i++) {
      const s = W.stars[i];
      ctx.globalAlpha = 0.3 + 0.35 * Math.sin(W.t + s.p);
      ctx.fillRect(s.u * W.W, s.v * W.H, s.r, s.r);
    }
    ctx.globalAlpha = 1;
  }

  function drawTelegraphs(W) {
    const S = W.S;
    ctx.lineWidth = 2 * S;
    for (let i = 0; i < W.telegraphs.length; i++) {
      const t = W.telegraphs[i],
        k = t.t / t.dur,
        d = NR.ENEMY_TYPES[t.type];
      const r = Math.max(14, 38 - 24 * Math.min(1, k)) * S;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(col.orange, t.x, t.y, 40 * S, 0.25 + 0.35 * k);
      ctx.restore();
      ctx.strokeStyle = col.orange;
      ctx.globalAlpha = 0.45 + 0.5 * k;
      ctx.setLineDash([5 * S, 5 * S]);
      ctx.lineDashOffset = -W.t * 24;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = d.color;
      ctx.globalAlpha = 0.35 + 0.5 * k;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 3 * S, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawPickups(W) {
    const S = W.S;
    for (const p of W.pickups) {
      const d = NR.PICKUPS[p.id];
      ctx.save();
      ctx.translate(p.x, p.y + Math.sin(W.t * 2) * 2 * S);
      glow(d.color, 0, 0, 28 * S, .5);
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 2 * S;
      const r = 10 * S;
      if (p.life < 3) ctx.globalAlpha = .6;
      if (d.shape === 'cross') {
        ctx.strokeRect(-r, -r, 2 * r, 2 * r);
        ctx.beginPath();
        ctx.moveTo(-r * .5, 0);
        ctx.lineTo(r * .5, 0);
        ctx.moveTo(0, -r * .5);
        ctx.lineTo(0, r * .5);
        ctx.stroke();
      } else if (d.shape === 'diamond') {
        poly(4, r, 0);
        ctx.stroke();
      } else if (d.shape === 'chevron') {
        ctx.beginPath();
        ctx.moveTo(-r, r);
        ctx.lineTo(0, -r);
        ctx.lineTo(r, r);
        ctx.moveTo(-r, 0);
        ctx.lineTo(0, -r * 2);
        ctx.lineTo(r, 0);
        ctx.stroke();
      } else if (d.shape === 'ring') {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r * .45, 0, TAU);
        ctx.stroke();
      } else if (d.shape === 'magnet') {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI);
        ctx.lineTo(-r, -r);
        ctx.moveTo(r, 0);
        ctx.lineTo(r, -r);
        ctx.stroke();
      } else {
        poly(3, r * 1.3, -Math.PI / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(0, r);
        ctx.stroke();
      }
      ctx.restore();
    }
    for (const g of W.gems.list) {
      ctx.save();
      ctx.translate(g.x, g.y + Math.sin(g.age * 2) * 2);
      const r = (g.value >= 25 ? 7 : g.value >= 5 ? 5 : 4) * S;
      ctx.fillStyle = g.value >= 25 ? col.purple : col.cyan;
      ctx.strokeStyle = '#EBFAFF';
      poly(4, r, 0);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBullets(W) {
    const S = W.S,
      l = W.bullets.list;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < l.length; i++) glow(l[i].color, l[i].x, l[i].y, 14 * S, 0.9);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#affff6';
    ctx.beginPath();
    for (let i = 0; i < l.length; i++) {
      const b = l[i];
      ctx.moveTo(b.x + b.r * S, b.y);
      ctx.arc(b.x, b.y, b.r * S, 0, TAU);
    }
    ctx.fill();
  }

  function drawEnemies(W, P) {
    const S = W.S;
    for (let i = 0; i < W.enemies.length; i++) {
      const e = W.enemies[i],
        r = e.r * S;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.globalAlpha = e.alpha === undefined ? 1 : e.alpha;
      ctx.globalCompositeOperation = 'lighter';
      glow(e.color, 0, 0, r * 2.6, e.hit ? 0.95 : 0.55);
      ctx.globalCompositeOperation = 'source-over';
      ctx.rotate(Math.atan2(P.y - e.y, P.x - e.x));
      ctx.fillStyle = e.hit ? '#ffffff' : e.color;
      ctx.strokeStyle = col.outline;
      ctx.lineWidth = 1.5;
      if (e.def.shape === 'tri') {
        ctx.beginPath();
        ctx.moveTo(r + 5 * S, 0);
        ctx.lineTo(-r, -r);
        ctx.lineTo(-r, r);
        ctx.closePath();
      } else if (e.def.shape === 'spike') {
        ctx.beginPath();
        for (let k = 0; k < 16; k++) {
          const a = k * TAU / 16,
            rr = k % 2 ? r * .7 : r * 1.2;
          if (k === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
      } else poly({
        hex: 6,
        oct: 8,
        diamond: 4,
        pent: 5,
        square: 4
      } [e.def.shape] || 6, r, e.def.shape === 'square' ? Math.PI / 4 : 0);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = col.core;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.35, 0, TAU);
      ctx.fill();
      ctx.restore();
      if (e.elite) {
        ctx.strokeStyle = '#ffda80';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(e.x, e.y, r + 5 * S, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = '#ffda80';
        ctx.save();
        ctx.translate(e.x, e.y - r - 16 * S);
        poly(4, 4 * S, 0);
        ctx.fill();
        ctx.restore();
      }
      if (e.type === 'phantom' && e.cloak) {
        ctx.save();
        ctx.fillStyle = e.color;
        ctx.globalAlpha = .35;
        ctx.fillRect(e.x - e.r * W.S, e.y - 1, e.r * W.S * 2, 2);
        ctx.restore();
      }
      if (e.type === 'sentinel') ring(e.x, e.y, 110 * S, '#ffda8066', true);
      if (e.warning) ring(e.warning.x, e.warning.y, 30 * S, col.orange, true);
      if (e.aimWarning !== undefined && e.aimWarning !== null) line(e.x, e.y, e.x + Math.cos(e.aimWarning) * 400 * S, e.y + Math.sin(e.aimWarning) * 400 * S, col.orange, 1, true);
      if (e.fuse > 0) ring(e.x, e.y, 80 * S, col.orange, true);
      if (e.type === 'tank' || e.elite) {
        const bw = 46 * S,
          bx = e.x - bw / 2,
          by = e.y - r - 12 * S;
        ctx.fillStyle = '#142034';
        ctx.fillRect(bx, by, bw, 4 * S);
        ctx.fillStyle = e.color;
        ctx.fillRect(bx, by, bw * Math.max(0, e.hp) / e.maxHp, 4 * S);
      }
    }
  }

  function drawParticles(W) {
    const l = W.particles.list;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < l.length; i++) {
      const p = l[i],
        k = p.life / p.max;
      ctx.globalAlpha = k < 0 ? 0 : k;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.1, p.r * k), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawPlayer(W, p) {
    const S = W.S;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    if (Math.hypot(p.vx, p.vy) > 20) {
      ctx.fillStyle = '#54f1dc33';
      ctx.beginPath();
      ctx.moveTo(-10 * S, -5 * S);
      ctx.lineTo(-(22 + Math.min(20, Math.hypot(p.vx, p.vy) / 20)) * S, 0);
      ctx.lineTo(-10 * S, 5 * S);
      ctx.fill();
    }

    ctx.globalAlpha = p.invuln > 0 ? .7 : 1;
    ctx.globalCompositeOperation = 'lighter';
    glow(col.cyan, 0, 0, 44 * S, 0.8);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = col.cyan;
    ctx.strokeStyle = '#e4ffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20 * S, 0);
    ctx.lineTo(-11 * S, -13 * S);
    ctx.lineTo(-6 * S, 0);
    ctx.lineTo(-11 * S, 13 * S);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#102c43';
    ctx.beginPath();
    ctx.arc(0, 0, 5 * S, 0, TAU);
    ctx.fill();
    if (p.ship === 'titan') {
      ctx.strokeStyle = col.orange;
      ctx.strokeRect(-10 * S, -8 * S, 20 * S, 16 * S);
    }
    if (p.ship === 'wraith') {
      ctx.strokeStyle = col.purple;
      ctx.beginPath();
      ctx.moveTo(-14 * S, -18 * S);
      ctx.lineTo(10 * S, 0);
      ctx.lineTo(-14 * S, 18 * S);
      ctx.stroke();
    }
    if (p.ship === 'adept') ring(0, 0, 18 * S, col.purple, false);
    if (p.dash > 0) {
      ctx.strokeStyle = '#8cfff1';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 25 * S, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    if (p.invuln > 0) ring(p.x, p.y, 28 * S, col.cyanHi, false);
    if (p.dashCd > 0) {
      ctx.strokeStyle = '#70faed85';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 24 * S, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - p.dashCd / p.dashCdMax));
      ctx.stroke();
    }
  }

  function drawFragments(W) {
    ctx.strokeStyle = '#54f1dc';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < W.fragments.length; i++) {
      const f = W.fragments[i];
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.globalAlpha = f.a;
      ctx.strokeStyle = f.color;
      poly(f.n, f.s, 0);
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    /* occasional scanline */
    const sy = ((W.t * 60) % (W.H + 200)) - 100;
    ctx.fillStyle = 'rgba(84,241,220,0.05)';
    ctx.fillRect(0, sy, W.W, 2);
  }


  function ring(x, y, r, color, dashed) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    if (dashed) ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(.1, r), 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function line(x, y, x2, y2, color, width, dashed) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (dashed) ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawHazards(W) {
    for (const h of W.hazards) {
      const warn = h.age < h.warning;
      ctx.save();
      ctx.fillStyle = h.id === 'drag' ? '#b277ff10' : '#ff456b12';
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r * W.S, 0, TAU);
      ctx.fill();
      ctx.restore();
      ring(h.x, h.y, h.r * W.S, warn ? col.orange : h.id === 'drag' ? col.purple : col.red, true);
      ctx.save();
      ctx.fillStyle = warn ? col.orange : col.red;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText((warn ? 'WARNING: ' : '') + (NR.HAZARDS[h.id] ? NR.HAZARDS[h.id].name : 'VOLATILE'), h.x, h.y - 12);
      if (h.id === 'mine') {
        ctx.fillRect(h.x - 5, h.y - 5, 10, 10);
        if (h.fuse > 0) ring(h.x, h.y, 90 * W.S, col.orange, false);
      }
      ctx.restore();
    }
  }

  function drawEnemyBullets(W) {
    ctx.fillStyle = col.red;
    ctx.strokeStyle = '#EBFAFF';
    ctx.lineWidth = 1.5;
    for (const b of W.enemyBullets.list) {
      ctx.save();
      ctx.translate(b.x, b.y);
      poly(4, b.r * W.S, 0);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBoss(W) {
    const b = W.boss;
    if (!b) return;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.globalAlpha = NR.game.state === 'BOSS_INTRO' ? Math.min(1, W.t % 3 + 0.2) : b.dead ? Math.max(0, 1 - b.deathAge / b.def.death) : 1;
    glow(col.pink, 0, 0, b.r * 1.7, .4);
    ctx.fillStyle = col.core;
    poly(8, b.r * .75, W.t * .1);
    ctx.fill();
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = k % 2 ? col.cyan : col.pink;
      ctx.lineWidth = 3;
      poly(k === 1 ? 6 : 8, b.r * (.65 + k * .18), W.t * (k % 2 ? -1 : 1) * (.18 + b.phase * .14));
      ctx.stroke();
    }
    ctx.fillStyle = b.hit ? '#ffffff' : col.pink;
    ctx.beginPath();
    ctx.arc(0, 0, b.r * .16 * (1 + .1 * Math.sin(W.t * 3)), 0, TAU);
    ctx.fill();
    ctx.restore();
    const a = b.attack;
    if (a) {
      const warning = b.attackAge < a.telegraph,
        color = warning ? col.orange : col.red;
      if (a.id === 'laser') {
        const base = warning ? b.angle : b.liveAngle;
        for (let i = 0; i < b.phase + 1; i++) {
          const q = base + i * TAU / (b.phase + 1),
            len = Math.hypot(W.W, W.H);
          line(b.x, b.y, b.x + Math.cos(q) * len, b.y + Math.sin(q) * len, color, warning ? 2 : a.width, true);
        }
      } else if (a.id === 'charge') line(b.x, b.y, b.x + Math.cos(b.angle) * Math.hypot(W.W, W.H), b.y + Math.sin(b.angle) * Math.hypot(W.W, W.H), color, 3, true);
      else ring(b.x, b.y, b.r + 20, color, true);
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(a.name, b.x, b.y - b.r - 20);
      ctx.restore();
    }
    for (const o of W.shockRings)
      if (o.delay <= 0) ring(o.x, o.y, o.r, col.red, false);
  }

  function drawEffects(W) {
    for (const e of W.effects) {
      ctx.globalAlpha = Math.max(0, 1 - e.t / e.life);
      if (e.kind === 'ring') ring(e.x, e.y, e.r * (e.t / e.life), e.color, false);
      else line(e.x, e.y, e.x2, e.y2, e.color, e.width || 2, false);
    }
    ctx.globalAlpha = 1;
  }

  function drawFloating(W) {
    ctx.save();
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.textAlign = 'center';
    for (const f of W.floating.list) {
      ctx.globalAlpha = Math.max(0, f.life / f.max);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  NR.render = {
    init(cv) {
      canvas = cv;
      ctx = cv.getContext('2d', {
        alpha: false
      });
      return !!ctx;
    },
    rebuild() {
      const W = NR.world;
      glowLayer = layer(W.W, W.H);
      let g = glowLayer.getContext('2d'),
        grad = g.createRadialGradient(W.W / 2, W.H / 2, 0, W.W / 2, W.H / 2, Math.max(W.W, W.H) * 0.7);
      grad.addColorStop(0, '#10415824');
      grad.addColorStop(1, '#080e1c00');
      g.fillStyle = grad;
      g.fillRect(0, 0, W.W, W.H);
      vignetteLayer = layer(W.W, W.H);
      g = vignetteLayer.getContext('2d');
      grad = g.createRadialGradient(W.W / 2, W.H / 2, Math.min(W.W, W.H) * 0.3, W.W / 2, W.H / 2, Math.max(W.W, W.H) * 0.78);
      grad.addColorStop(0, '#0000');
      grad.addColorStop(1, '#020515b9');
      g.fillStyle = grad;
      g.fillRect(0, 0, W.W, W.H);
    },
    frame(showWorld) {
      if (!ctx || !glowLayer) return;
      const W = NR.world,
        P = NR.player.p;
      ctx.setTransform(W.DPR, 0, 0, W.DPR, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = (NR.ARENAS[NR.save.data.loadout.arena] || NR.ARENAS.origin).bg;
      ctx.fillRect(0, 0, W.W, W.H);
      ctx.save();
      if (showWorld && W.shake > 0 && !NR.reduced() && NR.save.data.settings.shake !== 'off') {
        const sh = Math.min(W.shake, C.damage.maxShake) * (NR.save.data.settings.shake === 'low' ? .3 : 1);
        ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
      }
      drawGrid(W);
      if ((NR.ARENAS[NR.save.data.loadout.arena] || {}).name === 'DEAD CIRCUIT') {
        ctx.strokeStyle = '#9b7a3244';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let y = 50; y < W.H; y += 150) {
          ctx.moveTo(0, y);
          ctx.lineTo(W.W * .25, y);
          ctx.lineTo(W.W * .3, y + 30);
          ctx.lineTo(W.W * .65, y + 30);
        }
        ctx.stroke();
      }
      ctx.drawImage(glowLayer, 0, 0, W.W, W.H);
      drawStars(W);
      if (showWorld) {
        drawHazards(W);
        drawTelegraphs(W);
        drawPickups(W);
        drawBullets(W);
        drawBoss(W);
        drawEnemyBullets(W);
        drawEffects(W);
        if (P) drawEnemies(W, P);
        drawParticles(W);
        if (P && P.alive) drawPlayer(W, P);
        drawFloating(W);
        if (P && P.charge > 0) ring(P.x, P.y, 30 * W.S, col.purple, false);
        if (W.well) ring(W.well.x, W.well.y, 80 * W.S, col.purple, true);
      } else drawFragments(W);
      ctx.restore();
      if (showWorld && W.flash > 0) {
        ctx.fillStyle = 'rgba(255,57,112,' + (NR.reduced() ? .04 : Math.min(.25, W.flash * .3)) + ')';
        ctx.fillRect(0, 0, W.W, W.H);
      }
      ctx.drawImage(vignetteLayer, 0, 0, W.W, W.H);
      if (showWorld && P && P.hp / P.maxHp <= .25) {
        ctx.strokeStyle = '#ff456b55';
        ctx.lineWidth = 12;
        ctx.strokeRect(0, 0, W.W, W.H);
      }
      if (showWorld && W.event && W.event.id === 'blackout') {
        const g = ctx.createRadialGradient(P.x, P.y, 200 * W.S, P.x, P.y, 400 * W.S);
        g.addColorStop(0, '#0000');
        g.addColorStop(1, '#000a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W.W, W.H);
        drawEnemies(W, P);
        drawEnemyBullets(W);
        drawHazards(W);
        drawBoss(W);
      }
    }
  };
})();
