// 设计系统颜色（与game.js保持一致）
const AD_COLORS = {
  surfaceContainerLow: '#f8f0dc',
  outlineVariant: '#b2ad9c',
  onSurfaceVariant: '#5f5b4d',
  background: '#fdf6e3',
  white: '#ffffff',
};

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
        screenHeight: 667
      };
    }
    this.screenHeight = windowInfo.screenHeight;
    this.adHeight = Math.floor(this.screenHeight / 9); // 广告区域高度为屏幕高度的1/9
    this.adVisible = true; // 广告是否可见
    this.adContent = null; // 广告内容
    this.adType = 'banner'; // 广告类型：banner、interstitial等
    this.lastAdUpdate = 0; // 上次广告更新时间
    this.adUpdateInterval = 30000; // 广告更新间隔（毫秒）
    
    // 激励视频广告相关
    this.rewardedAd = null; // 激励视频广告实例
    this.rewardCallback = null; // 奖励回调
    
    // 初始化广告
    this.initAd();
  }

  /**
   * 初始化广告
   */
  initAd() {
    // 这里可以初始化微信广告
    // 暂时使用模拟广告
    this.loadMockAd();
    
    // 初始化激励视频广告（模拟）
    this.initRewardedAd();
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
    // 实际微信小游戏广告代码
    // if (wx.createBannerAd) {
    //   this.bannerAd = wx.createBannerAd({
    //     adUnitId: 'your-ad-unit-id',
    //     style: {
    //       left: 0,
    //       top: 0,
    //       width: 320,
    //       height: this.adHeight
    //     }
    //   });
    //   
    //   this.bannerAd.onLoad(() => {
    //     console.log('广告加载成功');
    //   });
    //   
    //   this.bannerAd.onError((err) => {
    //     console.log('广告加载失败', err);
    //   });
    //   
    //   this.bannerAd.show();
    // }
  }

  /**
   * 初始化激励视频广告（模拟）
   */
  initRewardedAd() {
    // 模拟激励视频广告初始化
    console.log('激励视频广告初始化（模拟）');
    
    // 实际微信激励视频广告代码
    // if (wx.createRewardedVideoAd) {
    //   this.rewardedAd = wx.createRewardedVideoAd({
    //     adUnitId: 'your-rewarded-video-ad-unit-id'
    //   });
    //   
    //   this.rewardedAd.onLoad(() => {
    //     console.log('激励视频广告加载成功');
    //   });
    //   
    //   this.rewardedAd.onError((err) => {
    //     console.log('激励视频广告加载失败', err);
    //   });
    //   
    //   this.rewardedAd.onClose((res) => {
    //     if (res && res.isEnded) {
    //       // 正常播放结束，发放奖励
    //       if (this.rewardCallback) {
    //         this.rewardCallback();
    //         this.rewardCallback = null;
    //       }
    //     } else {
    //       // 未播放完整，不发奖励
    //       console.log('广告未播放完整，不发奖励');
    //     }
    //   });
    // }
  }

  /**
   * 显示激励视频广告
   * @param {Function} onSuccess - 广告观看成功回调
   * @param {Function} onError - 广告观看失败回调
   */
  showRewardedAd(onSuccess, onError) {
    console.log('显示激励视频广告（模拟）');
    
    // 模拟广告显示
    if (Math.random() > 0.1) { // 90% 成功率
      console.log('模拟广告观看成功，3秒后发放奖励...');
      
      // 模拟广告观看时间
      setTimeout(() => {
        console.log('奖励发放成功');
        if (onSuccess) onSuccess();
      }, 3000);
    } else {
      console.log('模拟广告加载失败');
      if (onError) onError('广告加载失败');
    }
    
    // 实际微信激励视频广告代码
    // if (this.rewardedAd) {
    //   this.rewardCallback = onSuccess;
    //   this.rewardedAd.show().catch(() => {
    //     // 失败重试
    //     this.rewardedAd.load()
    //       .then(() => this.rewardedAd.show())
    //       .catch(err => {
    //         console.log('激励视频广告显示失败', err);
    //         if (onError) onError(err);
    //       });
    //   });
    // } else {
    //   console.log('激励视频广告未初始化');
    //   if (onError) onError('广告未初始化');
    // }
  }

  /**
   * 更新广告内容
   */
  update(currentTime) {
    // 定时更新广告内容
    if (currentTime - this.lastAdUpdate > this.adUpdateInterval) {
      this.loadMockAd();
      this.lastAdUpdate = currentTime;
    }
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
    if (!this.adVisible) return;

    const canvas = ctx.canvas;
    const width = canvas.width;
    const height = this.adHeight;
    const borderRadius = 12; // 圆角大小
    
    // 绘制半透明背景（带圆角）
    ctx.fillStyle = this.adContent.bgColor || AD_COLORS.surfaceContainerLow;
    ctx.globalAlpha = this.adContent.bgOpacity || 0.5;
    this.drawRoundedRect(ctx, 0, 0, width, height, borderRadius);
    ctx.fill();
    ctx.globalAlpha = 1.0;
    
    // 绘制虚线边框
    ctx.strokeStyle = this.adContent.borderColor || AD_COLORS.outlineVariant;
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 4]); // 虚线模式
    this.drawRoundedRect(ctx, 0, 0, width, height, borderRadius);
    ctx.stroke();
    ctx.setLineDash([]); // 恢复实线
    
    // 绘制广告文字
    ctx.fillStyle = this.adContent.textColor || AD_COLORS.onSurfaceVariant;
    ctx.font = `${this.adContent.fontWeight || 'bold'} ${this.adContent.fontSize || 12}px ${this.adContent.fontFamily || 'Plus Jakarta Sans, Arial'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const centerX = width / 2;
    const centerY = height / 2;
    
    // 直接使用大写文本
    ctx.fillText((this.adContent.title || 'ADVERTISEMENT SLOT').toUpperCase(), centerX, centerY);
    
    // 绘制"广告"标识（左下角）
    ctx.fillStyle = 'rgba(50, 47, 34, 0.3)'; // onSurface带透明度
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('广告', 8, height - 4);
  }

  /**
   * 处理广告点击
   */
  handleClick(x, y) {
    if (!this.adVisible || y > this.adHeight) return false;
    
    // 模拟广告点击
    console.log('广告被点击，x:', x, 'y:', y);
    
    // 实际微信广告点击处理
    // if (this.bannerAd) {
    //   // 微信广告会自动处理点击
    // }
    
    // 这里可以添加跳转逻辑
    // wx.navigateToMiniProgram({
    //   appId: 'other-mini-program-appid',
    //   success: () => console.log('跳转成功')
    // });
    
    return true;
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
    return this.adVisible ? this.adHeight : 0;
  }

  /**
   * 销毁广告资源
   */
  destroy() {
    // 销毁微信广告
    // if (this.bannerAd) {
    //   this.bannerAd.destroy();
    //   this.bannerAd = null;
    // }
  }
}