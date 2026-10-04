(function() {
  'use strict';
  const N = window.NR;
  N.ACHIEVEMENTS = {
    first_blood: {
      name: 'FIRST BLOOD',
      description: 'Destroy an enemy',
      reward: 25
    },
    survivor: {
      name: 'SURVIVOR',
      description: 'Reach wave 5',
      reward: 25
    },
    rift_walker: {
      name: 'RIFT WALKER',
      description: 'Reach wave 10',
      reward: 50
    },
    boss_breaker: {
      name: 'BOSS BREAKER',
      description: 'Defeat a boss',
      reward: 50
    },
    untouchable: {
      name: 'UNTOUCHABLE',
      description: 'Clear a wave without damage',
      reward: 25
    },
    dash_master: {
      name: 'DASH MASTER',
      description: '10 lifetime kills during or within 0.5s of dash',
      reward: 50
    },
    overkill: {
      name: 'OVERKILL',
      description: 'Deal 500 damage with one hit',
      reward: 50
    },
    neon_god: {
      name: 'NEON GOD',
      description: 'Reach wave 25',
      reward: 100
    },
    arsenal: {
      name: 'ARSENAL',
      description: 'Own all 5 weapons',
      reward: 100
    },
    collector: {
      name: 'COLLECTOR',
      description: 'Own 3 ships',
      reward: 50
    },
    overclocked: {
      name: 'OVERCLOCKED',
      description: 'Reach rift level 10',
      reward: 25
    },
    chained: {
      name: 'CHAINED',
      description: 'Reach combo x20',
      reward: 50
    }
  };
  N.discover = (group, id) => {
    const key = group + ':' + id,
      s = N.save.data;
    if (!s.archives.includes(key)) {
      s.archives.push(key);
      N.save.commit();
    }
  };
  N.achievements = {
    unlock(id) {
      const s = N.save.data,
        d = N.ACHIEVEMENTS[id];
      if (!d || s.achievements[id]) return;
      s.achievements[id] = Date.now();
      s.shards += d.reward;
      N.save.commit();
      N.bus.emit('achievementUnlocked', d);
    },
    check() {
      const W = N.world,
        s = N.save.data,
        p = N.player.p;
      if (W.kills >= 1) this.unlock('first_blood');
      if (W.wave >= 5) this.unlock('survivor');
      if (W.wave >= 10) this.unlock('rift_walker');
      if (W.wave >= 25) this.unlock('neon_god');
      if (s.stats.dashKills >= 10) this.unlock('dash_master');
      if (s.unlocks.weapons.length >= 5) this.unlock('arsenal');
      if (s.unlocks.ships.length >= 3) this.unlock('collector');
      if (p.level >= 10) this.unlock('overclocked');
      if (W.combo >= 20) this.unlock('chained');
    }
  };
  N.bus.on('enemyKilled', () => N.achievements.check());
  N.bus.on('waveStarted', () => N.achievements.check());
  N.bus.on('levelUp', () => N.achievements.check());
})();
