import './render'; // 初始化Canvas
import TetrisGame from './tetris/game';
import Cover from './cover';
import EnergyManager from './tetris/energy';

const isDebugMode = false

/**
 * 游戏主类
 */
export default class Main {
  constructor() {
    this.ctx = null;
    this.cover = null;
    this.game = null;
    this.currentState = 'cover'; // 'cover' 或 'game'
    this.aniId = null;
    this.energyManager = new EnergyManager();
    
    // 隐私协议状态
    this.privacyResolve = null;
    this.privacyAgreed = false;
    
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
        console.log('当前privacyAgreed:', this.privacyAgreed, 'privacyResolve:', this.privacyResolve ? '存在' : '不存在');
        
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
              // 上报同意事件
              if (this.privacyResolve === resolve) {
                console.log('上报隐私同意事件');
                resolve({ event: 'agree' });
                this.privacyResolve = null;
              }
            } else {
              console.log('用户拒绝隐私协议');
              // 更新本地状态
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
    * 处理隐私协议同意
    */
    handlePrivacyAgree() {
      console.log('用户同意隐私协议');
      this.privacyAgreed = true;
      
      // 更新封面显示状态
      if (this.cover && this.cover.setPrivacyAgreed) {
        this.cover.setPrivacyAgreed(true);
      }
      
      if (this.privacyResolve) {
        console.log('====上报隐私同意====');
        this.privacyResolve({ event: 'agree' });
        this.privacyResolve = null;
      }
    }
  
    /**
     * 处理隐私协议拒绝
     */
    handlePrivacyDisagree() {
      console.log('用户拒绝隐私协议');
      this.privacyAgreed = false;
      
      // 更新封面显示状态
      if (this.cover && this.cover.setPrivacyAgreed) {
        this.cover.setPrivacyAgreed(false);
      }
      
      if (this.privacyResolve) {
        this.privacyResolve({ event: 'disagree' });
        this.privacyResolve = null;
      }
      

    }
  
  /**
   * 处理封面隐私协议操作
   */
  handleCoverPrivacyAction(action, data) {
    // console.log('处理封面隐私协议操作:', action, data);
    
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
     console.log('当前状态 - privacyResolve:', this.privacyResolve ? '存在' : '不存在', 'privacyAgreed:', this.privacyAgreed);
     
     // 切换状态
     const newState = !this.privacyAgreed;
     console.log('状态从', this.privacyAgreed, '切换到', newState);
     
     // 更新本地状态
     this.privacyAgreed = newState;
     
     // 同步到cover
     if (this.cover && this.cover.setPrivacyAgreed) {
       console.log('同步状态到cover:', newState);
       this.cover.setPrivacyAgreed(newState);
     }
     
      // 如果有等待中的privacyResolve（授权流程已开始），直接处理同意/拒绝
      if (this.privacyResolve) {
        console.log('有等待中的privacyResolve，处理同意/拒绝');
        if (newState) {
          console.log('用户同意 -> 调用resolve({ event: "agree" })');
          this.privacyResolve({ event: 'agree' });
          this.privacyResolve = null;
        } else {
          console.log('用户拒绝 -> 不调用resolve，等待用户重新勾选');
          // 用户取消勾选，不调用resolve，等待用户重新勾选
        }
      }
     
     console.log('=== 隐私协议勾选框点击结束 ===');
   }
  
  /**
   * 处理隐私弹窗确认按钮点击
   */
  async handlePrivacyModalConfirm() {
    console.log('=== 隐私弹窗确认按钮点击 ===');
    //console.log('当前状态 - privacyResolve:', this.privacyResolve ? '存在' : '不存在', 'privacyAgreed:', this.privacyAgreed);
    
    // 获取弹窗内的勾选框状态
    let modalAgreed = false;
    if (this.cover && this.cover.privacyModal) {
      modalAgreed = this.cover.privacyModal.checkbox.checked;
      console.log('弹窗内勾选框状态:', modalAgreed);
    }
    
    if (!modalAgreed) {
      console.log('弹窗内未勾选，无法同意隐私协议');
      // 可以显示提示信息
      return;
    }
    
    // 用户同意隐私协议
    this.handlePrivacyAgree();
    
    // 隐藏弹窗
    if (this.cover && this.cover.hidePrivacyModal) {
      this.cover.hidePrivacyModal();
    }
  }
  
  /**
   * 处理隐私弹窗取消按钮点击
   */
  handlePrivacyModalCancel() {
    console.log('=== 隐私弹窗取消按钮点击 ===');
    console.log('当前状态 - privacyResolve:', this.privacyResolve ? '存在' : '不存在', 'privacyAgreed:', this.privacyAgreed);
    
    // 用户取消/拒绝隐私协议
    this.handlePrivacyDisagree();
    
    // 隐藏弹窗
    if (this.cover && this.cover.hidePrivacyModal) {
      this.cover.hidePrivacyModal();
    }
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
   * 检查隐私授权状态
   */
   // checkPrivacyAuthorization函数已移除，改为同步处理

   // callRequirePrivacyAuthorize函数已移除，改为在勾选框点击时直接调用wx.requirePrivacyAuthorize

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
    * 请求隐私授权（Promise包装）
    */
    requestPrivacyAuthorization() {
      console.log('requestPrivacyAuthorization被调用');
      
      if (typeof wx === 'undefined' || !wx.requirePrivacyAuthorize || isDebugMode) {
        console.log('模拟模式：直接返回true');
        return Promise.resolve(true);
      }
      
      return new Promise((resolve, reject) => {
        // 先查询当前隐私设置状态
        if (wx.getPrivacySetting) {
          wx.getPrivacySetting({
            success: (res) => {
              console.log('wx.getPrivacySetting结果:', res);
              if (!res.needAuthorization) {
                // 不需要授权，用户已同意
                console.log('用户已同意隐私协议，无需再次授权');
                this.privacyAgreed = true;
                this.syncPrivacyStatusToCover();
                resolve(true);
                return;
              }
              // 需要授权，调用requirePrivacyAuthorize
              this.callRequirePrivacyAuthorize(resolve, reject);
            },
            fail: (err) => {
              console.warn('wx.getPrivacySetting失败:', err);
              // 降级处理，直接调用requirePrivacyAuthorize
              this.callRequirePrivacyAuthorize(resolve, reject);
            }
          });
        } else {
          // 没有getPrivacySetting，直接调用requirePrivacyAuthorize
          this.callRequirePrivacyAuthorize(resolve, reject);
        }
      });
    }
    
    /**
     * 调用wx.requirePrivacyAuthorize发起隐私授权请求
     */
    callRequirePrivacyAuthorize(resolve, reject) {
      console.log('调用wx.requirePrivacyAuthorize');
      
      wx.requirePrivacyAuthorize({
        success: () => {
          console.log('wx.requirePrivacyAuthorize success: 用户同意隐私协议');
          this.privacyAgreed = true;
          this.syncPrivacyStatusToCover();
          resolve(true);
        },
        fail: (err) => {
          console.log('wx.requirePrivacyAuthorize fail: 用户拒绝隐私协议，错误信息:', err);
          this.privacyAgreed = false;
          this.syncPrivacyStatusToCover();
          reject(err);
        },
        complete: () => {
          console.log('wx.requirePrivacyAuthorize complete');
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
      this.handleTouch(touch.clientX, touch.clientY);
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

  /**
   * 处理触摸输入
   */
  handleTouch(x, y) {
    if (this.currentState === 'cover' && this.cover) {
      const clickedId = this.cover.handleClick(x, y);
      console.log('handleTouch clickedId:', clickedId);
      
      if (clickedId === 'play' || clickedId === 'playNav') {
        this.startGame();
      } else if (clickedId === 'scores' || clickedId === 'scoresNav') {
        console.log('打开分数页面');
        // 待实现
      } else if (clickedId === 'shop') {
        console.log('打开商店页面');
        // 待实现
      } else if (clickedId === 'settingsNav') {
        console.log('打开设置页面');
        // 待实现
      } else if (clickedId === 'agree-btn') {
        console.log('用户点击弹窗确认按钮，触发隐私授权');
        this.handlePrivacyModalConfirm();
      } else if (clickedId === 'privacyCancel') {
        console.log('用户点击弹窗取消按钮');
        this.handlePrivacyModalCancel();
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
      
      // 检查隐私协议
      if (!this.privacyAgreed) {
        console.warn('请先同意用户服务协议和隐私保护政策');
        // TODO: 显示UI提示
        return;
      }
      
      // 如果用户已同意但授权流程未开始，发起微信授权
      if (!this.privacyResolve) {
        console.log('用户已同意隐私协议，发起微信授权流程');
        try {
          const authorized = await this.requestPrivacyAuthorization();
          if (!authorized) {
            console.warn('隐私授权未完成，无法开始游戏');
            return;
          }
        } catch (err) {
          console.error('隐私授权流程异常:', err);
          return;
        }
      }
    
    // 检查体力
    if (!this.energyManager.hasEnoughEnergy()) {
      console.warn('体力不足，无法开始游戏');
      // TODO: 显示UI提示
      return;
    }
    
    // 消耗体力
    if (!this.energyManager.consumeEnergy()) {
      console.error('消耗体力失败');
      return;
    }
    
    console.log(`消耗${this.energyManager.costPerGame}点体力，剩余${this.energyManager.getCurrentEnergy()}/${this.energyManager.maxEnergy}`);
    
    // 隐藏封面
    if (this.cover) {
      this.cover.hide();
    }
    
    // 停止主循环（封面渲染）
    this.stopMainLoop();
    
    // 创建游戏实例
    if (!this.game) {
      this.game = new TetrisGame(this.ctx);
      this.game.start();
    } else {
      this.game.restart();
      this.game.start();
    }
    
    // 切换状态
    this.currentState = 'game';
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
    
    // 重新启动主循环（封面渲染）
    this.startMainLoop();
  }

  /**
   * 主循环
   */
  mainLoop() {
    // 清空画布
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 根据当前状态渲染
    if (this.currentState === 'cover' && this.cover) {
      this.cover.render();
    } else if (this.currentState === 'game' && this.game) {
      // 游戏有自己的循环，我们不需要额外渲染
      // 但为了确保游戏渲染，我们调用游戏的render方法
      // 注意：游戏循环在TetrisGame内部运行，所以这里可能不需要
      // 我们只是作为备份渲染
      this.game.render();
    }
    
    // 继续循环
    this.aniId = requestAnimationFrame(this.mainLoop.bind(this));
  }

  /**
   * 启动主循环
   */
  startMainLoop() {
    if (this.aniId) {
      cancelAnimationFrame(this.aniId);
    }
    this.mainLoop();
  }

  /**
   * 停止主循环
   */
  stopMainLoop() {
    if (this.aniId) {
      cancelAnimationFrame(this.aniId);
      this.aniId = null;
    }
  }
}