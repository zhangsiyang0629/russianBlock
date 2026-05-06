import { initCloud } from './playerData.js';

export default class MusicManager {
  constructor(musicCount = 5) {
    this.audioContext = null;
    this.currentMusicNumber = -1;
    this.musicOn = true;
    this.musicVolume = 0.5;
    this.musicCount = musicCount;

    this.CLOUD_PREFIX = 'cloud://cloudbase-d5gyz0rzwf3c9a078.636c-cloudbase-d5gyz0rzwf3c9a078-1424022365/music/music_';

    this.loadSettings();
  }

  loadSettings() {
    try {
      const saved = wx.getStorageSync('coverSettings');
      if (saved) {
        this.musicOn = saved.musicOn !== false;
        this.musicVolume = saved.musicVolume || 0.5;
      }
    } catch (e) {
      this.musicOn = true;
      this.musicVolume = 0.5;
    }
  }

  async playRandom() {
    if (!this.musicOn || this.musicCount === 0) return;

    const number = Math.floor(Math.random() * this.musicCount) + 1;
    this.currentMusicNumber = number;
    let url = null;

    if (typeof wx !== 'undefined' && wx.cloud && initCloud()) {
      try {
        const res = await wx.cloud.getTempFileURL({
          fileList: [`${this.CLOUD_PREFIX}${number}.mp3`]
        });
        if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
          url = res.fileList[0].tempFileURL;
        }
      } catch (e) {
        console.warn(`云存储加载 music_${number} 失败:`, e.errMsg || e);
      }
    }

    if (!url && typeof wx !== 'undefined' && wx.cloud && initCloud()) {
      try {
        const res = await wx.cloud.callFunction({
          name: 'getCosUrl',
          data: { bucket: 'music-1333103280', fileKey: `music_${number}.mp3` }
        });
        if (res.result && res.result.url) {
          url = res.result.url;
        }
      } catch (e) {
        console.warn(`COS加载 music_${number} 失败:`, e.errMsg || e);
      }
    }

    if (url) {
      this.playWithUrl(url);
    } else {
      console.warn(`music_${number} 两个源均加载失败，静音`);
      this.stop();
    }
  }

  playWithUrl(url) {
    this.stop();

    if (typeof wx === 'undefined' || !wx.createInnerAudioContext) return;

    this.audioContext = wx.createInnerAudioContext();
    this.audioContext.loop = true;
    this.audioContext.volume = this.musicVolume;
    this.audioContext.obeyMuteSwitch = false;

    this.audioContext.src = url;
    this.audioContext.play();

    this.audioContext.onError(() => {
      console.warn('游戏音乐播放失败');
      this.stop();
    });
  }

  stop() {
    if (this.audioContext) {
      this.audioContext.stop();
      this.audioContext.destroy();
      this.audioContext = null;
    }
    this.currentMusicNumber = -1;
  }

  setVolume(vol) {
    this.musicVolume = vol;
    if (this.audioContext) {
      this.audioContext.volume = vol;
    }
  }

  setOn(on) {
    this.musicOn = on;
    if (on) {
      this.playRandom();
    } else {
      this.stop();
    }
  }
}
