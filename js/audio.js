(function() {
  'use strict';
  const NR = window.NR = window.NR || {};
  let ctx = null,
    master = null,
    sfxBus = null,
    musicBus = null,
    voices = 0,
    filter = null,
    nextBeat = 0,
    step = 0,
    musicNodes = 0,
    lowTimer = 0;
  const lastPlayed = {};
  const MAX_VOICES = 16,
    MIN_GAP = 0.03;
  NR.CONFIG.audio = {
    maxVoices: MAX_VOICES,
    minGap: MIN_GAP,
    musicVoices: 12
  };

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      sfxBus = ctx.createGain();
      musicBus = ctx.createGain();
      sfxBus.connect(master);
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 12000;
      musicBus.connect(filter);
      filter.connect(master);
      nextBeat = ctx.currentTime;
      master.connect(comp);
      comp.connect(ctx.destination);
      applyVolumes();
    } catch (e) {
      ctx = null;
    }
  }

  function applyVolumes() {
    if (!ctx) return;
    const s = NR.save.data.settings;
    master.gain.value = s.muted ? 0 : s.master;
    sfxBus.gain.value = s.sfx;
    musicBus.gain.value = s.music * (NR.game && ['PAUSED', 'LEVEL_UP', 'SETTINGS', 'BOSS_REWARD'].includes(NR.game.state) ? .2 : 1);
    if (filter) filter.frequency.value = NR.game && NR.game.state === 'PAUSED' ? 600 : 12000;
  }

  function tone(key, freq, dur, type, vol, slide) {
    if (!ctx || NR.save.data.settings.muted || voices >= MAX_VOICES) return;
    const now = ctx.currentTime;
    if (lastPlayed[key] !== undefined && now - lastPlayed[key] < MIN_GAP) return;
    lastPlayed[key] = now;
    try {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, now);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), now + dur);
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      o.connect(g);
      g.connect(sfxBus);
      voices++;
      o.onended = () => {
        voices--;
        try {
          o.disconnect();
          g.disconnect();
        } catch (e) {
          /* noop */ }
      };
      o.start(now);
      o.stop(now + dur + 0.01);
    } catch (e) {
      /* audio is optional */ }
  }

  /* name -> [freq, dur, type, vol, slide] */
  const RECIPES = {
    shot_nova: [120, .13, 'sawtooth', .06, -60],
    shot_rail: [880, .2, 'square', .05, -550],
    shot_arc: [650, .08, 'triangle', .04, 330],
    shot_void: [100, .3, 'sine', .06, 100],
    level: [750, .25, 'sine', .05, 350],
    upgrade: [920, .18, 'triangle', .04, 400],
    boss: [80, .4, 'sawtooth', .05, -35],
    low: [180, .1, 'sine', .025, -40],
    gem: [800, .06, 'sine', .015, 250],
    ability: [160, .3, 'sawtooth', .04, 500],
    shot_pulse: [360, 0.045, 'triangle', 0.028, -190],
    hit: [190, 0.06, 'square', 0.018, -80],
    kill: [260, 0.06, 'square', 0.018, -80],
    dash: [500, 0.16, 'sine', 0.045, -310],
    hurt: [150, 0.22, 'sawtooth', 0.08, -110],
    pickup: [600, 0.18, 'sine', 0.045, 500],
    waveStart: [240, 0.26, 'sawtooth', 0.04, 220],
    waveClear: [550, 0.28, 'sine', 0.05, 260],
    gameOver: [250, 0.5, 'sawtooth', 0.07, -210],
    click: [420, 0.05, 'triangle', 0.03, 120]
  };

  function play(name) {
    const r = RECIPES[name];
    if (r) tone(name, r[0], r[1], r[2], r[3], r[4]);
  }

  NR.audio = {
    unlock,
    play,
    applyVolumes,
    suspend() {
      if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
    },
    resume() {
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    setMuted(m) {
      NR.save.data.settings.muted = !!m;
      NR.save.commit();
      applyVolumes();
    },
    isMuted() {
      return !!NR.save.data.settings.muted;
    },
    voiceCount() {
      return voices + musicNodes;
    },
    update() {
      if (NR.game && ['PLAYING', 'BOSS_FIGHT'].includes(NR.game.state) && NR.player.p.hp / NR.player.p.maxHp <= .25 && performance.now() - lowTimer > 2500) {
        lowTimer = performance.now();
        play('low');
      }
      if (!ctx || ctx.state !== 'running') return;
      applyVolumes();
      const state = NR.game ? NR.game.state : 'MENU',
        playing = ['PLAYING', 'WAVE_COMPLETE', 'BOSS_FIGHT', 'BOSS_INTRO'].includes(state),
        bpm = playing ? Math.min(128, 110 + NR.world.wave) : 100,
        beat = 60 / bpm / 4;
      const now = ctx.currentTime;
      if (nextBeat < now - .2) nextBeat = now;
      while (nextBeat < now + .12) {
        const active = playing ? NR.world.wave : 0,
          boss = state === 'BOSS_FIGHT',
          notes = boss ? [0, 1, 7, 6, 0, 1, 3, 6] : [0, 7, 3, 10, 0, 7, 5, 3],
          base = boss ? 55 : 65.4;
        const note = (f, dur, vol, type) => {
          if (musicNodes >= 12) return;
          try {
            const o = ctx.createOscillator(),
              g = ctx.createGain();
            o.type = type;
            o.frequency.value = f;
            g.gain.setValueAtTime(vol, nextBeat);
            g.gain.exponentialRampToValueAtTime(.0001, nextBeat + dur);
            o.connect(g);
            g.connect(musicBus);
            musicNodes++;
            o.onended = () => {
              musicNodes--;
              o.disconnect();
              g.disconnect();
            };
            o.start(nextBeat);
            o.stop(nextBeat + dur + .01);
          } catch (e) {}
        };
        if (step % 4 === 0) note(base * Math.pow(2, notes[(step / 4) % 8] / 12), beat * 3, .035, 'triangle');
        if (active >= 3 || !playing) note(base * 4 * Math.pow(2, notes[step % 8] / 12), beat * .7, .008, 'sine');
        if (active >= 6 && step % 2 === 1) note(5000, beat * .12, .004, 'square');
        nextBeat += beat;
        step = (step + 1) % 32;
      }
    }
  };

  /* Audio listens to gameplay events; gameplay never calls audio directly. */
  const bus = NR.bus;
  bus.on('weaponFired', w => play(w && w.sound ? w.sound : 'shot_pulse'));
  bus.on('enemyHit', d => {
    if (d.killed && d.enemy.type === 'tank') tone('tankkill', 90, .2, 'sawtooth', .04, -50);
    else play(d.killed ? 'kill' : 'hit');
  });
  bus.on('playerDamaged', () => play('hurt'));
  bus.on('dashStarted', () => play('dash'));
  bus.on('pickupCollected', p => {
    const ids = ['shield', 'overdrive', 'core', 'phase', 'magnet', 'berserk'],
      i = Math.max(0, ids.indexOf(p.id));
    tone('pickup_' + p.id, 600 + i * 80, .18, 'sine', .04, 250 + i * 40);
  });
  bus.on('waveStarted', () => play('waveStart'));
  bus.on('waveCleared', () => play('waveClear'));
  bus.on('playerDied', () => play('gameOver'));
  bus.on('levelUp', () => play('level'));
  bus.on('upgradeInstalled', () => play('upgrade'));
  bus.on('gemCollected', () => play('gem'));
  bus.on('abilityUsed', () => play('ability'));
  bus.on('bossTelegraph', () => play('boss'));
  bus.on('bossDefeated', () => play('boss'));
  bus.on('bossHit', () => play('hit'));
  bus.on('stateChanged', () => applyVolumes());
  document.addEventListener('pointerover', e => {
    if (e.target.closest && e.target.closest('button')) tone('hover', 350, .025, 'sine', .008, 80);
  });
  bus.on('ui:click', () => play('click'));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) NR.audio.suspend();
    else NR.audio.resume();
  });
})();
