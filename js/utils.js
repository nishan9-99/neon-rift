(function() {
  'use strict';
  const NR = window.NR = window.NR || {};

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  NR.utils = {
    clamp,
    lerp: (a, b, t) => a + (b - a) * t,
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    pad2: n => String(n).padStart(2, '0'),
    pad6: n => String(n).padStart(6, '0'),
    hexToRgb(hex) {
      const h = hex.replace('#', '');
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    },
    fmtTime(s) {
      s = Math.max(0, Math.floor(s));
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }
  };

  /* ---- RNG wrapper (seedable for tests) ---- */
  let seedState = null;

  function mulberry() {
    seedState = (seedState + 0x6D2B79F5) | 0;
    let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const rng = NR.rng = {
    random() {
      return seedState === null ? Math.random() : mulberry();
    },
    seed(n) {
      seedState = (n === null || n === undefined) ? null : (n >>> 0);
    },
    range(a, b) {
      return a + rng.random() * (b - a);
    },
    int(a, b) {
      return Math.floor(rng.range(a, b));
    },
    chance(p) {
      return rng.random() < p;
    }
  };

  /* ---- Event bus ---- */
  const handlers = {};
  NR.bus = {
    on(ev, fn) {
      (handlers[ev] = handlers[ev] || []).push(fn);
    },
    off(ev, fn) {
      const a = handlers[ev];
      if (a) {
        const i = a.indexOf(fn);
        if (i >= 0) a.splice(i, 1);
      }
    },
    emit(ev, data) {
      const a = handlers[ev];
      if (!a) return;
      for (let i = 0; i < a.length; i++) {
        try {
          a[i](data);
        } catch (e) {
          console.error('[bus:' + ev + ']', e);
        }
      }
    }
  };

  /* ---- Object pool: active objects in .list, swap-remove with killAt(i) ---- */
  NR.Pool = class Pool {
    constructor(max, make) {
      this.max = max;
      this.make = make;
      this.list = [];
      this.free = [];
    }
    spawn() {
      if (this.list.length >= this.max) return null;
      const o = this.free.pop() || this.make();
      this.list.push(o);
      return o;
    }
    killAt(i) {
      const l = this.list,
        o = l[i];
      l[i] = l[l.length - 1];
      l.pop();
      this.free.push(o);
    }
    clear() {
      while (this.list.length) this.free.push(this.list.pop());
    }
  };

  /* ---- Uniform-grid spatial hash (objects need x,y) ---- */
  NR.SpatialHash = class SpatialHash {
    constructor(cell, maxR) {
      this.cell = cell;
      this.maxR = maxR;
      this.cols = 1;
      this.rows = 1;
      this.b = [
        []
      ];
      this.out = [];
    }
    resize(w, h) {
      this.cols = Math.ceil(w / this.cell) + 3;
      this.rows = Math.ceil(h / this.cell) + 3;
      this.b = [];
      for (let i = 0; i < this.cols * this.rows; i++) this.b.push([]);
    }
    _c(v, n) {
      const c = Math.floor(v / this.cell) + 1;
      return c < 0 ? 0 : c >= n ? n - 1 : c;
    }
    clear() {
      for (let i = 0; i < this.b.length; i++) this.b[i].length = 0;
    }
    insert(o) {
      this.b[this._c(o.y, this.rows) * this.cols + this._c(o.x, this.cols)].push(o);
    }
    query(x, y, r) {
      const out = this.out,
        m = r + this.maxR;
      out.length = 0;
      const x0 = this._c(x - m, this.cols),
        x1 = this._c(x + m, this.cols);
      const y0 = this._c(y - m, this.rows),
        y1 = this._c(y + m, this.rows);
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          const a = this.b[cy * this.cols + cx];
          for (let k = 0; k < a.length; k++) out.push(a[k]);
        }
      }
      return out;
    }
  };
})();
