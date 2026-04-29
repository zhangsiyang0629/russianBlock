import './render'; // 初始化Canvas
import TetrisGame from './tetris/game';
import Cover from './cover';
import EnergyManager from './tetris/energy';
import RankPanel from './tetris/rank';
import { getOrCreatePlayerData, updateUserInfo } from './tetris/playerData';

const isDebugMode = false

/**
 * 游戏主类
 */
export default class Main {
  constructor() {
    this.ctx = null;
    this.cover = null;
    this.game = null;
    this.rankPanel = null;
    this.currentState = 'cover';
    this.aniId = null;
    this.energyManager = new EnergyManager();
    this.playerData = null;
    this.savedLevel = 1;
    this.savedHighScore = 0;
    
    // 隐私协议状态
    this.privacyResolve = null;
    this.privacyAgreed = false;
    
    // 微信用户信息绑定状态
    let savedUserInfoBound = false;
    try { savedUserInfoBound = !!wx.getStorageSync('userInfoBound'); } catch (e) {}
    console.log('savedUserInfoBound', savedUserInfoBound)
    this.userInfoBound = savedUserInfoBound;
    this.userInfoButton = null; // wx.createUserInfoButton 实例
    
    // 防重复点击标志
    this.isStartingGame = false;
    
    // 主循环停止标志
    this.mainLoopStopped = false;
    
    // 等待Canvas准备就绪
    setTimeout(() => {
      this.init();
    }, 100);
  }

  init() {
    this.ctx = canvas.getContext('2d');
    
    // 注册隐私授权回调（必须在调用任何需要隐私授权的API之前）
    this.setupPrivacyAuthorization();
    
    // 初始化封面
    this.cover = new Cover(this.ctx, () => {
      const info = this.energyManager.getEnergyInfo();
      //console.log('体力信息:', info);
      return info;
    }, (action, data) => {
      // 处理隐私协议相关操作
      this.handleCoverPrivacyAction(action, data);
    });
    
    // 从云数据库同步体力数据
    this.syncEnergyFromCloud();
    
    // 初始化检查用户隐私授权状态
    this.initPrivacyStatusCheck();
    
    // 绑定全局事件
    this.bindEvents();
    
    // 开始主循环
    this.startMainLoop();
  }

  /**
   * 设置隐私授权回调
    */
    setupPrivacyAuthorization() {
      if (typeof wx === 'undefined' || !wx.onNeedPrivacyAuthorization) {
        console.warn('wx.onNeedPrivacyAuthorization not available');
        return;
      }
      
        wx.onNeedPrivacyAuthorization((resolve, eventInfo) => {
          console.log('=== wx.onNeedPrivacyAuthorization回调被触发 ===', eventInfo.referrer);
          
          // 存储resolve函数供后续使用
          this.privacyResolve = resolve;
          
          // 使用微信原生Modal作为隐私弹窗
          console.log('显示微信原生隐私弹窗');
          wx.showModal({
            title: '隐私协议确认',
            content: '请确认您已详细阅读并同意用户服务协议和隐私保护政策',
            confirmText: '同意',
            cancelText: '拒绝',
            success: (res) => {
              console.log('微信Modal结果:', res);
              if (res.confirm) {
                console.log('用户同意隐私协议');
                // 更新本地状态
                this.privacyAgreed = true;
                this.syncPrivacyStatusToCover();
                // 标记授权已完成（勾选框消失）
                if (this.cover && this.cover.setAuthorizationCompleted) {
                  this.cover.setAuthorizationCompleted(true);
                }
                // 保存到本地存储，下次启动直接隐藏勾选框
                try { wx.setStorageSync('privacyAuthorized', true); } catch (e) {}
                // 尝试绑定微信用户信息
                this.tryBindUserInfo();
                // 上报同意事件
                if (this.privacyResolve === resolve) {
                  console.log('上报隐私同意事件');
                  resolve({ event: 'agree' });
                  this.privacyResolve = null;
                }
              } else {
                console.log('用户拒绝隐私协议');
                // 更新本地状态（取消勾选）
                this.privacyAgreed = false;
                this.syncPrivacyStatusToCover();
                // 上报拒绝事件
                if (this.privacyResolve === resolve) {
                  console.log('上报隐私拒绝事件');
                  resolve({ event: 'disagree' });
                  this.privacyResolve = null;
                }
              }
            },
            fail: (err) => {
              console.error('微信Modal失败:', err);
              // Modal失败，上报拒绝
              if (this.privacyResolve === resolve) {
                resolve({ event: 'disagree' });
                this.privacyResolve = null;
              }
            },
            complete: () => {
              console.log('微信Modal完成');
            }
          });
          
          // 上报隐私弹窗已曝光（Modal已显示）
          console.log('上报隐私弹窗曝光事件');
          resolve({ event: 'exposureAuthorization' });
        });
     }

