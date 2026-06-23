// 设计系统颜色（与game.js保持一致）
const AD_COLORS = {
  surfaceContainerLow: '#f8f0dc',
  outlineVariant: '#b2ad9c',
  onSurfaceVariant: '#5f5b4d',
  background: '#fdf6e3',
  white: '#ffffff',
};

// 模块级标志，确保微信广告对象的监听器只注册一次
let _rewardedAdListenersInited = false;
let _interstitialAdListenersInited = false;

/**
 * 广告管理器
 * 管理游戏顶部广告区域
 */
export default class AdManager {
  constructor() {
    // 尝试获取窗口信息，如果失败（可能是隐私授权未通过）则使用默认值
    let windowInfo;
    try {
      windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    } catch (error) {
      console.warn('AdManager: 获取窗口信息失败，使用默认值:', error);
      // 默认值，大部分手机屏幕尺寸
      windowInfo = {
        screenHeight: 667,
        windowWidth: 390
      };
    }
    this.screenHeight = windowInfo.screenHeight;
    this.screenWidth = windowInfo.windowWidth || 390;
    this.windowHeight = windowInfo.windowHeight || Math.floor(this.screenHeight / 3);
    this.adHeight = Math.max(110, Math.floor(this.screenWidth / 4));
    this.adVisible = true; // 广告是否可见
    this.adContent = null; // 广告内容
    this.adType = 'banner'; // 广告类型：banner、interstitial等
    this.lastAdUpdate = 0; // 上次广告更新时间
    this.adUpdateInterval = 30000; // 广告更新间隔（毫秒）
    
    // 激励视频广告相关
    this.rewardedAd = null;
    this.rewardCallback = null;

    // 插屏广告
    this.interstitialAd = null;
    
    // 初始化广告
    this.initAd();
  }

  /**
   * 初始化广告
   */
  initAd() {
    this.adVisible = true;
    this.loadWeChatAd();
    setTimeout(() => this.initRewardedAd(), 2000);
    this.initInterstitialAd();
  }

  /**
   * 初始化插屏广告
   */
  initInterstitialAd() {
    if (wx.createInterstitialAd) {
      this.interstitialAd = wx.createInterstitialAd({
        adUnitId: 'adunit-8d43aaa0d812760a'
      });
      if (!_interstitialAdListenersInited) {
        _interstitialAdListenersInited = true;
        this.interstitialAd.onError(() => {});
        this.interstitialAd.onClose(() => {});
      }
    }
  }

  /**
   * 显示插屏广告
   */
  showInterstitialAd() {
    if (this.interstitialAd) {
      this.interstitialAd.show().catch(() => {
        this.interstitialAd.load().then(() => this.interstitialAd.show()).catch(() => {});
      });
    }
  }

  /**
   * 加载模拟广告（用于开发和测试）
   */
  loadMockAd() {
    // 模拟广告内容（模仿HTML设计）
    this.adContent = {
      title: '---',
      bgColor: AD_COLORS.surfaceContainerLow,
      bgOpacity: 0.5,
      borderColor: AD_COLORS.outlineVariant,
      textColor: AD_COLORS.onSurfaceVariant,
      fontSize: 12,
      fontWeight: 'bold',
      fontFamily: 'Plus Jakarta Sans, Arial'
    };
  }

  /**
   * 加载微信banner广告
   */
  loadWeChatAd() {
    if (wx.createCustomAd) {
      let menuBtnLeft = this.screenWidth - 44;
      if (typeof wx.getMenuButtonBoundingClientRect === 'function') {
        try {
          const menuBtn = wx.getMenuButtonBoundingClientRect();
          if (menuBtn && menuBtn.left > 0) {
            menuBtnLeft = menuBtn.left;
          }
        } catch (e) {}
      }
      const adWidth = Math.max(200, Math.min(320, this.screenWidth - 20));
      const left = Math.floor((this.screenWidth - adWidth) / 2);
      this.bannerAd = wx.createCustomAd({
        adUnitId: 'adunit-80a697bdd3d4c61b',
        style: {
          left,
          top: this.windowHeight - Math.floor(this.windowHeight / 5) - this.adHeight,
          width: adWidth,
          height: this.adHeight
        }
      });
      
      this.bannerAd.onLoad(() => {
        console.log('banner广告加载成功');
        this.adVisible = true;
      });
      
      this.bannerAd.onError((err) => {
        console.log('banner广告加载失败', JSON.stringify(err));
      });
      
      this.bannerAd.show();
    }
  }

