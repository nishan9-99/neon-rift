(function() {
  'use strict';
  const N = window.NR,
    C = N.CONFIG;
  C.progress = {
    xpBase: 60,
    xpLinear: 25,
    xpPower: 4,
    xpExponent: 1.7,
    offerLock: .4,
    resumeDelay: .8,
    resumeInvuln: 1,
    comboWindow: 2.5,
    comboStep: .05,
    comboCap: 40
  };
  C.caps = {
    speed: 424,
    damage: 4,
    fireRate: 2.5,
    crit: .6,
    critMult: 4,
    reduction: .6,
    pickup: 210,
    dashCd: .8,
    pierce: 5
  };
  C.effects = {
    burnFraction: .3,
    burnDuration: 3,
    freezeChance: .1,
    freezeSlow: .4,
    freezeDuration: 2,
    homingRange: 220,
    homingTurn: 2.5,
    blastChance: .2,
    blastRadius: 50,
    blastFraction: .5,
    chainChance: .15,
    chainTargets: 2,
    chainFraction: .4,
    chainRange: 140,
    singularityGap: 12,
    singularityTime: 2,
    singularityRange: 250,
    singularityPull: 170,
    overkillChance: .15,
    overkillRadius: 70,
    overkillFraction: .6,
    barrierThreshold: .2,
    barrierInvuln: 1.5,
    barrierHeal: 15,
    barrierCooldown: 15,
    reviveFraction: .5
  };
  N.SHIPS = {
    striker: {
      name: 'STRIKER',
      price: 0,
      description: 'Balanced / +10% XP',
      mods: {
        xp: .1
      }
    },
    wraith: {
      name: 'WRAITH',
      price: 200,
      description: '+30% speed / -20% shield / -15% dash cooldown',
      mods: {
        speed: .3,
        hp: -.2,
        dashCd: -.15
      }
    },
    titan: {
      name: 'TITAN',
      price: 350,
      description: '+50 shield / -20% speed / 40 damage dash ram',
      add: {
        hp: 50
      },
      mods: {
        speed: -.2
      },
      ram: 40
    },
    adept: {
      name: 'ADEPT',
      price: 450,
      description: '-10% damage / -30% cooldowns / starts with Shockburst',
      mods: {
        damage: -.1,
        dashCd: -.3,
        abilityCd: -.3,
        fireRate: 1 / .7 - 1
      },
      ability: 'shockburst'
    }
  };
  N.ARENAS = {
    origin: {
      name: 'ORIGIN',
      price: 0,
      bg: '#080E1C',
      grid: '#184353',
      glow: '#54F1DC',
      starTint: '#8BA3B6',
      description: 'Original navy / cyan grid'
    },
    crimson: {
      name: 'CRIMSON SECTOR',
      price: 150,
      bg: '#180b1c',
      grid: '#62233b',
      glow: '#F85D9C',
      starTint: '#ff9ec8',
      description: 'Red / purple rift chamber'
    },
    circuit: {
      name: 'DEAD CIRCUIT',
      price: 250,
      bg: '#121619',
      grid: '#685633',
      glow: '#FFBD66',
      starTint: '#d5bea0',
      description: 'Steel / amber circuitry'
    },
    void: {
      name: 'VOID CORE',
      price: 400,
      bg: '#050610',
      grid: '#2b1b54',
      glow: '#B277FF',
      starTint: '#beabef',
      description: 'Near-black / bright neon accents'
    }
  };
  N.stats = {
    get() {
      const p = N.player.p,
        u = p.upgrades || {},
        ship = N.SHIPS[p.ship] || N.SHIPS.striker,
        a = ship.add || {},
        m = ship.mods || {},
        fx = C.effects;
      const sources = [m];
      let add = {
        hp: a.hp || 0,
        pierce: 0,
        crit: 0,
        critMult: 0,
        reduction: 0
      };
      Object.keys(u).forEach(id => {
        const d = N.UPGRADES[id];
        if (d) d.apply({
          add,
          mul: sources
        }, u[id]);
      });
      const b = p.buffs || {};
      if (b.overdrive > 0) sources.push({
        fireRate: .4
      });
      if (b.core > 0) sources.push({
        damage: .35
      });
      if (b.phase > 0) sources.push({
        dashCd: -.5
      });
      if (b.magnet > 0) sources.push({
        pickup: 2
      });
      if (b.berserk > 0) sources.push({
        damage: .6,
        taken: .3
      });
      if (N.world.event && N.world.event.id === 'power') sources.push({
        damage: .4,
        fireRate: .25
      });
      const v = (key, base) => sources.reduce((x, s) => x * (1 + (s[key] || 0)), base + (add[key] || 0));
      return {
        hp: v('hp', 100),
        speed: Math.min(C.caps.speed, v('speed', 265)),
        damage: Math.min(C.caps.damage, v('damage', 1)),
        fireRate: Math.min(C.caps.fireRate, v('fireRate', 1)),
        crit: Math.min(C.caps.crit, v('crit', 0)),
        critMult: Math.min(C.caps.critMult, v('critMult', 2)),
        reduction: Math.min(C.caps.reduction, v('reduction', 0)),
        pickup: Math.min(C.caps.pickup, v('pickup', 70)),
        dashCd: Math.max(C.caps.dashCd, v('dashCd', 2.3)),
        impulse: v('impulse', 650),
        pierce: Math.min(p.weapon === 'rail' ? 8 : 5, v('pierce', 0)),
        speedBullet: v('speedBullet', 1),
        size: v('size', 1),
        xp: v('xp', 1),
        score: v('score', 1),
        duration: v('duration', 1),
        lifetime: v('lifetime', 1),
        abilityCd: v('abilityCd', 14),
        taken: v('taken', 1),
        regen: (u.regen || 0) * .6,
        ram: (ship.ram || 0) + (u.dash_reactor || 0) * 25
      };
    }
  };
})();