    /**
     * 创建微信用户信息授权按钮
     */
    createUserInfoButton() {
      if (this.userInfoButton) {
        this.userInfoButton.destroy();
        this.userInfoButton = null;
      }
      if (typeof wx === 'undefined' || !wx.createUserInfoButton) return;

      // 计算按钮位置（Play按钮下方，类似隐私条例位置）
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const buttonWidth = 200;
      const buttonHeight = 40;
      
      // Play按钮位置（与cover.js保持一致）
      const playButtonWidth = 300;
      const playButtonHeight = 70;
      const playButtonX = canvasWidth / 2 - playButtonWidth / 2;
      const playButtonY = canvasHeight / 2 + 150;
      
      // 放在Play按钮下方30像素（隐私条例原来的位置）
      const buttonX = canvasWidth / 2 - buttonWidth / 2;
      const buttonY = playButtonY + playButtonHeight + 30;

       this.userInfoButton = wx.createUserInfoButton({
         type: 'text',
         text: '获取头像',
         style: {
           left: buttonX,
           top: buttonY,
           width: buttonWidth,
           height: buttonHeight,
           lineHeight: buttonHeight,
           backgroundColor: '#4CAF50',
           color: '#ffffff',
           textAlign: 'center',
           fontSize: 14,
           borderRadius: 18
         }
       });

      this.userInfoButton.onTap((res) => {
        console.log('用户信息按钮点击结果:', res);
        if (res.errMsg === 'getUserInfo:ok') {
          const { nickName, avatarUrl } = res.userInfo;
          console.log('获取到微信用户信息:', nickName);
          updateUserInfo(nickName, avatarUrl);
          this.userInfoBound = true;
          try { wx.setStorageSync('userInfoBound', true); } catch (e) {}
          if (this.cover && this.cover.setUserInfoBound) {
            this.cover.setUserInfoBound(true);
          }
          // 销毁按钮
          this.destroyUserInfoButton();
        } else {
          console.warn('用户拒绝授权用户信息:', res.errMsg);
        }
      });
    }

    /**
     * 销毁微信用户信息授权按钮
     */
    destroyUserInfoButton() {
      if (this.userInfoButton) {
        this.userInfoButton.destroy();
        this.userInfoButton = null;
      }
    }

    /**
   * 初始化检查用户隐私授权状态
   */
  initPrivacyStatusCheck() {
    if (typeof wx === 'undefined' || !wx.getPrivacySetting || isDebugMode) {
      console.log('模拟模式: 跳过初始化隐私状态检查');
      return;
    }
    
    console.log('初始化检查用户隐私授权状态');
    wx.getPrivacySetting({
      success: (res) => {
        console.log('初始化隐私状态检查结果:', res.needAuthorization);
        if (!res.needAuthorization) {
          // 用户已同意隐私协议
          console.log('用户已同意隐私协议，初始化勾选状态');
          this.privacyAgreed = true;
          this.syncPrivacyStatusToCover();
          // 标记授权已完成（勾选框消失）
          if (this.cover && this.cover.setAuthorizationCompleted) {
            this.cover.setAuthorizationCompleted(true);
          }
          // 保存到本地存储
          try { wx.setStorageSync('privacyAuthorized', true); } catch (e) {}
          // 尝试绑定微信用户信息
          this.tryBindUserInfo();
        } else {
          console.log('用户需要授权隐私协议，保持未勾选状态');
        }
      },
      fail: (err) => {
        console.warn('初始化隐私状态检查失败:', err);
      }
    });
  }
  
