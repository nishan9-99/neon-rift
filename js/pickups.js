(function() {
  'use strict';
  const N = window.NR,
    C = N.CONFIG,
    R = N.rng;
  N.PICKUPS = {
    shield: {
      name: 'SHIELD CELL',
      shape: 'cross',
      color: C.colors.green,
      weight: 35,
      heal: 25
    },
    overdrive: {
      name: 'OVERDRIVE',
      shape: 'chevron',
      color: C.colors.orange,
      weight: 15,
      duration: 8
    },
    core: {
      name: 'RIFT CORE',
      shape: 'diamond',
      color: C.colors.purple,
      weight: 15,
      duration: 8
    },
    phase: {
      name: 'PHASE ENERGY',
      shape: 'ring',
      color: C.colors.cyan,
      weight: 12,
      duration: 3
    },
    magnet: {
      name: 'MAGNET',
      shape: 'magnet',
      color: C.colors.text,
      weight: 13,
      duration: 8
    },
    berserk: {
      name: 'BERSERK',
      shape: 'spike',
      color: C.colors.red,
      weight: 10,
      duration: 10
    }
  };
  C.gems = {
    cap: 120,
    attractSpeed: 380,
    r: 4
  };
  C.pickups.drop = .07;
  C.pickups.eliteDrop = .35;
  N.pickups = {
    create(x, y, id) {
      const W = N.world;
      if (W.pickups.length >= C.pickups.max) W.pickups.shift();
      const d = N.PICKUPS[id || 'shield'];
      W.pickups.push({
        x,
        y,
        id: id || 'shield',
        r: 10,
        life: 11 * N.stats.get().lifetime,
        maxLife: 11 * N.stats.get().lifetime,
        color: d.color
      });
    },
    maybeDrop(e) {
      if (!R.chance(e.elite ? C.pickups.eliteDrop : C.pickups.drop)) return;
      let n = R.range(0, 100),
        id = 'shield';
      for (const [k, d] of Object.entries(N.PICKUPS)) {
        n -= d.weight;
        if (n < 0) {
          id = k;
          break;
        }
      }
      this.create(e.x, e.y, id);
    },
    gem(x, y, value) {
      const W = N.world;
      if (W.gems.list.length >= C.gems.cap) {
        let g = W.gems.list[0],
          l = Infinity;
        W.gems.list.forEach(o => {
          const d = Math.hypot(o.x - x, o.y - y);
          if (d < l) {
            l = d;
            g = o;
          }
        });
        g.value += value;
        return;
      }
      const g = W.gems.spawn();
      Object.assign(g, {
        x,
        y,
        value,
        r: C.gems.r,
        age: 0,
        speed: 0
      });
    },
    update(dt) {
      const W = N.world,
        p = N.player.p,
        s = N.stats.get();
      for (let i = W.pickups.length - 1; i >= 0; i--) {
        const o = W.pickups[i];
        o.life -= dt;
        if (o.life <= 0) {
          W.pickups.splice(i, 1);
          continue;
        }
        if (p.alive && Math.hypot(o.x - p.x, o.y - p.y) < (o.r + p.r) * W.S) {
          const d = N.PICKUPS[o.id];
          if (d.heal) {
            N.player.heal(d.heal);
            W.score += 50;
          } else {
            p.buffs[o.id] = d.duration * s.duration;
            if (o.id === 'phase') p.dashCd = 0;
          }
          W.pickups.splice(i, 1);
          N.float(p.x, p.y - 20, d.heal ? '+25 SHIELD' : d.name, d.color);
          N.particles.burst(p.x, p.y, d.color, 12);
          N.bus.emit('pickupCollected', o);
        }
      }
      for (let i = W.gems.list.length - 1; i >= 0; i--) {
        const g = W.gems.list[i];
        g.age += dt;
        const dx = p.x - g.x,
          dy = p.y - g.y,
          l = Math.hypot(dx, dy);
        if (p.alive && (l < s.pickup * W.S || p.buffs.magnet > 0)) {
          g.speed = Math.min(800, g.speed + 900 * dt);
          g.x += dx / Math.max(1, l) * g.speed * dt;
          g.y += dy / Math.max(1, l) * g.speed * dt;
        }
        if (p.alive && l < (p.r + g.r) * W.S) {
          N.progress.gain(g.value);
          N.float(p.x, p.y, '+' + g.value + ' XP', C.colors.purple);
          N.bus.emit('gemCollected', g.value);
          W.gems.killAt(i);
        }
      }
    }
  };
})();
