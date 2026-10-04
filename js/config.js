(function() {
  'use strict';
  const NR = window.NR = window.NR || {};

  /* All tunables live here (or in the data tables of weapons.js / enemies.js). */
  NR.CONFIG = {
    VERSION: '2.0.0',
    FOOTER: 'NEON RIFT // SURVIVAL \u2014 RIFT PROTOCOL v2.0',
    TITLE: 'NEON RIFT',
    SUBTITLE: 'RIFT PROTOCOL',

    colors: {
      bg: '#080E1C',
      cyan: '#54F1DC',
      cyanHi: '#7DFDF3',
      pink: '#F85D9C',
      orange: '#FFBD66',
      purple: '#B277FF',
      green: '#74FFB7',
      red: '#FF456B',
      text: '#EBFAFF',
      muted: '#8BA3B6',
      outline: '#FFEEFA',
      core: '#142135'
    },

    world: {
      refH: 720,
      minScale: 0.8,
      maxScale: 1.3,
      maxDt: 0.033,
      dprDesktop: 2,
      dprMobile: 1.5,
      gridSpacing: 48,
      gridDrift: 4,
      hashCell: 64,
      hashMaxRadius: 40
    },

    player: {
      startAimOffset: 120,
      r: 14,
      hp: 100,
      speed: 265,
      accel: 10,
      dashAccel: 3
    },
    dash: {
      impulse: 650,
      duration: 0.18,
      invuln: 0.3,
      cooldown: 2.3,
      buffer: 0.15
    },
    damage: {
      playerInvuln: 0.8,
      contactCooldown: 0.6,
      shake: 12,
      flash: 0.28,
      shakeDecay: 30,
      maxShake: 14
    },

    waves: {
      baseCount: 5,
      perWave: 3,
      firstSpawnDelay: 0.9,
      gapBase: 0.78,
      gapPerWave: 0.033,
      gapMin: 0.2,
      gapJitter: [0.72, 1.18],
      restTime: 2.6,
      clearBonusPerWave: 200,
      clearHeal: 10,
      telegraph: 0.6,
      minSpawnDistance: 160,
      edgeInset: 36,
      aliveCapDesktop: 35,
      aliveCapMobile: 25,
      /* V1 spawn-type roll (kept for parity until the Phase 4 threat-budget director) */
      tankFrom: 4,
      tankMax: 0.18,
      tankPerWave: 0.014,
      dasherFrom: 2,
      dasherRoll: 0.37,
      hpScaleAfter: 10,
      hpScalePerWave: 0.05
    },

    pickups: {
      shield: {
        r: 10,
        life: 11,
        blink: 3,
        heal: 25,
        score: 50,
        chance: 0.085,
        tankChance: 0.4
      },
      max: 5
    },

    perf: {
      bullets: 400,
      particles: 500
    },
    runIntro: 0.6,
    dying: {
      time: 3.0,
      slow: 0.25
    }
  };
})();