   /**
    * 处理封面隐私协议操作
    */
   handleCoverPrivacyAction(action, data) {    
     switch (action) {
       case 'checkboxClick':
         // 用户点击了隐私协议勾选框
         this.handlePrivacyCheckboxClick();
         break;
       case 'termsClick':
         // 用户点击了用户服务协议链接
         this.openPrivacyContract('terms');
         break;
       case 'privacyClick':
         // 用户点击了隐私保护政策链接
         this.openPrivacyContract('privacy');
         break;
       case 'getAgreedStatus':
         // 封面请求获取当前同意状态
         return this.privacyAgreed;

       default:
         console.warn('未知的隐私协议操作:', action);
     }
    }
   

   
     /**
      * 处理隐私协议勾选框点击
      */
      handlePrivacyCheckboxClick() {
       console.log('=== 隐私协议勾选框点击开始 ===');
       
       // 调用微信隐私授权，触发原生弹窗
       console.log('调用微信隐私授权');
       if (typeof wx === 'undefined' || !wx.requirePrivacyAuthorize || isDebugMode) {
         console.log('模拟模式：直接返回');
         return;
       }
       
       wx.requirePrivacyAuthorize({
         success: () => {
           console.log('wx.requirePrivacyAuthorize success: 用户同意隐私协议');
           // 状态已在onNeedPrivacyAuthorization回调中更新，此处只尝试绑定用户信息
           this.tryBindUserInfo();
         },
         fail: (err) => {
           console.log('wx.requirePrivacyAuthorize fail: 用户拒绝隐私协议，错误信息:', err);
           // 状态已在onNeedPrivacyAuthorization回调中更新
         },
         complete: () => {
           console.log('wx.requirePrivacyAuthorize complete');
         }
       });
    
       console.log('=== 隐私协议勾选框点击结束 ===');
     }
  
  /**
   * 打开隐私协议合同
   */
  openPrivacyContract(type = 'privacy') {
    console.log(`打开隐私协议合同: ${type}`);
    
    if (typeof wx === 'undefined' || !wx.openPrivacyContract) {
      console.warn('wx.openPrivacyContract not available');
      return;
    }
    
    wx.openPrivacyContract({
      success: () => {
        console.log('隐私协议合同打开成功');
      },
      fail: (err) => {
        console.error('隐私协议合同打开失败:', err);
      }
    });
  }

   /**
    * 同步隐私状态到cover
    */
   syncPrivacyStatusToCover() {
     if (this.cover && this.cover.setPrivacyAgreed) {
       console.log('同步隐私状态到cover:', this.privacyAgreed);
       this.cover.setPrivacyAgreed(this.privacyAgreed);
     }
   }

    /**
     * 尝试绑定微信用户信息
     */
    tryBindUserInfo() {
      if (this.userInfoBound) return;
      if (typeof wx === 'undefined' || isDebugMode) return;

      wx.getSetting({
       success: (res) => {
         console.log('wx.getSetting', res)
         if (res.authSetting['scope.userInfo']) {
           wx.getUserInfo({
             withCredentials: true,
             success: (res) => {
               const { nickName, avatarUrl } = res.userInfo;
               console.log('获取到微信用户信息:', nickName);
               updateUserInfo(nickName, avatarUrl);
               this.userInfoBound = true;
               try { wx.setStorageSync('userInfoBound', true); } catch (e) {}
               if (this.cover && this.cover.setUserInfoBound) {
                 this.cover.setUserInfoBound(true);
               }
               // 销毁用户信息按钮（如果存在）
               this.destroyUserInfoButton();
             },
             fail: (err) => {
               console.warn('wx.getUserInfo 失败:', err);
             }
           });
         } else {
           // 创建微信用户信息授权按钮
           this.createUserInfoButton();
         }
       },
       fail: (err) => {
         console.warn('wx.getSetting 失败:', err);
       }
     });
   }

   /**
    * 绑定全局事件
    */
  bindEvents() {
    // 触摸事件
    wx.onTouchStart((e) => {
      const touch = e.touches[0];
      this.handleTouchStart(touch.clientX, touch.clientY);
    });
    
    wx.onTouchMove((e) => {
      const touch = e.touches[0];
      this.handleTouchMove(touch.clientX, touch.clientY);
    });
    
    wx.onTouchEnd((e) => {
      const touch = e.changedTouches[0];
      this.handleTouchEnd(touch.clientX, touch.clientY);
    });
    
    // 键盘事件（用于重新开始）
    wx.onKeyDown((res) => {
      if (res.keyCode === 82) { // R键
        if (this.currentState === 'game' && this.game) {
          this.game.restart();
        }
      }
    });
  }
  
  handleTouchStart(x, y) {
    if (this.currentState === 'rank' && this.rankPanel) {
      this.rankPanel.handleTouchStart(x, y);
    }
    // 保持原有点击处理
    if (this.currentState === 'cover' && this.cover) {
      this._lastTapX = x;
      this._lastTapY = y;
      this._isTap = true;
    }
  }
  
