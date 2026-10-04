(function() {
  'use strict';
  const N = window.NR,
    C = N.CONFIG,
    U = N.utils,
    mv = {
      x: 0,
      y: 0
    };
  N.player = {
    p: null,
    god: false,
    reset() {
      const W = N.world,
        l = N.save.data.loadout,
        ship = N.SHIPS[l.ship] || N.SHIPS.striker;
      this.p = {
        x: W.W / 2,
        y: W.H / 2,
        r: C.player.r,
        hp: 100,
        maxHp: 100,
        angle: 0,
        cool: 0,
        invuln: 0,
        dash: 0,
        dashCd: 0,
        dashCdMax: 2.3,
        vx: 0,
        vy: 0,
        alive: true,
        level: 1,
        xp: 0,
        xpTotal: 0,
        pending: 0,
        upgrades: {},
        buffs: {},
        ship: l.ship,
        weapon: l.weapon,
        ability: ship.ability || l.ability,
        abilityCd: 0,
        charge: 0,
        wasFiring: false,
        shots: 0,
        sinceHit: 100,
        barrierUsed: false,
        barrierCd: 0,
        revived: false,
        lastDash: -100,
        rerolls: 2,
        singularityTimer: 0
      };
      const s = N.stats.get();
      this.p.hp = this.p.maxHp = s.hp;
      N.weapons.current = this.p.weapon;
      return this.p;
    },
    update(dt) {
      const W = N.world,
        p = this.p,
        I = N.input,
        s = N.stats.get(),
        S = W.S,
        u = p.upgrades;
      p.maxHp = s.hp;
      p.hp = Math.min(p.hp, p.maxHp);
      p.cool = Math.max(0, p.cool - dt);
      p.invuln = Math.max(0, p.invuln - dt);
      p.dashCd = Math.max(0, p.dashCd - dt);
      p.dash = Math.max(0, p.dash - dt);
      p.abilityCd = Math.max(0, p.abilityCd - dt);
      p.barrierCd = Math.max(0, p.barrierCd - dt);
      p.sinceHit += dt;
      Object.keys(p.buffs).forEach(k => {
        p.buffs[k] = Math.max(0, p.buffs[k] - dt);
      });
      if (p.sinceHit >= 4 && s.regen) this.heal(s.regen * dt);
      I.getMove(mv);
      p.angle = Math.atan2(I.aim.y - p.y, I.aim.x - p.x);
      if (I.hasDashQueued() && p.dashCd <= 0) {
        I.consumeDash();
        const l = Math.hypot(mv.x, mv.y),
          dx = l > .01 ? mv.x / l : Math.cos(p.angle),
          dy = l > .01 ? mv.y / l : Math.sin(p.angle);
        p.vx += dx * s.impulse * S;
        p.vy += dy * s.impulse * S;
        p.dash = C.dash.duration;
        p.dashCd = p.dashCdMax = s.dashCd;
        p.invuln = Math.max(p.invuln, C.dash.invuln);
        p.lastDash = W.runTime;
        N.particles.burst(p.x, p.y, C.colors.cyanHi, 20);
        N.bus.emit('dashStarted', p);
      }
      let speed = s.speed;
      if (W.hazards.some(h => h.id === 'drag' && h.age > h.warning && Math.hypot(h.x - p.x, h.y - p.y) < h.r * S)) speed *= .55;
      const k = Math.min(1, dt * (p.dash > 0 ? C.player.dashAccel : W.event && W.event.id === 'gravity' ? 3 : C.player.accel));
      p.vx += (mv.x * speed * S - p.vx) * k;
      p.vy += (mv.y * speed * S - p.vy) * k;
      p.x = U.clamp(p.x + p.vx * dt, p.r * S, Math.max(p.r * S, W.W - p.r * S));
      p.y = U.clamp(p.y + p.vy * dt, p.r * S, Math.max(p.r * S, W.H - p.r * S));
      if (p.dash > 0 && s.ram) {
        W.enemies.forEach(e => {
          if (e.ramAt !== p.lastDash && Math.hypot(e.x - p.x, e.y - p.y) < (e.r + p.r) * S) {
            e.ramAt = p.lastDash;
            N.combat.hit(e, s.ram, e.x, e.y, true);
            e.x += Math.cos(p.angle) * 40 * S;
            e.y += Math.sin(p.angle) * 40 * S;
          }
        });
      }
      if (p.weapon === 'rail') N.weapons.rail(p, dt);
      else if (I.isFiring() && p.cool <= 0) N.weapons.fire(p);
      if (u.singularity) {
        p.singularityTimer += dt;
        if (p.singularityTimer >= C.effects.singularityGap) {
          p.singularityTimer = 0;
          W.well = {
            x: p.x,
            y: p.y,
            left: C.effects.singularityTime
          };
        }
        if (W.well) {
          W.well.left -= dt;
          W.enemies.forEach(e => {
            const dx = W.well.x - e.x,
              dy = W.well.y - e.y,
              l = Math.hypot(dx, dy);
            if (l < C.effects.singularityRange * S) {
              e.x += dx / Math.max(1, l) * C.effects.singularityPull * S * dt;
              e.y += dy / Math.max(1, l) * C.effects.singularityPull * S * dt;
            }
          });
          if (W.well.left <= 0) W.well = null;
        }
      }
    },
    damage(n) {
      const p = this.p,
        W = N.world;
      if (!p || !p.alive || p.invuln > 0 || this.god) return;
      const s = N.stats.get();
      n *= (1 - s.reduction) * s.taken;
      p.sinceHit = 0;
      W.waveDamaged = true;
      p.hp = Math.max(0, p.hp - n);
      p.invuln = C.damage.playerInvuln;
      W.shake = C.damage.maxShake;
      W.flash = C.damage.flash;
      W.combo = n >= 25 ? 0 : Math.floor(W.combo / 2);
      N.particles.burst(p.x, p.y, C.colors.red, 22, 190);
      N.bus.emit('playerDamaged', {
        amount: n,
        hp: p.hp
      });
      if (p.upgrades.barrier && !p.barrierUsed && p.barrierCd <= 0 && p.hp < p.maxHp * C.effects.barrierThreshold) {
        p.barrierUsed = true;
        p.barrierCd = C.effects.barrierCooldown / p.upgrades.barrier;
        p.invuln = C.effects.barrierInvuln;
        this.heal(C.effects.barrierHeal);
      }
      if (p.hp <= 0) {
        if (p.upgrades.second_chance && !p.revived) {
          p.revived = true;
          p.hp = p.maxHp * C.effects.reviveFraction;
          p.invuln = 2;
          N.combat.blast(p.x, p.y, 170 * W.S, 100, 140);
          N.bus.emit('revived');
        } else p.alive = false;
      }
    },
    heal(n) {
      if (this.p) this.p.hp = Math.min(this.p.maxHp, this.p.hp + n);
    }
  };
})();
