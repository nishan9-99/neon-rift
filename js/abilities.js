(function() {
  'use strict';
  const N = window.NR;
  N.ABILITIES = {
    dash: {
      name: 'PHASE DASH',
      price: 0
    },
    shockburst: {
      name: 'SHOCKBURST',
      price: 250,
      radius: 170,
      damage: 60,
      knockback: 170,
      invuln: .3,
      cooldown: 14
    }
  };
  N.abilities = {
    use() {
      const p = N.player.p,
        d = N.ABILITIES.shockburst;
      if (p.ability !== 'shockburst' || p.abilityCd > 0 || !p.alive || !['PLAYING', 'BOSS_FIGHT', 'WAVE_COMPLETE'].includes(N.game.state)) return;
      const s = N.stats.get();
      p.abilityCd = s.abilityCd;
      p.invuln = Math.max(p.invuln, d.invuln);
      N.combat.blast(p.x, p.y, d.radius * N.world.S, d.damage * s.damage, d.knockback);
      N.world.effects.push({
        kind: 'ring',
        x: p.x,
        y: p.y,
        r: d.radius * N.world.S,
        t: 0,
        life: .5,
        color: N.CONFIG.colors.cyan
      });
      N.bus.emit('abilityUsed');
    }
  };
})();
