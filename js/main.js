import './render'; // 初始化Canvas
import TetrisGame from './tetris/game';
import Cover from './cover';
import EnergyManager from './tetris/energy';

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
    
    // 等待Canvas准备就绪
    setTimeout(() => {
      this.init();
    }, 100);
  }

  init() {
    this.ctx = canvas.getContext('2d');
    
    // 初始化封面
    this.cover = new Cover(this.ctx, () => this.energyManager.getEnergyInfo());
    
    // 绑定全局事件
    this.bindEvents();
    
    // 开始主循环
    this.startMainLoop();
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
      }
    } else if (this.currentState === 'game' && this.game) {
      this.game.handleTouch(x, y);
    }
  }

  /**
   * 开始游戏
   */
  startGame() {
    console.log('开始游戏');
    
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