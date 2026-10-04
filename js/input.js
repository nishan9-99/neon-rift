(function() {
  'use strict';
  const NR = window.NR = window.NR || {};
  const clamp = NR.utils.clamp;
  const C = NR.CONFIG;

  /* Every touch is tracked by pointerId, so lifting one finger never affects another control. */
  const I = NR.input = {
    keys: new Set(),
    mouse: {
      x: 0,
      y: 0,
      down: false
    },
    aim: {
      x: 0,
      y: 0,
      src: 'mouse'
    },
    stick: {
      id: null,
      x: 0,
      y: 0
    },
    aimId: null,
    fireId: null,
    dashAt: -1e9,
    touchCapable: false,

    init() {
      const $ = id => document.getElementById(id);
      const canvas = $('game'),
        stick = $('stick'),
        nub = $('nub'),
        fire = $('fire'),
        dashBtn = $('dashBtn');
      I.touchCapable = (window.matchMedia && matchMedia('(pointer:coarse)').matches) || 'ontouchstart' in window;
      I.mouse.x = I.aim.x = window.innerWidth / 2 + C.player.startAimOffset;
      I.mouse.y = I.aim.y = window.innerHeight / 2;

      const capture = (el, e) => {
        try {
          el.setPointerCapture(e.pointerId);
        } catch (err) {
          /* synthetic or ended pointer */ }
      };
      const act = () => {
        NR.audio.unlock();
        NR.bus.emit('input:any');
      };

      /* ---- keyboard ---- */
      window.addEventListener('keydown', e => {
        const k = e.key.toLowerCase();
        act();
        const inPlay = NR.game && NR.game.isPlayState();
        if (inPlay && (k === ' ' || k.indexOf('arrow') === 0)) e.preventDefault();
        I.keys.add(k);
        if (e.repeat) return;
        if (k === 'p' || k === 'escape') NR.bus.emit('input:pause');
        if (k === ' ' && inPlay) I.queueDash();
        if ((k === 'e' || k === 'shift') && inPlay) NR.abilities.use();
        NR.bus.emit('input:key', k);
      });
      window.addEventListener('keyup', e => I.keys.delete(e.key.toLowerCase()));

      /* ---- mouse + canvas touch (aim/fire) ---- */
      canvas.addEventListener('pointermove', e => {
        if (e.pointerType === 'mouse') {
          I.mouse.x = e.clientX;
          I.mouse.y = e.clientY;
          I.aim.src = 'mouse';
          I.aim.x = e.clientX;
          I.aim.y = e.clientY;
        } else if (e.pointerId === I.aimId) {
          I.aim.x = e.clientX;
          I.aim.y = e.clientY;
          I.aim.src = 'touch';
        }
      });
      canvas.addEventListener('pointerdown', e => {
        act();
        if (e.pointerType === 'mouse') {
          if (e.button === 0) I.mouse.down = true;
          return;
        }
        if (I.aimId === null && e.clientX > window.innerWidth * 0.35) {
          I.aimId = e.pointerId;
          I.aim.x = e.clientX;
          I.aim.y = e.clientY;
          I.aim.src = 'touch';
          capture(canvas, e);
        }
      });
      window.addEventListener('pointerup', e => {
        if (e.pointerType === 'mouse') I.mouse.down = false;
        else if (e.pointerId === I.aimId) I.aimId = null;
      });
      window.addEventListener('pointercancel', e => {
        if (e.pointerId === I.aimId) I.aimId = null;
      });
      canvas.addEventListener('contextmenu', e => e.preventDefault());

      /* ---- virtual stick ---- */
      function stickMove(e) {
        const b = stick.getBoundingClientRect();
        const dx = e.clientX - (b.left + b.width / 2),
          dy = e.clientY - (b.top + b.height / 2);
        const l = Math.max(1, Math.hypot(dx, dy));
        let x = clamp(dx / 45, -1, 1),
          y = clamp(dy / 45, -1, 1);
        if (l > 45) {
          x = dx / l;
          y = dy / l;
        }
        I.stick.x = x;
        I.stick.y = y;
        nub.style.transform = 'translate(' + (x * 42) + 'px,' + (y * 42) + 'px)';
      }

      function stickEnd(e) {
        if (e.pointerId !== I.stick.id) return;
        I.stick.id = null;
        I.stick.x = I.stick.y = 0;
        nub.style.transform = '';
      }
      stick.addEventListener('pointerdown', e => {
        act();
        if (I.stick.id !== null) return;
        I.stick.id = e.pointerId;
        capture(stick, e);
        stickMove(e);
      });
      stick.addEventListener('pointermove', e => {
        if (e.pointerId === I.stick.id) stickMove(e);
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => stick.addEventListener(ev, stickEnd));

      /* ---- FIRE / DASH buttons ---- */
      fire.addEventListener('pointerdown', e => {
        e.preventDefault();
        act();
        if (I.fireId === null) {
          I.fireId = e.pointerId;
          capture(fire, e);
          fire.classList.add('down');
        }
      });
      const fireEnd = e => {
        if (e.pointerId === I.fireId) {
          I.fireId = null;
          fire.classList.remove('down');
        }
      };
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => fire.addEventListener(ev, fireEnd));
      dashBtn.addEventListener('pointerdown', e => {
        e.preventDefault();
        act();
        I.queueDash();
        dashBtn.classList.add('down');
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => dashBtn.addEventListener(ev, () => dashBtn.classList.remove('down')));

      const ab = document.getElementById('abilityBtn');
      ab.addEventListener('pointerdown', e => {
        e.preventDefault();
        act();
        NR.abilities.use();
        ab.classList.add('down');
      });
      ['pointerup', 'pointercancel'].forEach(ev => ab.addEventListener(ev, () => ab.classList.remove('down')));
      window.addEventListener('blur', () => {
        I.releaseAll();
        NR.bus.emit('input:blur');
      });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          I.releaseAll();
          NR.bus.emit('input:hidden');
        }
      });
    },

    releaseAll() {
      I.keys.clear();
      I.mouse.down = false;
      I.stick.id = null;
      I.stick.x = I.stick.y = 0;
      I.aimId = null;
      I.fireId = null;
      I.dashAt = -1e9;
      const nub = document.getElementById('nub');
      if (nub) nub.style.transform = '';
    },
    queueDash() {
      I.dashAt = performance.now();
    },
    consumeDash() {
      if (performance.now() - I.dashAt <= C.dash.buffer * 1000) {
        I.dashAt = -1e9;
        return true;
      }
      return false;
    },
    hasDashQueued() {
      return performance.now() - I.dashAt <= C.dash.buffer * 1000;
    },
    /* movement vector from keys + stick, length <= 1 */
    getMove(out) {
      const k = I.keys;
      let dx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0) + I.stick.x;
      let dy = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0) + I.stick.y;
      const l = Math.hypot(dx, dy);
      if (l > 1) {
        dx /= l;
        dy /= l;
      }
      out.x = dx;
      out.y = dy;
      return out;
    },
    isFiring() {
      return I.mouse.down || I.aimId !== null || I.fireId !== null;
    }
  };
})();
