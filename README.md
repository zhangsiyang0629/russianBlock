# 俄罗斯方块小游戏

基于微信小游戏原生API开发的俄罗斯方块游戏，支持广告接入。

## 游戏特性

✅ **原生微信API**：使用 `wx.createCanvas()`、`wx.onKeyDown()` 等原生API  
✅ **纯Canvas渲染**：无外部依赖，性能优化  
✅ **广告支持**：顶部广告区域，支持模拟广告和微信广告API  
✅ **完整游戏逻辑**：方块下落、旋转、碰撞、消行计分  
✅ **输入控制**：键盘 + 触摸屏支持  
✅ **响应式布局**：自动适配屏幕尺寸  

## 源码目录介绍

```
├── audio/                    # 音效资源（可用于俄罗斯方块音效）
├── game.js                  # 小程序入口（导入俄罗斯方块）
├── game.json                # 游戏配置
├── project.config.json      # 项目配置
├── project.private.config.json
├── .eslintrc.js             # 代码规范
└── js/
    ├── tetris/              # 俄罗斯方块核心模块
    │   ├── grid.js          # 网格管理（10×20游戏区域）
    │   ├── block.js         # 方块定义（7种经典形状）
    │   ├── game.js          # 游戏主逻辑（下落、碰撞、消行、输入）
    │   └── ad.js            # 广告管理器（顶部广告区域）
    ├── main.js              # 游戏主类（适配俄罗斯方块）
    └── render.js            # Canvas初始化（微信小游戏API）
```

## 游戏控制

### 键盘控制
- **← →**：左右移动方块
- **↑**：旋转方块
- **↓**：加速下落
- **空格**：硬降（直接落到底部）
- **R**：重新开始游戏

### 触摸屏控制
屏幕分为四个区域（排除顶部广告区域）：
- **上半部分**：旋转方块
- **左半部分**：左移方块
- **右半部分**：右移方块
- **下半部分**：加速下落

## 游戏结束与复活

### 游戏结束
当新方块无法放置时游戏结束，弹出重新开始弹窗：
- **最终分数**：显示本次游戏得分
- **看广告复活按钮**：观看广告清除底部方块并继续游戏（每局仅限一次）
- **重新开始按钮**：重新开始新游戏
- **键盘快捷键**：按R键重新开始

### 复活功能
1. **观看广告**：点击"看广告复活"按钮，观看激励视频广告
2. **清除方块**：广告观看成功后，清除网格底部4行方块
3. **继续游戏**：游戏状态恢复，方块继续下落
4. **限制**：每局游戏只能使用一次复活功能

### 弹窗设计
- **位置**：屏幕中央，不覆盖顶部广告区域
- **尺寸**：屏幕宽度的70%，高度300像素
- **按钮状态**：已使用复活功能后，按钮变为灰色不可点击

## 广告集成

游戏顶部有一个80像素高的广告区域：

### 当前实现
1. **模拟广告**：用于开发和测试，30秒自动更换内容
2. **可点击区域**：点击广告区域会有控制台日志输出
3. **游戏区域调整**：游戏区域自动下移，为广告留出空间
4. **激励视频广告**：支持模拟激励视频广告，用于游戏复活功能

### 接入真实微信广告
要接入真实微信广告，请修改 `js/tetris/ad.js` 中的 `loadWeChatAd()` 方法：

```javascript
loadWeChatAd() {
  if (wx.createBannerAd) {
    this.bannerAd = wx.createBannerAd({
      adUnitId: 'your-ad-unit-id', // 替换为你的广告单元ID
      style: {
        left: 0,
        top: 0,
        width: 320,
        height: this.adHeight
      }
    });
    
    this.bannerAd.onLoad(() => {
      console.log('广告加载成功');
    });
    
    this.bannerAd.onError((err) => {
      console.log('广告加载失败', err);
    });
    
    this.bannerAd.show();
  }
}
```

### 接入激励视频广告（用于复活功能）
要接入真实微信激励视频广告，请修改 `js/tetris/ad.js` 中的 `initRewardedAd()` 和 `showRewardedAd()` 方法：

```javascript
initRewardedAd() {
  if (wx.createRewardedVideoAd) {
    this.rewardedAd = wx.createRewardedVideoAd({
      adUnitId: 'your-rewarded-video-ad-unit-id'
    });
    
    this.rewardedAd.onLoad(() => {
      console.log('激励视频广告加载成功');
    });
    
    this.rewardedAd.onError((err) => {
      console.log('激励视频广告加载失败', err);
    });
    
    this.rewardedAd.onClose((res) => {
      if (res && res.isEnded) {
        // 正常播放结束，发放奖励
        if (this.rewardCallback) {
          this.rewardCallback();
          this.rewardCallback = null;
        }
      } else {
        // 未播放完整，不发奖励
        console.log('广告未播放完整，不发奖励');
      }
    });
  }
}

showRewardedAd(onSuccess, onError) {
  if (this.rewardedAd) {
    this.rewardCallback = onSuccess;
    this.rewardedAd.show().catch(() => {
      // 失败重试
      this.rewardedAd.load()
        .then(() => this.rewardedAd.show())
        .catch(err => {
          console.log('激励视频广告显示失败', err);
          if (onError) onError(err);
        });
    });
  } else {
    console.log('激励视频广告未初始化');
    if (onError) onError('广告未初始化');
  }
}
```

### 广告配置
- **高度**：80像素
- **位置**：屏幕顶部
- **更新间隔**：30秒
- **游戏结束处理**：游戏结束提示不覆盖广告区域，广告保持可点击

## 开发说明

1. **导入项目**：在微信开发者工具中导入此目录
2. **运行测试**：直接运行即可体验完整游戏
3. **自定义广告**：修改 `js/tetris/ad.js` 文件接入真实广告
4. **扩展功能**：代码模块化设计，易于添加新功能（如音效、粒子特效、多人对战等）

## 注意事项

- 游戏使用ES6模块语法，确保开发环境支持
- 广告区域高度可在 `AdManager` 构造函数中调整
- 游戏区域自动居中并适配广告高度
- 触摸输入已排除广告区域，防止误操作
