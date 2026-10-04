(function() {
  'use strict';
  const N = window.NR,
    C = N.CONFIG,
    R = N.rng;
  N.ENEMY_TYPES = {
    chaser: {
      name: 'CHASER',
      shape: 'hex',
      color: C.colors.pink,
      r: 13,
      hp: w => 20 + 10 * Math.floor(w / 5),
      speed: w => Math.min(150, 58 + 3 * w),
      contact: 10,
      score: 100,
      xp: 10,
      cost: 1.5,
      from: 1
    },
    dasher: {
      name: 'DASHER',
      shape: 'tri',
      color: C.colors.orange,
      r: 10,
      hp: w => 10 + 10 * Math.floor(w / 7),
      speed: w => Math.min(220, 110 + 4 * w),
      contact: 15,
      score: 150,
      xp: 15,
      cost: 2,
      from: 2,
      burst: 2.2
    },
    tank: {
      name: 'TANK',
      shape: 'oct',
      color: C.colors.purple,
      r: 23,
      hp: w => 80 + 10 * w,
      speed: w => Math.min(130, 35 + 2 * w),
      contact: 25,
      score: 300,
      xp: 30,
      cost: 6,
      from: 4
    },
    phantom: {
      name: 'PHANTOM',
      shape: 'diamond',
      color: '#d6bbff',
      r: 11,
      hp: () => 60,
      speed: () => 150,
      contact: 20,
      score: 500,
      xp: 75,
      cost: 6,
      from: 6,
      elite: true
    },
    bomber: {
      name: 'BOMBER',
      shape: 'spike',
      color: '#ff885d',
      r: 14,
      hp: () => 40,
      speed: () => 130,
      contact: 0,
      score: 400,
      xp: 60,
      cost: 5,
      from: 8,
      elite: true
    },
    mage: {
      name: 'RIFT MAGE',
      shape: 'pent',
      color: '#e185ff',
      r: 13,
      hp: () => 70,
      speed: () => 90,
      contact: 12,
      score: 700,
      xp: 100,
      cost: 8,
      from: 8,
      elite: true
    },
    sentinel: {
      name: 'SENTINEL',
      shape: 'square',
      color: '#ffda80',
      r: 20,
      hp: () => 200,
      speed: () => 40,
      contact: 20,
      score: 700,
      xp: 100,
      cost: 8,
      from: 9,
      elite: true
    }
  };
  C.enemyBehavior = {
    phantomVisible: 2.5,
    phantomFade: .4,
    phantomCloak: 1.2,
    phantomWarning: .6,
    phantomNear: 120,
    phantomFar: 220,
    phantomLunge: .4,
    phantomBurst: 3,
    bomberTrigger: 90,
    bomberFuse: .9,
    bomberRadius: 80,
    bomberDamage: 30,
    mageNear: 280,
    mageFar: 380,
    mageShotGap: 2.2,
    mageTelegraph: .5,
    mageTeleportGap: 4,
    mageTeleportWarning: .5,
    mageBulletSpeed: 160,
    mageSpread: .22,
    sentinelAura: 110,
    affixFrom: 7,
    affixChance: .06,
    affixPerWave: .01,
    affixCap: .15,
    affixHP: 3,
    affixSize: 1.25,
    affixXP: 4,
    swiftSpeed: 1.35,
    volatileWarning: .5
  };
  N.enemies = {
    create(type, x, y, wave, noAffix) {
      const d = N.ENEMY_TYPES[type];
      if (!d) return null;
      const hp = d.hp(wave) * (1 + C.waves.hpScalePerWave * Math.max(0, wave - C.waves.hpScaleAfter)),
        e = {
          type,
          def: d,
          x,
          y,
          r: d.r,
          hp,
          maxHp: hp,
          speed: d.speed(wave),
          color: d.color,
          score: d.score,
          xp: d.xp,
          hit: 0,
          phase: R.range(0, 6),
          contact: 0,
          dead: false,
          elite: !!d.elite,
          age: 0,
          slow: 0,
          fuse: 0,
          timer: 0,
          teleport: 0,
          shotTimer: 0,
          cloak: false,
          burns: []
        };
      if (!noAffix && !e.elite && N.world.enemies.filter(e => e.elite && !e.dead).length < N.waves.eliteCap() && wave >= C.enemyBehavior.affixFrom && R.chance(Math.min(C.enemyBehavior.affixCap, C.enemyBehavior.affixChance + (wave - C.enemyBehavior.affixFrom) * C.enemyBehavior.affixPerWave))) {
        e.affix = ['swift', 'armored', 'volatile'][R.int(0, 3)];
        e.elite = true;
        e.hp *= C.enemyBehavior.affixHP;
        e.maxHp = e.hp;
        e.r *= C.enemyBehavior.affixSize;
        e.xp *= C.enemyBehavior.affixXP;
        if (e.affix === 'swift') e.speed *= C.enemyBehavior.swiftSpeed;
      }
      if (noAffix === 'weak') {
        e.hp *= .5;
        e.maxHp = e.hp;
        e.xp = Math.max(1, Math.floor(e.xp * .5));
      }
      N.world.enemies.push(e);
      N.discover('enemies', type);
      return e;
    },
    hit(e, b) {
      N.weapons.onHit(e, b);
    },
    kill(e) {
      if (e.dead) return;
      const W = N.world,
        p = N.player.p,
        s = N.stats.get();
      e.dead = true;
      W.combo = W.comboTimer > 0 ? W.combo + 1 : 1;
      W.comboTimer = C.progress.comboWindow;
      W.maxCombo = Math.max(W.maxCombo, W.combo);
      const score = Math.round(e.score * (1 + C.progress.comboStep * Math.min(W.combo, C.progress.comboCap)) * s.score);
      W.score += score;
      W.kills++;
      if (W.runTime - p.lastDash <= .5) {
        W.dashKills++;
        N.save.data.stats.dashKills = (N.save.data.stats.dashKills || 0) + 1;
      }
      N.float(e.x, e.y, '+' + score, e.color);
      N.pickups.gem(e.x, e.y, e.xp);
      N.pickups.maybeDrop(e);
      N.particles.burst(e.x, e.y, e.color, e.type === 'tank' ? 35 : 16, 230);
      N.bus.emit('enemyKilled', e);
      if (e.affix === 'volatile' && W.hazards.length < 3) W.hazards.push({
        id: 'volatile',
        x: e.x,
        y: e.y,
        r: 80,
        age: 0,
        warning: C.enemyBehavior.volatileWarning,
        life: C.enemyBehavior.volatileWarning + .1
      });
      if (p.upgrades.overkill && R.chance(C.effects.overkillChance)) N.combat.blast(e.x, e.y, C.effects.overkillRadius * W.S, e.maxHp * C.effects.overkillFraction, 0, e);
    },
    compact() {
      const a = N.world.enemies;
      let k = 0;
      for (let i = 0; i < a.length; i++)
        if (!a[i].dead) a[k++] = a[i];
      a.length = k;
    },
    update(dt) {
      const W = N.world,
        p = N.player.p,
        S = W.S,
        B = C.enemyBehavior,
        a = W.enemies;
      for (const e of a) {
        if (e.dead) continue;
        e.age += dt;
        e.phase += dt;
        e.hit = Math.max(0, e.hit - dt);
        e.contact = Math.max(0, e.contact - dt);
        e.slow = Math.max(0, e.slow - dt);
        for (let i = e.burns.length - 1; i >= 0; i--) {
          const b = e.burns[i],
            t = Math.min(dt, b.left);
          b.left -= t;
          N.combat.hit(e, b.rate * t, e.x, e.y, true);
          if (b.left <= 0) e.burns.splice(i, 1);
        }
        if (e.dead) continue;
        let ang = Math.atan2(p.y - e.y, p.x - e.x),
          dist = Math.hypot(e.x - p.x, e.y - p.y),
          mult = e.slow > 0 ? 1 - C.effects.freezeSlow : 1;
        if (W.event && W.event.id === 'storm') mult *= 1.3;
        if (e.type === 'phantom') {
          const cycle = B.phantomVisible + B.phantomFade + B.phantomCloak + B.phantomWarning + B.phantomLunge,
            t = e.age % cycle;
          const warningStart = B.phantomVisible + B.phantomFade + B.phantomCloak;
          e.cloak = t > B.phantomVisible + B.phantomFade && t < warningStart + B.phantomWarning;
          e.alpha = t < B.phantomVisible ? 1 : t < B.phantomVisible + B.phantomFade ? 1 - (t - B.phantomVisible) / B.phantomFade : e.cloak ? .12 : 1;
          if (t >= warningStart && t < warningStart + B.phantomWarning) {
            if (!e.destination) {
              const q = R.range(0, Math.PI * 2),
                d = R.range(B.phantomNear, B.phantomFar) * S;
              e.destination = {
                x: N.utils.clamp(p.x + Math.cos(q) * d, 20, W.W - 20),
                y: N.utils.clamp(p.y + Math.sin(q) * d, 20, W.H - 20)
              };
            }
            e.warning = e.destination;
            mult = 0;
          } else if (t >= warningStart + B.phantomWarning) {
            if (e.destination) {
              e.x = e.destination.x;
              e.y = e.destination.y;
              e.destination = null;
              e.warning = null;
            }
            mult *= B.phantomBurst;
          } else if (e.cloak) mult = 0;
        }
        if (e.type === 'bomber') {
          if (dist < B.bomberTrigger * S || e.fuse > 0) {
            e.fuse += dt;
            mult = 0;
            if (e.fuse >= B.bomberFuse) {
              if (dist < B.bomberRadius * S) N.player.damage(B.bomberDamage);
              N.combat.blast(e.x, e.y, B.bomberRadius * S, B.bomberDamage, 70, e);
              W.effects.push({
                kind: 'ring',
                x: e.x,
                y: e.y,
                r: B.bomberRadius * S,
                t: 0,
                life: .4,
                color: C.colors.orange
              });
              this.kill(e);
              continue;
            }
          }
        }
        if (e.type === 'mage') {
          e.timer += dt;
          e.shotTimer += dt;
          if (e.timer > B.mageTeleportGap) {
            e.teleport += dt;
            mult = 0;
            if (!e.destination) {
              const q = R.range(0, 6.28);
              e.destination = {
                x: N.utils.clamp(p.x + Math.cos(q) * B.mageNear * S, 30, W.W - 30),
                y: N.utils.clamp(p.y + Math.sin(q) * B.mageNear * S, 30, W.H - 30)
              };
            }
            e.warning = e.destination;
            if (e.teleport >= B.mageTeleportWarning) {
              e.x = e.destination.x;
              e.y = e.destination.y;
              e.destination = null;
              e.warning = null;
              e.timer = 0;
              e.teleport = 0;
            }
          }
          if (e.shotTimer > B.mageShotGap) {
            e.aimWarning = ang;
            if (e.shotTimer >= B.mageShotGap + B.mageTelegraph) {
              for (let i = -1; i <= 1; i++) N.bosses.bullet(e.x, e.y, ang + i * B.mageSpread, B.mageBulletSpeed, 12);
              e.shotTimer = 0;
              e.aimWarning = null;
            }
          }
          if (dist < B.mageNear * S) ang += Math.PI;
          else if (dist < B.mageFar * S) mult = 0;
        }
        const burst = e.def.burst && Math.sin(e.phase * 4) > .75 ? e.def.burst : 1;
        if (!e.cloak) {
          e.x += Math.cos(ang) * e.speed * S * burst * mult * dt;
          e.y += Math.sin(ang) * e.speed * S * burst * mult * dt;
        }
        if (p.alive && !e.cloak && e.contact <= 0 && dist < (e.r + p.r) * S) {
          N.player.damage(e.def.contact);
          e.contact = C.damage.contactCooldown;
        }
      }
      for (let i = 0; i < a.length; i++)
        for (let k = i + 1; k < a.length; k++) {
          const e = a[i],
            o = a[k],
            dx = e.x - o.x,
            dy = e.y - o.y,
            d = Math.hypot(dx, dy),
            min = (e.r + o.r) * S;
          if (!e.dead && !o.dead && d < min && d > .01) {
            const push = (min - d) * .35;
            e.x += dx / d * push;
            e.y += dy / d * push;
            o.x -= dx / d * push;
            o.y -= dy / d * push;
          }
        }
    }
  };
})();