  handleTouchMove(x, y) {
    if (this.currentState === 'rank' && this.rankPanel) {
      this.rankPanel.handleTouchMove(x, y);
    }
    if (this.currentState === 'cover') {
      this._isTap = false;
    }
  }
  
  handleTouchEnd(x, y) {
    if (this.currentState === 'rank' && this.rankPanel) {
      this.rankPanel.handleTouchEnd(x, y);
      return;
    }
    // 处理封面点击（仅当是点击操作而非滑动）
    if (this.currentState === 'cover' && this.cover && this._isTap) {
      this.handleTouch(this._lastTapX, this._lastTapY);
    }
    // 处理游戏触摸
    if (this.currentState === 'game' && this.game) {
      this.handleTouch(x, y);
    }
  }

  /**
   * 处理触摸输入
   */
  handleTouch(x, y) {
    if (this.currentState === 'rank' && this.rankPanel) {
      this.rankPanel.handleTouchEnd(x, y);
      return;
    }

    if (this.currentState === 'cover' && this.cover) {
      const clickedId = this.cover.handleClick(x, y);
      // console.log('handleTouch clickedId:', clickedId);
      
      if (clickedId === 'play') {
        this.startGame();
      } else if (clickedId === 'scoresNav') {
        this.handleRankEntry('score');
      } else if (clickedId === 'levelsNav') {
        this.handleRankEntry('level');
      } else if (clickedId === 'settingsNav') {
        if (this.cover) {
          this.cover.showSettings();
        }
      }
    } else if (this.currentState === 'game' && this.game) {
      this.game.handleTouch(x, y);
    }
  }

   /**
    * 开始游戏
    */
    async startGame() {
      console.log('开始游戏');
      
      // 额外保护：如果已经是游戏状态，直接返回
      if (this.currentState === 'game') {
        console.log('游戏已在运行中');
        return;
      }
      
      // 防重复点击：如果正在启动游戏，直接返回
      if (this.isStartingGame) {
        console.log('游戏正在启动中，请勿重复点击');
        return;
      }
      
      // 标记游戏正在启动
      this.isStartingGame = true;
      
       // 根据文档，Play按钮直接开始游戏，无任何前置授权检查
       // 隐私授权通过勾选框触发，不在此处处理
     
    // 检查体力
    if (!this.energyManager.hasEnoughEnergy()) {
      console.warn('体力不足，无法开始游戏');
      this.isStartingGame = false; // 重置标志
      // TODO: 显示UI提示
      return;
    }
    
    // 消耗体力
    if (!this.energyManager.consumeEnergy()) {
      console.error('消耗体力失败');
      this.isStartingGame = false; // 重置标志
      return;
    }
    
    console.log(`消耗${this.energyManager.costPerGame}点体力，剩余${this.energyManager.getCurrentEnergy()}/${this.energyManager.maxEnergy}`);
    
    // 加载玩家数据（从云数据库或本地存储）
    try {
      this.playerData = await getOrCreatePlayerData();
      if (this.playerData) {
        this.savedLevel = this.playerData.level || 1;
        this.savedHighScore = this.playerData.highScore || 0;
        console.log(`玩家数据加载成功: 关卡=${this.savedLevel}, 最高分=${this.savedHighScore}`);
      }
    } catch (err) {
      console.warn('加载玩家数据失败，使用默认值:', err);
      this.savedLevel = 1;
      this.savedHighScore = 0;
    }
    
    // 隐藏封面
    if (this.cover) {
      this.cover.hide();
    }

    // 根据文档，头像授权按钮应保留直到用户授权，不在此处销毁
    // this.destroyUserInfoButton();

    // 停止主循环（封面渲染）
    this.stopMainLoop();
    
    try {
      // 创建游戏实例
      if (!this.game) {
        this.game = new TetrisGame(this.ctx, this.savedLevel, this.savedHighScore);
        this.game.start();
      } else {
        this.game.restart(this.savedLevel, this.savedHighScore);
        this.game.start();
      }
      
      // 切换状态
      this.currentState = 'game';
    } catch (error) {
      console.error('启动游戏失败:', error);
      // 如果游戏启动失败，返回封面
      this.returnToCover();
    } finally {
      // 重置启动标志
      this.isStartingGame = false;
    }
  }

  /**
   * 返回封面
   */
  returnToCover() {
    if (this.game) {
      // 停止游戏循环
      this.game.destroy();
      this.game = null;
    }
    
    // 显示封面
    if (this.cover) {
      this.cover.show();
    }
    
    this.currentState = 'cover';

    // 尝试绑定微信用户信息（如果尚未绑定）
    this.tryBindUserInfo();

    // 重新启动主循环（封面渲染）
    this.startMainLoop();
  }