  /**
   * 初始化激励视频广告
   */
  initRewardedAd() {
    console.log('激励视频广告初始化');
    
    if (wx.createRewardedVideoAd) {
      this.rewardedAd = wx.createRewardedVideoAd({
        adUnitId: 'adunit-b4b319bc9a99d6a7'
      });
      
      if (!_rewardedAdListenersInited) {
        _rewardedAdListenersInited = true;
        this.rewardedAd.onLoad(() => {
          console.log('激励视频广告加载成功');
        });
        
        this.rewardedAd.onError((err) => {
          console.log('激励视频广告加载失败', JSON.stringify(err));
        });
        
        this.rewardedAd.onClose((res) => {
          console.log('激励视频广告关闭, res:', JSON.stringify(res));
          if (res && res.isEnded) {
            console.log('广告播放完整，发放奖励');
            if (this.rewardCallback) {
              this.rewardCallback();
              this.rewardCallback = null;
            }
          } else {
            console.log('广告未播放完整，不发奖励');
          }
        });
      }
    } else {
      console.log('wx.createRewardedVideoAd 不可用');
    }
  }

  /**
   * 显示激励视频广告
   * @param {Function} onSuccess - 广告观看成功回调
   * @param {Function} onError - 广告观看失败回调
   */
  showRewardedAd(onSuccess, onError) {
    console.log('显示激励视频广告');
    
    if (this.rewardedAd) {
      this.rewardCallback = onSuccess;
      this.rewardedAd.show().then(() => {
        console.log('激励视频广告 show 成功');
      }).catch((err) => {
        console.log('激励视频广告 show 失败，尝试重载:', JSON.stringify(err));
        this.rewardedAd.load()
          .then(() => {
            console.log('激励视频广告重载成功，再次 show');
            return this.rewardedAd.show();
          })
          .catch(err2 => {
            console.log('激励视频广告重载后仍失败:', JSON.stringify(err2));
            this.rewardCallback = null;
            if (onError) onError(err2);
          });
      });
    } else {
      console.log('激励视频广告未初始化');
      if (onError) onError('广告未初始化');
    }
  }

  /**
   * 更新广告内容
   */
  update(currentTime) {
  }

  /**
   * 绘制圆角矩形路径
   */
  drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  }

  /**
   * 渲染广告区域
   */
  render(ctx) {
    // banner 广告由微信原生渲染，canvas 不需要绘制
  }

  /**
   * 处理广告点击
   */
  handleClick(x, y) {
    return false;
  }

  /**
   * 显示/隐藏广告
   */
  setVisible(visible) {
    this.adVisible = visible;
    
    // 实际微信广告显示/隐藏
    // if (this.bannerAd) {
    //   if (visible) {
    //     this.bannerAd.show();
    //   } else {
    //     this.bannerAd.hide();
    //   }
    // }
  }

  /**
   * 获取广告区域高度
   */
  getAdHeight() {
    return 0;
  }

  /**
   * 获取广告区域高度（用于底部边界计算）
   */
  getBottomAdHeight() {
    return this.adHeight;
  }

  /**
   * 销毁广告资源
   */
  destroy() {
    if (this.bannerAd) {
      this.bannerAd.destroy();
      this.bannerAd = null;
    }
    if (this.rewardedAd) {
      this.rewardedAd.destroy();
      this.rewardedAd = null;
    }
    if (this.interstitialAd) {
      this.interstitialAd.destroy();
      this.interstitialAd = null;
    }
    this.rewardCallback = null;
  }
}