(function() {
  'use strict';
  const N = window.NR,
    C = N.CONFIG,
    R = N.rng;
  C.director = {
    budgetBase: 8,
    budgetStep: 4.5,
    budgetAfter20: 3.5,
    eliteCaps: [1, 2, 3],
    eventFrom: 4,
    eventChance: .35,
    eventDelay: [6, 12],
    eventDuration: [12, 18],
    hazardFrom: 8,
    hazardCap: 3,
    hazardDistance: 200,
    hazardGap: 8
  };
  N.EVENTS = {
    storm: {
      name: 'RIFT STORM',
      description: 'Enemies move 30% faster'
    },
    power: {
      name: 'POWER SURGE',
      description: '+40% damage / +25% fire rate'
    },
    swarm: {
      name: 'SWARM',
      description: 'Weak hostiles arriving'
    },
    blackout: {
      name: 'BLACKOUT',
      description: 'Reduced visibility / danger remains visible'
    },
    gravity: {
      name: 'LOW GRAVITY',
      description: 'Reduced acceleration'
    }
  };
  N.HAZARDS = {
    mine: {
      name: 'ENERGY MINE',
      r: 90,
      warning: 1,
      life: 18,
      fuse: .8,
      trigger: 70,
      damage: 25
    },
    zone: {
      name: 'RIFT ZONE',
      r: 90,
      warning: 1.5,
      life: 9.5,
      damage: 6,
      tick: .5
    },
    drag: {
      name: 'DRAG FIELD',
      r: 100,
      warning: 1,
      life: 10
    }
  };

  function entry(minD) {
    const W = N.world,
      p = N.player.p,
      d = (minD || 160) * W.S,
      pad = 36 * W.S;
    let out = null;
    for (let i = 0; i < 30; i++) {
      const edge = R.int(0, 4),
        x = edge === 0 ? pad : edge === 1 ? W.W - pad : R.range(pad, W.W - pad),
        y = edge === 2 ? pad : edge === 3 ? W.H - pad : R.range(pad, W.H - pad);
      if (Math.hypot(x - p.x, y - p.y) >= d) return {
        x,
        y
      };
      out = {
        x,
        y
      };
    }
    const candidates = [{
      x: pad,
      y: pad
    }, {
      x: W.W - pad,
      y: pad
    }, {
      x: pad,
      y: W.H - pad
    }, {
      x: W.W - pad,
      y: W.H - pad
    }];
    return candidates.sort((a, b) => Math.hypot(b.x - p.x, b.y - p.y) - Math.hypot(a.x - p.x, a.y - p.y))[0];
  }
  N.waves = {
    aliveCap() {
      return N.input.touchCapable ? 25 : 35;
    },
    eliteCap() {
      return N.world.wave < 10 ? 1 : N.world.wave < 20 ? 2 : 3;
    },
    reset() {
      const W = N.world;
      W.wave = 0;
      W.spawnLeft = 0;
      W.spawnTotal = 0;
      W.spawnTimer = 0;
      W.cleared = false;
      W.restTimer = 0;
      W.queue = [];
      W.event = null;
      W.eventDelay = -1;
      W.hazardTimer = 0;
    },
    next() {
      const W = N.world;
      W.wave++;
      W.waveDamaged = false;
      N.player.p.barrierUsed = false;
      W.event = null;
      W.hazards.length = 0;
      W.eventDelay = W.wave >= 4 && W.wave % 5 !== 0 && R.chance(C.director.eventChance) ? R.range(...C.director.eventDelay) : -1;
      W.hazardTimer = C.director.hazardGap;
      if (W.wave % 5 === 0) {
        W.spawnLeft = 0;
        W.queue = [];
        N.bus.emit('waveStarted', {
          wave: W.wave,
          count: 0,
          boss: true
        });
        N.game.setState('BOSS_INTRO');
        return;
      }
      let budget = C.director.budgetBase + C.director.budgetStep * Math.min(20, W.wave) + Math.max(0, W.wave - 20) * C.director.budgetAfter20,
        queue = [];
      if (W.wave === 1) queue = Array(8).fill('chaser');
      else {
        let forced = [];
        if (W.wave === 2) forced = ['dasher', 'dasher'];
        if (W.wave === 3) forced = ['dasher', 'dasher', 'dasher'];
        if (W.wave === 4) forced = ['tank'];
        if (W.wave === 6) forced = ['phantom'];
        if (W.wave === 8) forced = ['bomber', 'mage'];
        if (W.wave === 9) forced = ['sentinel', 'tank', 'tank'];
        forced.forEach(id => {
          queue.push(id);
          budget -= N.ENEMY_TYPES[id].cost;
        });
        let elites = queue.filter(id => N.ENEMY_TYPES[id].elite).length;
        while (budget >= 1.5) {
          const candidates = Object.entries(N.ENEMY_TYPES).filter(([id, d]) => d.from <= W.wave && d.cost <= budget && (!d.elite || elites < N.waves.eliteCap()));
          if (!candidates.length) break;
          const pick = candidates[R.int(0, candidates.length)],
            id = pick[0];
          queue.push(id);
          budget -= pick[1].cost;
          if (pick[1].elite) elites++;
        }
      }
      W.queue = queue;
      W.spawnLeft = W.spawnTotal = queue.length;
      W.spawnTimer = C.waves.firstSpawnDelay;
      W.cleared = false;
      N.bus.emit('waveStarted', {
        wave: W.wave,
        count: queue.length
      });
    },
    setWave(n) {
      const W = N.world;
      W.enemies.length = 0;
      W.telegraphs.length = 0;
      W.enemyBullets.clear();
      W.boss = null;
      W.wave = Math.max(0, n - 1);
      this.next();
      if (W.wave % 5) N.game.setState('PLAYING');
    },
    remaining() {
      const W = N.world;
      return W.spawnLeft + W.telegraphs.length + W.enemies.filter(e => !e.dead).length + (W.boss ? 1 : 0);
    },
    schedule(type, weak) {
      const pos = entry();
      N.world.telegraphs.push({
        x: pos.x,
        y: pos.y,
        type,
        weak: !!weak,
        t: 0,
        dur: C.waves.telegraph
      });
    },
    telegraphs(dt) {
      const W = N.world;
      for (let i = W.telegraphs.length - 1; i >= 0; i--) {
        const t = W.telegraphs[i];
        t.t += dt;
        if (t.t >= t.dur) {
          if (W.enemies.length >= this.aliveCap()) continue;
          if (N.ENEMY_TYPES[t.type].elite && W.enemies.filter(e => e.elite && !e.dead).length >= this.eliteCap()) continue;
          N.enemies.create(t.type, t.x, t.y, W.wave, t.weak ? 'weak' : false);
          W.telegraphs.splice(i, 1);
        }
      }
    },
    clear() {
      const W = N.world;
      W.cleared = true;
      const bonus = Math.round(W.wave * C.waves.clearBonusPerWave * (W.waveDamaged ? 1 : 1.5));
      W.score += bonus;
      N.player.heal(C.waves.clearHeal);
      N.bus.emit('waveCleared', {
        wave: W.wave,
        bonus,
        flawless: !W.waveDamaged
      });
      if (!W.waveDamaged) N.achievements.unlock('untouchable');
      W.restTimer = C.waves.restTime;
    },
    update(dt) {
      const W = N.world;
      this.telegraphs(dt);
      this.variety(dt);
      if (W.spawnLeft > 0) {
        W.spawnTimer -= dt;
        if (W.spawnTimer <= 0 && W.enemies.length + W.telegraphs.length < this.aliveCap()) {
          const id = W.queue.shift();
          if (id) {
            this.schedule(id);
            W.spawnLeft--;
            W.spawnTimer = Math.max(C.waves.gapMin, C.waves.gapBase - W.wave * C.waves.gapPerWave) * R.range(...C.waves.gapJitter);
          }
        }
        return null;
      }
      if (!W.cleared && !W.telegraphs.length && !W.enemies.some(e => !e.dead)) {
        this.clear();
        return 'cleared';
      }
      return null;
    },
    forceEvent(id) {
      const W = N.world;
      if (W.boss || W.wave % 5 === 0 || !N.EVENTS[id]) return false;
      W.event = {
        id,
        left: R.range(...C.director.eventDuration),
        swarmLeft: id === 'swarm' ? R.int(8, 13) : 0,
        timer: 0
      };
      N.ui.announce('RIFT EVENT // ' + N.EVENTS[id].name, 2);
      return true;
    },
    variety(dt) {
      const W = N.world,
        p = N.player.p;
      if (!W.boss && W.wave % 5 !== 0) {
        if (W.eventDelay > 0) {
          W.eventDelay -= dt;
          if (W.eventDelay <= 0) this.forceEvent(Object.keys(N.EVENTS)[R.int(0, 5)]);
        }
        if (W.event) {
          W.event.left -= dt;
          if (W.event.id === 'swarm' && W.event.swarmLeft > 0) {
            W.event.timer -= dt;
            if (W.event.timer <= 0 && W.enemies.length + W.telegraphs.length < this.aliveCap()) {
              this.schedule('chaser', true);
              W.event.swarmLeft--;
              W.event.timer = .25;
            }
          }
          if (W.event.left <= 0) W.event = null;
        }
        if (W.wave >= C.director.hazardFrom) {
          W.hazardTimer -= dt;
          if (W.hazardTimer <= 0 && W.hazards.length < C.director.hazardCap) {
            const id = ['mine', 'zone', 'drag'][R.int(0, 3)],
              d = N.HAZARDS[id],
              pos = entry(C.director.hazardDistance);
            W.hazards.push({
              id,
              ...pos,
              r: d.r,
              age: 0,
              warning: d.warning,
              life: d.life,
              fuse: 0,
              tick: 0
            });
            W.hazardTimer = C.director.hazardGap;
          }
        }
      }
      for (let i = W.hazards.length - 1; i >= 0; i--) {
        const h = W.hazards[i],
          d = N.HAZARDS[h.id];
        h.age += dt;
        const dist = Math.hypot(p.x - h.x, p.y - h.y);
        if (h.age >= h.warning) {
          if (h.id === 'volatile') {
            if (dist < h.r * W.S) N.player.damage(25);
            h.life = 0;
          }
          if (h.id === 'mine' && (dist < d.trigger * W.S || h.fuse > 0)) {
            h.fuse += dt;
            if (h.fuse >= d.fuse) {
              if (dist < h.r * W.S) N.player.damage(d.damage);
              N.combat.blast(h.x, h.y, h.r * W.S, d.damage, 80);
              W.effects.push({
                kind: 'ring',
                x: h.x,
                y: h.y,
                r: h.r * W.S,
                t: 0,
                life: .4,
                color: C.colors.orange
              });
              h.life = 0;
            }
          }
          if (h.id === 'zone') {
            h.tick -= dt;
            if (h.tick <= 0) {
              if (dist < h.r * W.S) N.player.damage(d.damage);
              h.tick = d.tick;
            }
          }
        }
        if (h.age >= h.life) W.hazards.splice(i, 1);
      }
    }
  };
})();
