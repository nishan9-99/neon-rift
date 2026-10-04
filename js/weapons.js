(function() {
  'use strict';
  const N = window.NR,
    C = N.CONFIG,
    R = N.rng;
  N.WEAPONS = {
    pulse: {
      name: 'PULSE CANNON',
      price: 0,
      damage: 10,
      cooldown: .115,
      speed: 750,
      life: .9,
      r: 4,
      recoil: 8,
      color: C.colors.cyanHi,
      sound: 'shot_pulse',
      pattern: 'bullet',
      tags: ['projectile'],
      description: 'Balanced automatic rounds'
    },
    nova: {
      name: 'NOVA SHOTGUN',
      price: 0,
      bossUnlock: true,
      damage: 7,
      cooldown: .75,
      speed: 700,
      life: .45,
      r: 3,
      recoil: 90,
      pellets: 8,
      spread: 28 * Math.PI / 180,
      color: C.colors.orange,
      sound: 'shot_nova',
      pattern: 'shotgun',
      tags: ['projectile'],
      description: 'Eight pellets in a short-range cone'
    },
    rail: {
      name: 'RAIL RIFLE',
      price: 400,
      damage: 120,
      cooldown: .9,
      charge: .5,
      r: 11,
      recoil: 160,
      pierce: 5,
      color: C.colors.purple,
      sound: 'shot_rail',
      pattern: 'beam',
      tags: ['hitscan'],
      description: 'Hold to charge / release to pierce'
    },
    arc: {
      name: 'ARC BLASTER',
      price: 300,
      damage: 14,
      cooldown: .16,
      speed: 900,
      life: .5,
      r: 4,
      recoil: 6,
      targets: 2,
      chainRange: 140,
      chainDamage: .6,
      color: C.colors.green,
      sound: 'shot_arc',
      pattern: 'arc',
      tags: ['projectile'],
      description: 'Fast darts chain to nearby targets'
    },
    void: {
      name: 'VOID ORB',
      price: 500,
      damage: 44,
      splash: 15,
      radius: 55,
      cooldown: .6,
      speed: 170,
      life: 2.6,
      r: 9,
      recoil: 20,
      turn: 2.5,
      range: 300,
      color: C.colors.pink,
      sound: 'shot_void',
      pattern: 'orb',
      tags: ['projectile'],
      description: 'Slow homing orb / area detonation'
    }
  };
  N.combat = {
    hit(e, amount, x, y, secondary) {
      if (!e || e.dead || e.cloak) return;
      const p = N.player.p,
        s = N.stats.get(),
        u = p.upgrades;
      let dmg = amount;
      if (e.elite || e.boss) dmg *= 1 + .25 * (u.amplifier || 0);
      if (e.affix === 'armored') dmg *= .7;
      if (!e.boss && N.world.enemies.some(o => o.type === 'sentinel' && o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 110 * N.world.S)) dmg *= .5;
      if (!secondary && R.chance(Math.min(C.caps.crit, s.crit + (p.weapon === 'pulse' ? .05 * (u.pulse_crit || 0) : 0)))) dmg *= s.critMult;
      if (e.boss) {
        N.bosses.hit(dmg);
        N.float(x || e.x, y || e.y, Math.round(dmg), C.colors.cyanHi);
        return;
      }
      e.hp -= dmg;
      e.hit = .13;
      N.bus.emit('enemyHit', {
        enemy: e,
        killed: e.hp <= 0,
        damage: dmg
      });
      N.float(e.x, e.y, Math.round(dmg), C.colors.text);
      N.particles.burst(e.x, e.y, e.color, 4, 100);
      if (dmg >= 500) N.achievements.unlock('overkill');
      if (!secondary) {
        if (u.burn) {
          e.burns = e.burns || [];
          if (e.burns.length < 12) e.burns.push({
            left: C.effects.burnDuration,
            rate: dmg * C.effects.burnFraction * u.burn / C.effects.burnDuration
          });
        }
        if (u.freeze && R.chance(C.effects.freezeChance * u.freeze)) e.slow = C.effects.freezeDuration;
        if (u.explosive && R.chance(C.effects.blastChance)) this.blast(e.x, e.y, C.effects.blastRadius * N.world.S, dmg * C.effects.blastFraction, 0, e);
        if (u.chain && R.chance(C.effects.chainChance * u.chain)) this.chain(e, dmg * C.effects.chainFraction, C.effects.chainTargets + u.chain - 1, C.effects.chainRange * N.world.S);
      }
      if (e.hp <= 0) N.enemies.kill(e);
    },
    blast(x, y, r, damage, push, except) {
      N.world.enemies.forEach(e => {
        const dx = e.x - x,
          dy = e.y - y,
          l = Math.hypot(dx, dy);
        if (e !== except && l < r + e.r * N.world.S) {
          this.hit(e, damage, e.x, e.y, true);
          if (push) {
            e.x += dx / Math.max(1, l) * push * N.world.S;
            e.y += dy / Math.max(1, l) * push * N.world.S;
          }
        }
      });
      const b = N.world.boss;
      if (b && Math.hypot(b.x - x, b.y - y) < r + b.r) this.hit(b, damage, x, y, true);
    },
    chain(e, damage, n, range) {
      let cur = e;
      const seen = [e];
      for (let i = 0; i < n; i++) {
        let near = null,
          dist = range;
        N.world.enemies.forEach(o => {
          const l = Math.hypot(o.x - cur.x, o.y - cur.y);
          if (!o.dead && !o.cloak && !seen.includes(o) && l < dist) {
            near = o;
            dist = l;
          }
        });
        if (!near) break;
        N.world.effects.push({
          kind: 'line',
          x: cur.x,
          y: cur.y,
          x2: near.x,
          y2: near.y,
          t: 0,
          life: .18,
          color: C.colors.green
        });
        this.hit(near, damage, near.x, near.y, true);
        seen.push(near);
        cur = near;
      }
    }
  };

  function bullet(p, d, angle, s) {
    const W = N.world,
      b = W.bullets.spawn();
    if (!b) return;
    const u = p.upgrades;
    Object.assign(b, {
      x: p.x + Math.cos(angle) * p.r * W.S,
      y: p.y + Math.sin(angle) * p.r * W.S,
      vx: Math.cos(angle) * d.speed * s.speedBullet * W.S,
      vy: Math.sin(angle) * d.speed * s.speedBullet * W.S,
      r: d.r * s.size,
      life: d.life,
      dmg: d.damage * s.damage,
      pierce: s.pierce,
      lastHit: null,
      hitIds: [],
      color: d.color,
      weapon: p.weapon,
      angle
    });
    if (p.weapon === 'pulse') {
      const k = 1 + .1 * (u.pulse_speed || 0);
      b.vx *= k;
      b.vy *= k;
    }
  }
  N.weapons = {
    current: 'pulse',
    fire(p) {
      const d = N.WEAPONS[p.weapon],
        s = N.stats.get(),
        u = p.upgrades;
      if (!d || p.cool > 0 || p.weapon === 'rail') return;
      let count = p.weapon === 'nova' ? d.pellets + (u.nova_pellets || 0) : 1 + (u.multishot || 0) + (p.weapon === 'void' ? (u.void_volley || 0) : 0);
      const cone = p.weapon === 'nova' ? d.spread * Math.pow(.85, u.nova_spread || 0) : .12 * (count - 1);
      for (let i = 0; i < count; i++) bullet(p, d, p.angle + (count > 1 ? (i / (count - 1) - .5) * cone : 0), s);
      p.shots++;
      if (p.weapon === 'pulse' && u.pulse_burst && p.shots % 6 === 0) {
        for (let i = 0; i < u.pulse_burst; i++) bullet(p, d, p.angle + (i - .5) * .06, s);
      }
      p.cool = d.cooldown / s.fireRate * (p.weapon === 'nova' ? Math.pow(.9, u.nova_cooldown || 0) : 1);
      p.vx -= Math.cos(p.angle) * d.recoil * N.world.S;
      p.vy -= Math.sin(p.angle) * d.recoil * N.world.S;
      N.particles.burst(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, d.color, 3, 70);
      N.bus.emit('weaponFired', d);
    },
    rail(p, dt) {
      const firing = N.input.isFiring(),
        d = N.WEAPONS.rail,
        s = N.stats.get();
      if (firing && p.cool <= 0) p.charge = Math.min(d.charge * Math.pow(.88, p.upgrades.rail_charge || 0), p.charge + dt);
      if (!firing && p.wasFiring && p.charge > 0 && p.cool <= 0) {
        const f = Math.min(1, p.charge / (d.charge * Math.pow(.88, p.upgrades.rail_charge || 0))),
          damage = d.damage * s.damage * (.4 + .6 * f),
          dx = Math.cos(p.angle),
          dy = Math.sin(p.angle),
          W = N.world,
          len = Math.hypot(W.W, W.H),
          width = d.r * (1 + .2 * (p.upgrades.rail_width || 0)) * W.S;
        const targets = W.enemies.concat(W.boss ? [W.boss] : []).map(e => ({
          e,
          t: (e.x - p.x) * dx + (e.y - p.y) * dy,
          perp: Math.abs((e.x - p.x) * dy - (e.y - p.y) * dx)
        })).filter(o => o.t > 0 && o.perp < width + o.e.r * W.S).sort((a, b) => a.t - b.t);
        targets.slice(0, Math.min(8, d.pierce + s.pierce + (p.upgrades.rail_pierce || 0)) + 1).forEach(o => N.combat.hit(o.e, damage, o.e.x, o.e.y));
        W.effects.push({
          kind: 'beam',
          x: p.x,
          y: p.y,
          x2: p.x + dx * len,
          y2: p.y + dy * len,
          t: 0,
          life: .24,
          width,
          color: d.color
        });
        p.shots++;
        p.cool = d.cooldown / s.fireRate;
        p.vx -= dx * d.recoil * W.S;
        p.vy -= dy * d.recoil * W.S;
        p.charge = 0;
        N.bus.emit('weaponFired', d);
      }
      p.wasFiring = firing;
    },
    updateBullet(b, dt) {
      const p = N.player.p,
        u = p.upgrades,
        d = N.WEAPONS[b.weapon];
      if ((u.homing || b.weapon === 'void') && b.weapon !== 'rail') {
        let target = null,
          dist = (b.weapon === 'void' ? d.range : C.effects.homingRange) * N.world.S;
        N.world.enemies.concat(N.world.boss ? [N.world.boss] : []).forEach(e => {
          const l = Math.hypot(e.x - b.x, e.y - b.y);
          if (!e.dead && !e.cloak && l < dist) {
            dist = l;
            target = e;
          }
        });
        if (target) {
          const want = Math.atan2(target.y - b.y, target.x - b.x),
            now = Math.atan2(b.vy, b.vx),
            diff = Math.atan2(Math.sin(want - now), Math.cos(want - now)),
            turn = (b.weapon === 'void' ? d.turn * (1 + .2 * (u.void_turn || 0)) : C.effects.homingTurn * u.homing) * dt,
            ang = now + N.utils.clamp(diff, -turn, turn),
            speed = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(ang) * speed;
          b.vy = Math.sin(ang) * speed;
        }
      }
    },
    onHit(e, b) {
      N.combat.hit(e, b.dmg, b.x, b.y);
      if (b.weapon === 'arc') {
        const d = N.WEAPONS.arc,
          u = N.player.p.upgrades;
        N.combat.chain(e, b.dmg * d.chainDamage * (1 + .1 * (u.arc_damage || 0)), d.targets + (u.arc_targets || 0), d.chainRange * (1 + .15 * (u.arc_range || 0)) * N.world.S);
      }
      if (b.weapon === 'void') {
        const d = N.WEAPONS.void;
        N.combat.blast(b.x, b.y, d.radius * (1 + .15 * (N.player.p.upgrades.void_radius || 0)) * N.world.S, d.splash * N.stats.get().damage, 0, e);
        N.world.effects.push({
          kind: 'ring',
          x: b.x,
          y: b.y,
          r: d.radius * N.world.S,
          t: 0,
          life: .3,
          color: d.color
        });
      }
    }
  };
})();