  /**
   * 主循环
   */
  mainLoop() {
    // 检查是否应该停止主循环
    if (this.mainLoopStopped) {
      this.aniId = null;
      return;
    }
    
    // 如果当前状态是游戏，并且游戏有自己的循环，我们不需要运行主循环
    if (this.currentState === 'game') {
      this.aniId = requestAnimationFrame(this.mainLoop.bind(this));
      return;
    }
    
    // 排行榜面板有独立的渲染循环
    if (this.currentState === 'rank') {
      if (this.rankPanel) {
        this.rankPanel.render();
      }
      this.aniId = requestAnimationFrame(this.mainLoop.bind(this));
      return;
    }
    
    // 清空画布
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 根据当前状态渲染
    if (this.currentState === 'cover' && this.cover) {
      this.cover.render();
    }
    
    // 继续循环
    this.aniId = requestAnimationFrame(this.mainLoop.bind(this));
  }

  /**
   * 启动主循环
   */
  startMainLoop() {
    this.mainLoopStopped = false;
    if (this.aniId) {
      cancelAnimationFrame(this.aniId);
    }
    this.mainLoop();
  }

  /**
   * 停止主循环
   */
  stopMainLoop() {
    this.mainLoopStopped = true;
    if (this.aniId) {
      cancelAnimationFrame(this.aniId);
      this.aniId = null;
    }
  }
  
  /**
   * 处理排行榜入口点击（含授权流程）
   * @param {'score'|'level'} tab
   */
  async handleRankEntry(tab) {
    console.log(`打开排行榜: ${tab}`);
    
    // 1. 检查隐私授权
    const privacyOk = await this.ensurePrivacyAuthorized();
    if (!privacyOk) {
      console.warn('隐私授权检查失败，仍继续打开排行榜');
    }
    
    // 2. 尝试获取用户信息（不阻塞）
    if (!this.userInfoBound && typeof wx !== 'undefined' && !isDebugMode) {
      this.tryBindUserInfo();
    }
    
    // 3. 加载玩家数据
    try {
      if (!this.playerData) {
        this.playerData = await getOrCreatePlayerData();
      }
    } catch (err) {
      console.warn('加载玩家数据失败:', err);
    }
    
    // 4. 打开排行榜
    this.openRankPanel(tab);
  }
  
  /**
   * 确保隐私已授权
   * @returns {Promise<boolean>}
   */
  ensurePrivacyAuthorized() {
    return new Promise((resolve) => {
      if (typeof wx === 'undefined' || !wx.getPrivacySetting || isDebugMode) {
        resolve(true);
        return;
      }
      
      wx.getPrivacySetting({
        success: (res) => {
          if (res.needAuthorization) {
            // 需要授权，触发隐私弹窗
            wx.requirePrivacyAuthorize({
              success: () => {
                this.privacyAgreed = true;
                if (this.cover && this.cover.setPrivacyAgreed) {
                  this.cover.setPrivacyAgreed(true);
                }
                resolve(true);
              },
              fail: () => {
                console.warn('用户拒绝隐私授权');
                resolve(false);
              }
            });
          } else {
            resolve(true);
          }
        },
        fail: () => {
          resolve(true);
        }
      });
    });
  }
  
  /**
   * 打开排行榜面板
   */
  async openRankPanel(tab) {
    if (!this.rankPanel) {
      this.rankPanel = new RankPanel(this.ctx, this.playerData, () => {
        this.closeRankPanel();
      });
    }
    
    await this.rankPanel.show(tab);
    
    this.currentState = 'rank';
    
    // 隐藏封面
    if (this.cover) {
      this.cover.hide();
    }
  }
  
  /**
   * 关闭排行榜面板
   */
  closeRankPanel() {
    if (this.rankPanel) {
      this.rankPanel.hide();
      this.rankPanel = null;
    }
    
    // 恢复封面
    if (this.cover) {
      this.cover.show();
    }
    
    this.currentState = 'cover';
    this.startMainLoop();
  }
  
  /**
   * 从云数据库同步体力数据
   */
  async syncEnergyFromCloud() {
    try {
      const playerData = await getOrCreatePlayerData();
      if (playerData) {
        this.energyManager.updateFromCloudData(playerData);
      }
    } catch (err) {
      console.warn('从云数据库同步体力数据失败:', err);
    }
  }
}