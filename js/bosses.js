(function() {
  'use strict';
  const N = window.NR,
    C = N.CONFIG,
    R = N.rng;
  N.BOSSES = {
    overlord: {
      name: 'RIFT OVERLORD',
      hp: 6000,
      scale: .6,
      radius: .11,
      minRadius: 70,
      maxRadius: 110,
      thresholds: [.5, .2],
      transition: 1.5,
      intro: 3,
      death: 1.2,
      gaps: [2.2, 1.6, 1.1],
      contact: 20,
      contactCd: .6,
      minionCap: 10,
      rewards: {
        xp: 500,
        score: 1000,
        firstShards: 50,
        shards: 40,
        heal: .5
      },
      attacks: [{
        id: 'bullet',
        name: 'BULLET RING',
        weight: 3,
        telegraph: .6,
        count: [16, 24, 32],
        speed: 200,
        damage: 12
      }, {
        id: 'laser',
        name: 'LASER SWEEP',
        weight: 2,
        telegraph: 1,
        width: 22,
        damage: 20,
        time: 1.8,
        arc: Math.PI * 2 / 3
      }, {
        id: 'summon',
        name: 'RIFT SUMMON',
        weight: 1,
        telegraph: .6
      }, {
        id: 'charge',
        name: 'CHARGE',
        weight: 2,
        telegraph: .8,
        speed: 520,
        damage: 30,
        stun: .8
      }, {
        id: 'shock',
        name: 'SHOCK RING',
        weight: 2,
        telegraph: 1,
        damage: 25,
        speed: 230,
        width: 12
      }]
    }
  };

  function choose(b) {
    const a = b.def.attacks.filter(d => d.id !== b.lastAttack);
    let roll = R.range(0, a.reduce((s, d) => s + d.weight, 0));
    for (const d of a) {
      roll -= d.weight;
      if (roll <= 0) return d;
    }
    return a[0];
  }
  N.bosses = {
    create(id, index) {
      const W = N.world,
        d = N.BOSSES[id] || N.BOSSES.overlord,
        hp = d.hp * (1 + d.scale * (index - 1));
      W.boss = {
        id,
        def: d,
        boss: true,
        x: W.W / 2,
        y: W.H * .24,
        r: N.utils.clamp(Math.min(W.W, W.H) * d.radius, d.minRadius, d.maxRadius),
        hp,
        maxHp: hp,
        phase: 0,
        invuln: 0,
        contact: 0,
        timer: d.gaps[0],
        attack: null,
        attackAge: 0,
        angle: 0,
        lastAttack: null,
        stun: 0,
        index,
        dead: false,
        deathAge: 0,
        warning: 0,
        charges: 0
      };
      const p = N.player.p,
        b = W.boss,
        dist = Math.hypot(p.x - b.x, p.y - b.y),
        safe = b.r + p.r * W.S + 50 * W.S;
      if (dist < safe) {
        p.x = N.utils.clamp(p.x, p.r * W.S, W.W - p.r * W.S);
        p.y = Math.min(W.H - p.r * W.S, b.y + safe);
      }
      N.discover('bosses', id);
      return W.boss;
    },
    bullet(x, y, angle, speed, damage) {
      const b = N.world.enemyBullets.spawn();
      if (b) Object.assign(b, {
        x,
        y,
        vx: Math.cos(angle) * speed * N.world.S,
        vy: Math.sin(angle) * speed * N.world.S,
        r: 6,
        damage,
        life: 8
      });
    },
    hit(damage) {
      const W = N.world,
        b = W.boss;
      if (!b || b.dead || b.invuln > 0 || N.game.state === 'BOSS_INTRO') return;
      b.hp = Math.max(0, b.hp - damage);
      b.hit = .15;
      N.bus.emit('bossHit');
      if (damage >= 150 && !N.reduced()) N.game.hitStop(.04);
      if (b.hp <= 0) {
        b.dead = true;
        b.deathAge = 0;
        W.enemyBullets.clear();
        W.shockRings.length = 0;
        W.enemies.forEach(e => e.dead = true);
        W.telegraphs.length = 0;
        W.timeScale = N.reduced() ? 1 : .25;
        N.bus.emit('bossDefeated');
        return;
      }
      const ph = b.hp / b.maxHp <= b.def.thresholds[1] ? 2 : b.hp / b.maxHp <= b.def.thresholds[0] ? 1 : 0;
      if (ph > b.phase) {
        b.phase = ph;
        b.invuln = b.def.transition;
        b.attack = null;
        b.timer = b.def.gaps[ph];
        W.enemyBullets.clear();
        W.shockRings.length = 0;
        N.pickups.create(b.x, b.y, 'shield');
        N.ui.announce('RIFT OVERLORD // PHASE ' + (ph + 1), 1.5);
      }
    },
    update(dt, real) {
      const W = N.world,
        b = W.boss,
        p = N.player.p;
      if (!b) return;
      if (b.dead) {
        b.deathAge += real;
        if (b.deathAge < b.def.death && R.chance(.2)) N.particles.burst(b.x + R.range(-b.r, b.r), b.y + R.range(-b.r, b.r), C.colors.pink, 8, 150);
        if (b.deathAge >= b.def.death) {
          W.timeScale = 1;
          this.reward();
        }
        return;
      }
      b.hit = Math.max(0, (b.hit || 0) - dt);
      b.invuln = Math.max(0, b.invuln - dt);
      b.contact = Math.max(0, b.contact - dt);
      b.stun = Math.max(0, b.stun - dt);
      if (b.contact <= 0 && Math.hypot(b.x - p.x, b.y - p.y) < b.r + p.r * W.S) {
        N.player.damage(b.def.contact);
        b.contact = b.def.contactCd;
      }
      if (b.invuln > 0 || b.stun > 0) return;
      if (!b.attack) {
        b.timer -= dt;
        if (b.timer <= 0) {
          b.attack = choose(b);
          b.lastAttack = b.attack.id;
          b.attackAge = 0;
          b.angle = Math.atan2(p.y - b.y, p.x - b.x);
          b.charges = b.phase + 1;
          N.bus.emit('bossTelegraph');
        } else {
          b.x += Math.cos(W.t * .5) * 10 * dt;
          b.y += Math.sin(W.t * .7) * 10 * dt;
        }
        return;
      }
      const a = b.attack;
      b.attackAge += dt;
      if (b.attackAge < a.telegraph) return;
      const t = b.attackAge - a.telegraph;
      if (a.id === 'bullet') {
        if (!b.executed) {
          let count = a.count[b.phase];
          for (let i = 0; i < count; i++) this.bullet(b.x, b.y, Math.PI * 2 * i / count + (b.index > 1 ? .1 : 0), a.speed, a.damage);
          if (b.phase === 2 || b.index > 1)
            for (let i = 0; i < count; i++) this.bullet(b.x, b.y, Math.PI * 2 * (i + .5) / count, a.speed * .8, a.damage);
          b.executed = true;
        }
        this.end(b);
      } else if (a.id === 'summon') {
        const ids = ['chaser', 'chaser', 'chaser', 'chaser'];
        if (b.phase > 0) ids.push('dasher', 'dasher');
        if (b.phase > 1) ids.push('phantom', 'bomber');
        ids.slice(0, Math.max(0, b.def.minionCap - W.enemies.length - W.telegraphs.length)).forEach(id => N.waves.schedule(id));
        this.end(b);
      } else if (a.id === 'laser') {
        const angle = b.angle + t / a.time * a.arc;
        for (let k = 0; k < b.phase + 1; k++) {
          const q = angle + k * Math.PI * 2 / (b.phase + 1),
            dx = p.x - b.x,
            dy = p.y - b.y,
            along = dx * Math.cos(q) + dy * Math.sin(q),
            perp = Math.abs(dx * Math.sin(q) - dy * Math.cos(q));
          if (along > 0 && perp < a.width / 2 + p.r * W.S) N.player.damage(a.damage);
        }
        b.liveAngle = angle;
        if (t >= a.time) this.end(b);
      } else if (a.id === 'charge') {
        b.x += Math.cos(b.angle) * a.speed * W.S * dt;
        b.y += Math.sin(b.angle) * a.speed * W.S * dt;
        if (Math.hypot(b.x - p.x, b.y - p.y) < b.r + p.r * W.S) N.player.damage(a.damage);
        if (b.x < b.r || b.x > W.W - b.r || b.y < b.r || b.y > W.H - b.r || t > 2) {
          b.x = N.utils.clamp(b.x, b.r, W.W - b.r);
          b.y = N.utils.clamp(b.y, b.r, W.H - b.r);
          b.charges--;
          if (b.charges > 0) {
            b.attackAge = 0;
            b.angle = Math.atan2(p.y - b.y, p.x - b.x);
          } else {
            b.stun = a.stun;
            this.end(b);
          }
        }
      } else if (a.id === 'shock') {
        for (let i = 0; i < b.phase + 1; i++) W.shockRings.push({
          x: b.x,
          y: b.y,
          r: 0,
          delay: i * .55,
          speed: a.speed * W.S,
          width: a.width,
          damage: a.damage
        });
        this.end(b);
      }
    },
    end(b) {
      b.attack = null;
      b.executed = false;
      b.liveAngle = null;
      b.timer = b.def.gaps[b.phase];
    },
    reward() {
      const W = N.world,
        b = W.boss,
        d = b.def.rewards,
        save = N.save.data,
        first = save.stats.bossKills === 0;
      W.boss = null;
      W.bossKills++;
      save.stats.bossKills++;
      const shards = first ? d.firstShards : d.shards;
      save.shards += shards;
      W.bossShards += shards;
      W.score += d.score;
      N.progress.gain(d.xp);
      N.player.heal(N.player.p.maxHp * d.heal);
      N.pickups.create(N.player.p.x - 35, N.player.p.y, 'shield');
      N.pickups.create(N.player.p.x + 35, N.player.p.y, 'core');
      if (first && !save.unlocks.weapons.includes('nova')) save.unlocks.weapons.push('nova');
      N.save.commit(true);
      N.achievements.unlock('boss_breaker');
      W.rewardInfo = {
        first,
        shards,
        xp: d.xp,
        score: d.score
      };
      N.game.setState('BOSS_REWARD');
    },
    updateProjectiles(dt) {
      const W = N.world,
        p = N.player.p;
      for (let i = W.enemyBullets.list.length - 1; i >= 0; i--) {
        const b = W.enemyBullets.list[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        if (b.life <= 0 || b.x < -30 || b.x > W.W + 30 || b.y < -30 || b.y > W.H + 30) {
          W.enemyBullets.killAt(i);
          continue;
        }
        if (p.alive && Math.hypot(b.x - p.x, b.y - p.y) < (p.r + b.r) * W.S) {
          N.player.damage(b.damage);
          W.enemyBullets.killAt(i);
        }
      }
      for (let i = W.shockRings.length - 1; i >= 0; i--) {
        const o = W.shockRings[i];
        if (o.delay > 0) {
          o.delay -= dt;
          continue;
        }
        const prev = o.r;
        o.r += o.speed * dt;
        const l = Math.hypot(p.x - o.x, p.y - o.y);
        if (l >= prev - o.width - p.r * W.S && l <= o.r + o.width + p.r * W.S) N.player.damage(o.damage);
        if (o.r > Math.hypot(W.W, W.H)) W.shockRings.splice(i, 1);
      }
    }
  };
})();
