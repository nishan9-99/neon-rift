(function() {
  'use strict';
  const N = window.NR,
    R = N.rng;
  const T = N.UPGRADES = {};

  function def(id, name, category, rarity, max, effect, desc, weapon) {
    T[id] = {
      id,
      name,
      category,
      rarity,
      maxLevel: max,
      tags: weapon ? [weapon] : [],
      requires: [],
      description: l => desc + ' / level ' + l,
      apply(s, l) {
        const m = {};
        Object.keys(effect).forEach(k => {
          if (['hp', 'pierce', 'crit', 'critMult', 'reduction'].includes(k)) s.add[k] = (s.add[k] || 0) + effect[k] * l;
          else m[k] = effect[k] * l;
        });
        s.mul.push(m);
      }
    };
  }
  const rows = [
    ['overcharge', 'OVERCHARGE', 'OFFENSIVE', 'Common', 5, {
      damage: .12
    }, '+12% damage'],
    ['rapid_fire', 'RAPID FIRE', 'OFFENSIVE', 'Common', 5, {
      fireRate: .10
    }, '+10% fire rate'],
    ['crit_core', 'CRITICAL CORE', 'OFFENSIVE', 'Rare', 5, {
      crit: .08,
      critMult: .25
    }, '+8% critical chance, +0.25 critical multiplier'],
    ['velocity', 'PROJECTILE VELOCITY', 'OFFENSIVE', 'Common', 3, {
      speedBullet: .12
    }, '+12% speed and range'],
    ['caliber', 'PROJECTILE SIZE', 'OFFENSIVE', 'Common', 3, {
      size: .12
    }, '+12% hit size'],
    ['piercing', 'PIERCING', 'OFFENSIVE', 'Rare', 3, {
      pierce: 1
    }, '+1 pierce'],
    ['multishot', 'MULTI-SHOT', 'OFFENSIVE', 'Epic', 3, {
      damage: -.08
    }, '+1 projectile, -8% damage'],
    ['amplifier', 'DAMAGE AMPLIFIER', 'OFFENSIVE', 'Rare', 3, {}, '+25% elite and boss damage'],
    ['reinforced', 'REINFORCED SHIELD', 'DEFENSIVE', 'Common', 5, {
      hp: 15
    }, '+15 shield capacity and repair'],
    ['regen', 'SHIELD REGENERATION', 'DEFENSIVE', 'Rare', 4, {}, '+0.6 shield/s after 4 seconds unharmed'],
    ['plating', 'DAMAGE REDUCTION', 'DEFENSIVE', 'Rare', 5, {
      reduction: .06
    }, '-6% damage taken'],
    ['barrier', 'EMERGENCY BARRIER', 'DEFENSIVE', 'Epic', 3, {}, 'Once per wave: low shield repair and invulnerability'],
    ['phase_drive', 'PHASE DRIVE', 'MOBILITY', 'Common', 5, {
      speed: .06
    }, '+6% movement speed'],
    ['dash_reactor', 'DASH REACTOR', 'MOBILITY', 'Rare', 3, {}, '+25 dash damage'],
    ['dash_distance', 'DASH DISTANCE', 'MOBILITY', 'Common', 3, {
      impulse: .12
    }, '+12% dash impulse'],
    ['dash_cooldown', 'DASH COOLDOWN', 'MOBILITY', 'Common', 4, {
      dashCd: -.1
    }, '-10% dash cooldown'],
    ['magnetic', 'MAGNETIC CORE', 'UTILITY', 'Common', 4, {
      pickup: .25
    }, '+25% pickup radius'],
    ['xp_amp', 'XP AMPLIFIER', 'UTILITY', 'Common', 5, {
      xp: .1
    }, '+10% XP'],
    ['pickup_time', 'SCAVENGER', 'UTILITY', 'Common', 3, {
      lifetime: .3,
      duration: .15
    }, '+30% pickup life, +15% buff duration'],
    ['score_mult', 'SCORE MULTIPLIER', 'UTILITY', 'Common', 5, {
      score: .08
    }, '+8% score'],
    ['chain', 'CHAIN LIGHTNING', 'SPECIAL', 'Epic', 3, {}, 'Chance to arc to nearby enemies'],
    ['explosive', 'EXPLOSIVE ROUNDS', 'SPECIAL', 'Epic', 3, {}, '20% chance of a 50px blast'],
    ['homing', 'HOMING ROUNDS', 'SPECIAL', 'Epic', 3, {}, 'Projectiles steer toward enemies'],
    ['burn', 'PLASMA BURN', 'SPECIAL', 'Rare', 3, {}, '30% of hit damage burns over 3 seconds'],
    ['freeze', 'FREEZE PROTOCOL', 'SPECIAL', 'Rare', 3, {}, 'Chance to slow enemies by 40%'],
    ['singularity', 'SINGULARITY', 'LEGENDARY', 'Legendary', 1, {}, 'A gravity well every 12 seconds'],
    ['overkill', 'OVERKILL ENGINE', 'LEGENDARY', 'Legendary', 1, {}, '15% of kills detonate'],
    ['second_chance', 'SECOND CHANCE', 'LEGENDARY', 'Legendary', 1, {}, 'Revive once per run at 50% shield']
  ];
  rows.forEach(r => def(...r));
  [
    ['nova', 'pellets', 'PELLET ARRAY', '+1 pellet'],
    ['nova', 'spread', 'FOCUSED CONE', '-15% spread'],
    ['nova', 'cooldown', 'NOVA CYCLER', '-10% cooldown'],
    ['rail', 'charge', 'CHARGE ACCELERATOR', '-12% charge time'],
    ['rail', 'pierce', 'RAIL PENETRATOR', '+1 pierce cap'],
    ['rail', 'width', 'WIDE BEAM', 'Wider beam'],
    ['pulse', 'speed', 'PULSE VELOCITY', '+10% projectile speed'],
    ['pulse', 'crit', 'PULSE PRECISION', '+5% crit'],
    ['pulse', 'burst', 'BURST CIRCUIT', 'Burst-fire every sixth shot'],
    ['arc', 'targets', 'CHAIN ARRAY', '+1 chain target'],
    ['arc', 'range', 'ARC REACH', '+15% chain range'],
    ['arc', 'damage', 'ARC AMPLIFIER', '+10% chain damage'],
    ['void', 'turn', 'ORB GUIDANCE', '+20% homing'],
    ['void', 'volley', 'ORB ARRAY', '+1 orb per volley'],
    ['void', 'radius', 'VOID BLOOM', '+15% blast radius']
  ].forEach(([w, id, n, d]) => def(w + '_' + id, n, 'WEAPON', 'Rare', 3, {}, d, w));
  N.progress = {
    need: l => Math.round(N.CONFIG.progress.xpBase + N.CONFIG.progress.xpLinear * l + N.CONFIG.progress.xpPower * Math.pow(l, N.CONFIG.progress.xpExponent)),
    gain(n) {
      const p = N.player.p;
      if (!p.alive) return;
      n *= N.stats.get().xp;
      p.xp += n;
      p.xpTotal += n;
      while (p.xp >= this.need(p.level)) {
        p.xp -= this.need(p.level);
        p.level++;
        p.pending++;
        N.bus.emit('levelUp', p.level);
      }
    },
    offer(reward) {
      const p = N.player.p;
      let a = Object.values(T).filter(d => (p.upgrades[d.id] || 0) < d.maxLevel && (!d.tags.length || d.tags.includes(p.weapon)) && !(d.id === 'piercing' && p.weapon === 'void') && !(d.id === 'multishot' && ['rail', 'nova'].includes(p.weapon)) && !(d.id === 'homing' && p.weapon === 'rail') && (reward ? d.rarity !== 'Common' : (d.rarity !== 'Epic' || p.level >= 5) && (d.rarity !== 'Legendary' || p.level >= 10)));
      const out = [];
      while (a.length && out.length < 3) {
        const weights = a.map(d => ({
          Common: 60,
          Rare: 25,
          Epic: 12,
          Legendary: 3
        } [d.rarity]));
        let n = R.range(0, weights.reduce((x, y) => x + y, 0)),
          i = 0;
        while (i < weights.length - 1 && (n -= weights[i]) >= 0) i++;
        out.push(a.splice(i, 1)[0]);
      }
      while (out.length < 3) {
        const i = out.length;
        out.push({
          id: 'fallback_' + i,
          name: i % 2 ? 'SCORE CACHE' : 'REPAIR',
          category: 'UTILITY',
          rarity: 'Common',
          description: () => i % 2 ? '+500 score' : '+25 shield',
          maxLevel: 1
        });
      }
      return out;
    },
    install(id) {
      const p = N.player.p;
      if (id.startsWith('fallback')) {
        if (Number(id.split('_')[1]) % 2) N.world.score += 500;
        else N.player.heal(25);
      } else {
        p.upgrades[id] = (p.upgrades[id] || 0) + 1;
        if (id === 'reinforced') {
          p.maxHp = N.stats.get().hp;
          N.player.heal(15);
        }
        N.discover('upgrades', id);
      }
      N.bus.emit('upgradeInstalled', id);
    }
  };
})();
