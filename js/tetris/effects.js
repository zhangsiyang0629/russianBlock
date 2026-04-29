const COLORS = ['#ff6b6b', '#ffd93d', '#6bcbff', '#51cf66', '#cc5de8'];

export default class Effects {
  constructor() {
    this.fireworks = [];
    this.clickRipples = [];
    this._lastFireworkTime = 0;
    this._lastClickTime = 0;
    this._lastRenderTime = 0;
  }

  spawnFirework(canvasWidth, canvasHeight) {
    const x = Math.random() * (canvasWidth - 80) + 40;
    const y = Math.random() * (canvasHeight * 0.5) + 20;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const count = Math.floor(Math.random() * 25) + 20;
    const particles = [];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 120 + 80;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: Math.random() * 0.025 + 0.015,
        color,
        size: Math.random() * 3 + 3,
      });
    }

    this.fireworks.push({ particles });
  }

  createClickRipple(x, y) {
    const now = Date.now();
    if (now - this._lastClickTime < 600) return;
    this._lastClickTime = now;
    this.clickRipples.push({ x, y, radius: 0, life: 1 });
  }

  update(dt) {
    for (let fi = this.fireworks.length - 1; fi >= 0; fi--) {
      const fw = this.fireworks[fi];
      let alive = false;
      for (const p of fw.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 120 * dt;
        p.life -= p.decay;
        if (p.life > 0) alive = true;
      }
      if (!alive) this.fireworks.splice(fi, 1);
    }

    for (let ri = this.clickRipples.length - 1; ri >= 0; ri--) {
      const r = this.clickRipples[ri];
      r.radius += 120 * dt;
      r.life -= 2.5 * dt;
      if (r.life <= 0) this.clickRipples.splice(ri, 1);
    }
  }

  renderFireworks(ctx) {
    for (const fw of this.fireworks) {
      for (const p of fw.particles) {
        if (p.life <= 0) continue;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  renderClickRipples(ctx) {
    for (const r of this.clickRipples) {
      ctx.globalAlpha = r.life * 0.6;
      ctx.strokeStyle = '#322f22';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.fireworks = [];
    this.clickRipples = [];
    this._lastFireworkTime = 0;
    this._lastClickTime = 0;
    this._lastRenderTime = 0;
  }

  tick(canvasWidth, canvasHeight) {
    const now = Date.now();
    const dt = this._lastRenderTime ? Math.min((now - this._lastRenderTime) / 1000, 0.05) : 0.016;
    this._lastRenderTime = now;

    if (now - this._lastFireworkTime > Math.random() * 2000 + 1000) {
      this.spawnFirework(canvasWidth, canvasHeight);
      this._lastFireworkTime = now;
    }

    this.update(dt);
  }
}
