export default class FailLaughAnimation {
  constructor() {
    this.active = false;
    this.loop = false;
    this.currentFrame = 0;
    this.frameDuration = 60;
    this.lastUpdateTime = 0;
    this.onComplete = null;
    this.x = 0;
    this.y = 0;
    this.scale = 1;
    this.totalAtlases = 0;
    this.resourcesLoaded = false;
    this.pendingPlay = null;
    this.images = [];
    this.frameW = 720;
    this.frameH = 720;
    this.cropRatio = 3.4 / 5;
    this.totalLoops = 0;
    this.maxLoops = 3;
    this.fadeOut = false;
    this.fadeAlpha = 1;
    this.fadeSpeed = 1.5;

    this.loadAllResources();
  }

  async loadAllResources() {
    const totalAtlases = await this.detectAtlases();
    this.totalAtlases = totalAtlases;
    if (totalAtlases === 0) {
      this.resourcesLoaded = true;
      return;
    }
    if (typeof wx !== 'undefined' && wx.loadSubpackage) {
      try {
        await new Promise((resolve, reject) => {
          wx.loadSubpackage({ name: 'animation', success: resolve, fail: reject });
        });
      } catch (e) {
        console.warn('动画分包加载失败:', e);
      }
    }
    await this.loadAllImages();
    this.resourcesLoaded = true;
    this.checkPendingPlay();
  }

  async detectAtlases() {
    let index = 0;
    if (typeof wx === 'undefined' || !wx.getFileSystemManager) return 0;
    const fs = wx.getFileSystemManager();
    while (true) {
      try {
        const data = fs.readFileSync(`subpackages/animation/images/failLaugh-${index}.json`, 'utf8');
        JSON.parse(data);
        index++;
      } catch (e) {
        break;
      }
    }
    return index;
  }

  async loadAllImages() {
    if (typeof wx === 'undefined' || !wx.createImage) return;
    for (let i = 0; i < this.totalAtlases; i++) {
      const img = wx.createImage();
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
        img.src = `subpackages/animation/images/failLaugh-${i}.png`;
      });
      this.images[i] = img;
    }
  }

  checkPendingPlay() {
    if (this.pendingPlay) {
      const { x, y, scale, loop, onComplete } = this.pendingPlay;
      this.pendingPlay = null;
      this.startPlay(x, y, scale, loop, onComplete);
    }
  }

  play(x, y, scale = 1, loop = false, onComplete = null) {
    if (!this.resourcesLoaded) {
      this.pendingPlay = { x, y, scale, loop, onComplete };
      return;
    }
    this.startPlay(x, y, scale, loop, onComplete);
  }

  startPlay(x, y, scale = 1, loop = false, onComplete = null) {
    if (this.totalAtlases === 0) return;
    this.active = true;
    this.currentFrame = 0;
    this.x = x;
    this.y = y;
    this.scale = scale;
    this.loop = loop;
    this.onComplete = onComplete;
    this.lastUpdateTime = Date.now();
    this.totalLoops = 0;
    this.fadeOut = false;
    this.fadeAlpha = 1;
  }

  stop() {
    this.active = false;
    if (this.onComplete) {
      this.onComplete();
      this.onComplete = null;
    }
  }

  update(currentTime) {
    if (!this.active || !this.resourcesLoaded) return;

    if (this.fadeOut) {
      this.fadeAlpha -= this.fadeSpeed * this.frameDuration / 1000;
      if (this.fadeAlpha <= 0) {
        this.stop();
      }
      return;
    }

    const elapsed = currentTime - this.lastUpdateTime;
    if (elapsed >= this.frameDuration) {
      this.currentFrame++;
      if (this.currentFrame >= this.totalAtlases) {
        this.totalLoops++;
        if (this.totalLoops >= this.maxLoops) {
          this.fadeOut = true;
          this.currentFrame = this.totalAtlases - 1;
          return;
        }
        this.currentFrame = 0;
      }
      this.lastUpdateTime = currentTime;
    }
  }

  render(ctx) {
    if (!this.active || !this.resourcesLoaded || this.currentFrame >= this.totalAtlases) return;
    const img = this.images[this.currentFrame];
    if (!img) return;
    const cropH = Math.floor(this.frameH * this.cropRatio);
    const sw = this.frameW * this.scale;
    const sh = cropH * this.scale;
    ctx.globalAlpha = Math.max(0, this.fadeAlpha);
    ctx.drawImage(img, 0, 0, this.frameW, cropH,
      this.x - sw / 2, this.y - sh / 2, sw, sh);
    ctx.globalAlpha = 1;
  }

  isPlaying() {
    return this.active && this.resourcesLoaded;
  }

  setFrameDuration(duration) {
    this.frameDuration = Math.max(16, duration);
  }

  getFirstFrameSize() {
    return this.totalAtlases > 0 ? { width: this.frameW, height: this.frameH } : null;
  }
}
