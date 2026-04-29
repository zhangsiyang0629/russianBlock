import Grid from './grid.js';
import Tetromino from './block.js';
import AdManager from './ad.js';
import PengfuAnimation from './animation.js';
import { saveOnLevelComplete, saveOnGameOver } from './playerData.js';

// 设计系统颜色（来自Google Stitch原型）
const COLORS = {
  // 背景和表面
  background: '#fdf6e3',
  surface: '#fdf6e3',
  surfaceContainer: '#efe8d2',
  surfaceContainerHigh: '#eae2cb',
  surfaceContainerLow: '#f8f0dc',
  surfaceContainerLowest: '#ffffff',
  
  // 文字和边框
  onSurface: '#322f22',
  onSurfaceVariant: '#5f5b4d',
  onBackground: '#322f22',
  outline: '#7b7767',
  outlineVariant: '#b2ad9c',
  
  // 主色系
  primary: '#993d46',
  primaryContainer: '#ff8c94',
  onPrimary: '#ffefef',
  onPrimaryContainer: '#5e0f1c',
  
  // 次要色系
  secondary: '#296654',
  secondaryContainer: '#b1efd8',
  onSecondary: '#c5ffe9',
  onSecondaryContainer: '#1d5c4a',
  
  // 第三色系
  tertiary: '#75553e',
  tertiaryContainer: '#fdd1b4',
  onTertiary: '#fff0e8',
  onTertiaryContainer: '#644630',
  
  // 错误色
  error: '#b02500',
  errorContainer: '#f95630',
  onError: '#ffefec',
  onErrorContainer: '#520c00',
  
  // 固定色
  primaryFixed: '#ff8c94',
  primaryFixedDim: '#ef7f87',
  secondaryFixed: '#b1efd8',
  secondaryFixedDim: '#a3e1ca',
  tertiaryFixed: '#fdd1b4',
  tertiaryFixedDim: '#eec4a7',
};

// ====================================================================
// 关卡难度配置（根据 doc/level.md 规格）
// ====================================================================

// 格子数量档位配置 (i=1-4)
const GRID_SIZES = [
  { cols: 10, rows: 20 }, // i=1: 10×20（默认）
  { cols: 13, rows: 21 }, // i=2: 13×21
  { cols: 15, rows: 23 }, // i=3: 15×23
  { cols: 17, rows: 25 }, // i=4: 17×25（最大）
];

// 下落速度倍率档位配置 (j=1-4)
const SPEED_RATES = [1.0, 1.1, 1.15, 1.2]; // j=1-4

// 基础下落速度（毫秒/格）
const BASE_DROP_INTERVAL = 1000; // 1秒/格

// 关卡推进规则配置
const LEVEL_CONFIG = {
  // 1-16关：顺序遍历所有难度组合 (i,j)
  sequentialLevels: 16,
  
  // 第17关：固定极限难度 + 初始砖块
  fixedHardLevelNumber: 17,
  fixedHardLevel: {
    gridIndex: 3, // i=4 -> 索引3 (0-based)
    speedIndex: 3, // j=4 -> 索引3
    initialLayers: { min: 5, max: 8 }, // 5-8层随机初始砖块
  },
  
  // 第18关及以后：完全随机模式
  randomModeStart: 18,
  
  // 初始砖块层数范围
  initialLayersRange: { min: 0, max: 8 }, // 0-8层
};

// 分数配置（便于调试与调整）
const SCORE_CONFIG = {
  // 消行得分（0-4行）
  lineClearPoints: [0, 10, 25, 50, 80],
  // 升级所需分数
  levelUpThreshold: 200,
};

// 设计效果
const EFFECTS = {
  shadowColor: 'rgba(50, 47, 34, 0.5)',
  shadowOffset: 6,
  shadowBlur: 8,
  borderWidth: 2,
  sketchBorderWidth: 4,
};

/**
 * 绘制圆角矩形
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * 俄罗斯方块游戏主类
 */
export default class TetrisGame {
  constructor(ctx, savedLevel = 1, savedHighScore = 0, musicManager = null) {
    this.ctx = ctx;
    const canvas = ctx.canvas;
    
    this.musicManager = musicManager;

    // 广告管理器
    this.adManager = new AdManager();
    
    // 计算布局参数并存储
    this.adHeight = this.adManager.getAdHeight();
    this.bottomHeight = Math.floor(canvas.height / 5);
    this.availableWidth = canvas.width - 40; // 左右留白
    this.availableHeight = canvas.height - this.adHeight - this.bottomHeight - 20; // 上下留白
    
    // 初始化关卡难度配置
    this.gameOver = false;
    this.paused = false;
    this.score = 0;
    this.level = savedLevel; // 从玩家数据加载的关卡
    this.highScore = savedHighScore; // 从玩家数据加载的最高分
    this.linesCleared = 0;
    this.updateLevelConfig();
    
    // 根据当前网格尺寸计算合适的单元格大小
    const gridSize = GRID_SIZES[this.gridSizeIndex];
    const maxCellSizeByWidth = Math.floor(this.availableWidth / gridSize.cols); // 根据列数
    const maxCellSizeByHeight = Math.floor(this.availableHeight / gridSize.rows); // 根据行数
    const cellSize = Math.min(maxCellSizeByWidth, maxCellSizeByHeight, 30); // 最大30px保持清晰度
    // 优先确保网格能放入可用空间，不强制最小15px
    const safeCellSize = Math.max(8, cellSize); // 最小8px确保基本可视性
    
    console.log(`布局计算: 屏幕=${canvas.width}x${canvas.height}, 广告高=${this.adHeight}, 底部高=${this.bottomHeight}, 可用高=${this.availableHeight}, 网格尺寸=${gridSize.cols}x${gridSize.rows}, cellSize=${safeCellSize}, 网格高=${gridSize.rows * safeCellSize}`);
    
    this.cellSize = safeCellSize; // 保存单元格大小用于重置
    this.grid = new Grid(safeCellSize, gridSize.cols, gridSize.rows);  
    this.currentBlock = null;
    this.nextBlock = null;
    
    // 关卡难度配置
    this.gridSizeIndex = 0; // i (0-based) 对应 GRID_SIZES 索引
    this.speedIndex = 0;    // j (0-based) 对应 SPEED_RATES 索引
    this.initialLayers = 0; // 初始随机砖块层数 (0-8)
    
    // 游戏计时相关
    this.lastTime = 0;
    this.dropInterval = 1000; // 初始下落间隔（毫秒）
    this.dropCounter = 0;
    this.aniId = null;
    
    // 输入状态
    this.keys = {};
    
    // 暂停按钮
    this.pauseButton = { x: 0, y: 0, width: 0, height: 0 };
    this._gameOverButtons = [];
    
    // 重新开始弹窗状态
    this.restartButton = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      visible: false
    };
    
    // 复活按钮状态
    this.reviveButton = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      visible: false
    };
    
    // 复活状态
    this.reviveUsed = false; // 是否已使用过复活
    
    // 胜利弹窗状态
    this.showVictoryPopup = false;
    this.victoryMessage = '';
    this.victoryButton = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      visible: false
    };

    // 控制按钮状态（左移、加速、变换、右移）
    this.controlButtons = [
      { id: 'left', x: 0, y: 0, width: 0, height: 0, icon: '←', desc: '左移' },
      { id: 'down', x: 0, y: 0, width: 0, height: 0, icon: '↓', desc: '加速' },
      { id: 'rotate', x: 0, y: 0, width: 0, height: 0, icon: '⟳', desc: '变换' },
      { id: 'right', x: 0, y: 0, width: 0, height: 0, icon: '→', desc: '右移' }
    ];
    
    // 动画实例
    this.pengfuAnimation = new PengfuAnimation();
    
    // 初始化
    this.init();
  }

  init() {
    this.createNewBlock();
    // 输入事件和游戏循环由外部控制
  }
  
  /**
   * 根据关卡编号计算难度配置
   * @param {number} level - 关卡编号（从1开始）
   * @returns {Object} 难度配置 {gridSizeIndex, speedIndex, initialLayers}
   */
  calculateLevelConfig(level) {
    // 1-16关：顺序遍历所有难度组合 (i,j)
    if (level <= LEVEL_CONFIG.sequentialLevels) {
      // level从1开始，转换为0-based索引
      const index = level - 1;
      const gridSizeIndex = Math.floor(index / SPEED_RATES.length); // i (0-3)
      const speedIndex = index % SPEED_RATES.length; // j (0-3)
      return {
        gridSizeIndex: Math.min(gridSizeIndex, GRID_SIZES.length - 1),
        speedIndex: Math.min(speedIndex, SPEED_RATES.length - 1),
        initialLayers: 0 // 1-16关无初始砖块
      };
    }
    
    // 第17关：固定极限难度 + 初始砖块
    if (level === LEVEL_CONFIG.fixedHardLevelNumber) {
      const gridSizeIndex = LEVEL_CONFIG.fixedHardLevel.gridIndex;
      const speedIndex = LEVEL_CONFIG.fixedHardLevel.speedIndex;
      // 随机5-8层初始砖块
      const initialLayers = LEVEL_CONFIG.fixedHardLevel.initialLayers.min + 
        Math.floor(Math.random() * (LEVEL_CONFIG.fixedHardLevel.initialLayers.max - LEVEL_CONFIG.fixedHardLevel.initialLayers.min + 1));
      return { gridSizeIndex, speedIndex, initialLayers };
    }
    
    // 第18关及以后：完全随机模式
    const gridSizeIndex = Math.floor(Math.random() * GRID_SIZES.length);
    const speedIndex = Math.floor(Math.random() * SPEED_RATES.length);
    const initialLayers = LEVEL_CONFIG.initialLayersRange.min + 
      Math.floor(Math.random() * (LEVEL_CONFIG.initialLayersRange.max - LEVEL_CONFIG.initialLayersRange.min + 1));
    return { gridSizeIndex, speedIndex, initialLayers };
  }
  
  /**
   * 更新当前关卡的难度配置
   */
  updateLevelConfig() {
    const config = this.calculateLevelConfig(this.level);
    this.gridSizeIndex = config.gridSizeIndex;
    this.speedIndex = config.speedIndex;
    this.initialLayers = config.initialLayers;
    
    // 确保1-16关没有初始砖块（防御性编程）
    if (this.level <= LEVEL_CONFIG.sequentialLevels) {
      this.initialLayers = 0;
    }
    
    // 更新下落速度
    const speedRate = SPEED_RATES[this.speedIndex];
    this.dropInterval = Math.floor(BASE_DROP_INTERVAL / speedRate);
    
    console.log(`关卡 ${this.level} 配置: 格子=${GRID_SIZES[this.gridSizeIndex].cols}x${GRID_SIZES[this.gridSizeIndex].rows}, 速度倍率=${speedRate}, 初始层数=${this.initialLayers}`);
  }
  
  /**
   * 为新关卡重置网格（包括初始砖块生成）
   */
  resetGridForNewLevel() {
    const gridSize = GRID_SIZES[this.gridSizeIndex];
    
    // 重新计算单元格大小以适应新网格尺寸
    const maxCellSizeByWidth = Math.floor(this.availableWidth / gridSize.cols);
    const maxCellSizeByHeight = Math.floor(this.availableHeight / gridSize.rows);
    const cellSize = Math.min(maxCellSizeByWidth, maxCellSizeByHeight, 30);
    const safeCellSize = Math.max(8, cellSize);
    
    this.cellSize = safeCellSize;
    this.grid = new Grid(safeCellSize, gridSize.cols, gridSize.rows);
    
    // 生成初始随机砖块
    if (this.initialLayers > 0) {
      this.grid.generateInitialLayers(this.initialLayers);
    }
    
    console.log(`网格重置: ${gridSize.cols}x${gridSize.rows}, cellSize=${safeCellSize}, 初始层数=${this.initialLayers}`);
    
    // 重置当前方块
    this.currentBlock = null;
    this.nextBlock = null;
    this.createNewBlock();
  }
  
  /**
   * 启动游戏（开始游戏循环和输入监听）
   */
  start() {
    // 如果游戏循环已经在运行，先停止
    if (this.aniId) {
      cancelAnimationFrame(this.aniId);
      this.aniId = null;
    }
    this.setupInput();
    if (this.musicManager) {
      this.musicManager.playRandom();
    }
    this.gameLoop(0);
  }

  /**
   * 创建新方块
   */
  createNewBlock() {
    if (this.nextBlock) {
      this.currentBlock = this.nextBlock;
      this.currentBlock.setPosition(3, 0);
    } else {
      this.currentBlock = new Tetromino(Tetromino.randomType());
      this.currentBlock.setPosition(Math.floor(this.grid.cols / 2) - 2, 0);
    }
    
    this.nextBlock = new Tetromino(Tetromino.randomType());
    
    // 检查游戏是否结束（新方块无法放置）
    if (!this.grid.isValidShapePosition(
      this.currentBlock.getShape(),
      this.currentBlock.x,
      this.currentBlock.y
    )) {
      this.gameOver = true;
      console.log('Game Over!');
      if (this.musicManager) {
        this.musicManager.stop();
      }

      // 更新最高分并保存玩家数据
      if (this.score > this.highScore) {
        this.highScore = this.score;
      }
      saveOnGameOver(this.score, this.highScore);
      
      // 播放死亡动画（屏幕右下角）
      const canvas = this.ctx.canvas;
      // 根据屏幕尺寸调整缩放比例（高度宽度都放大一倍）
      const targetWidth = canvas.width * 0.6; // 动画占屏幕宽度的60%
      
      // 动态获取帧尺寸，如果无法获取则使用默认值
      const frameSize = this.pengfuAnimation.getFirstFrameSize();
      const frameWidth = frameSize ? frameSize.width : 432; // 默认值
      const frameHeight = frameSize ? frameSize.height : 576; // 默认值
      
      const scale = targetWidth / frameWidth;
      const scaledWidth = frameWidth * scale;
      const scaledHeight = frameHeight * scale;
      const x = canvas.width - scaledWidth / 2 - 10; // 右侧留10px边距
      // 裁剪后动画（上半身）的中心点，使其底部与按钮区域顶部重合
      const y = canvas.height - this.bottomHeight - scaledHeight / 4;
      this.pengfuAnimation.play(x, y, scale, false);
    }
  }

  /**
   * 渲染积分和下一个方块UI（按照原型设计）
   */
  renderScoreAndNextBlockUI(offsetX, offsetY, gridWidth, gridHeight) {
    const { ctx } = this;
    const canvas = ctx.canvas;
    
    // 左侧积分卡片（缩小1/3）
    const scoreCardWidth = 67;
    const scoreCardHeight = 47;
    let scoreCardX = offsetX - scoreCardWidth - 15;
    const scoreCardY = offsetY + 10;
    
    // 边界检查：确保左侧卡片不会超出屏幕左边缘
    if (scoreCardX < 15) {
      scoreCardX = 15;
    }
    
    // 绘制SCORE卡片（旋转-2度）
    ctx.save();
    ctx.translate(scoreCardX + scoreCardWidth / 2, scoreCardY + scoreCardHeight / 2);
    ctx.rotate(-2 * Math.PI / 180);
    ctx.translate(-scoreCardWidth / 2, -scoreCardHeight / 2);
    
    // 卡片阴影（手动绘制，4px偏移）
    ctx.fillStyle = COLORS.onBackground;
    ctx.fillRect(4, 4, scoreCardWidth, scoreCardHeight);
    
    // 卡片背景
    ctx.fillStyle = COLORS.surfaceContainerHigh;
    ctx.fillRect(0, 0, scoreCardWidth, scoreCardHeight);
    
    // 卡片边框
    ctx.strokeStyle = COLORS.onBackground;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, scoreCardWidth, scoreCardHeight);
    
    // 标题文字（缩小比例）
    ctx.fillStyle = COLORS.onSurfaceVariant;
    ctx.font = 'bold 7px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('SCORE', scoreCardWidth / 2, 5);
    
    // 分数数字（缩小比例）
    ctx.fillStyle = COLORS.primary;
    ctx.font = 'bold 16px Arial';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.score.toString(), scoreCardWidth / 2, scoreCardHeight / 2 + 3);
    
    // 关卡显示
    ctx.fillStyle = COLORS.onSurfaceVariant;
    ctx.font = 'bold 5px Arial';
    ctx.textBaseline = 'top';
    ctx.fillText(`STAGE ${this.level}`, scoreCardWidth / 2, scoreCardHeight - 8);
    
    ctx.restore();

    // 暂停按钮（分数卡片上方）
    const pauseBtnW = scoreCardWidth;
    const pauseBtnH = Math.floor(scoreCardHeight / 2);
    const pauseBtnX = scoreCardX;
    const pauseBtnY = scoreCardY - pauseBtnH - 6;
    this.pauseButton = { x: pauseBtnX, y: pauseBtnY, width: pauseBtnW, height: pauseBtnH };

    ctx.save();
    ctx.translate(pauseBtnX + pauseBtnW / 2, pauseBtnY + pauseBtnH / 2);
    ctx.rotate(-2 * Math.PI / 180);
    ctx.translate(-pauseBtnW / 2, -pauseBtnH / 2);

    ctx.fillStyle = COLORS.onBackground;
    ctx.fillRect(4, 4, pauseBtnW, pauseBtnH);

    ctx.fillStyle = this.paused ? COLORS.primary : COLORS.tertiaryContainer;
    ctx.fillRect(0, 0, pauseBtnW, pauseBtnH);

    ctx.strokeStyle = COLORS.onBackground;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, pauseBtnW, pauseBtnH);

    ctx.fillStyle = COLORS.onSurface;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.paused ? '▶' : '❚❚', pauseBtnW / 2, pauseBtnH / 2);
    ctx.restore();

    // 最高分显示（分数卡片下方）
    ctx.save();
    ctx.fillStyle = COLORS.onSurfaceVariant;
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`BEST ${this.highScore}`, scoreCardX + scoreCardWidth / 2, scoreCardY + scoreCardHeight + 5);
    ctx.restore();
    
    // 右侧下一个方块预览卡片（缩小1/3）
    const nextCardWidth = 67;
    const nextCardHeight = 67;
    let nextCardX = offsetX + gridWidth + 15;
    const nextCardY = offsetY + 10;
    
    // 边界检查：确保右侧卡片不会超出屏幕右边缘
    if (nextCardX + nextCardWidth + 15 > canvas.width) {
      nextCardX = canvas.width - nextCardWidth - 15;
    }
    
    ctx.save();
    ctx.translate(nextCardX + nextCardWidth / 2, nextCardY + nextCardHeight / 2);
    ctx.rotate(2 * Math.PI / 180);
    ctx.translate(-nextCardWidth / 2, -nextCardHeight / 2);
    
    // 卡片阴影（手动绘制，4px偏移）
    ctx.fillStyle = COLORS.onBackground;
    ctx.fillRect(4, 4, nextCardWidth, nextCardHeight);
    
    // 卡片背景
    ctx.fillStyle = COLORS.surfaceContainerHigh;
    ctx.fillRect(0, 0, nextCardWidth, nextCardHeight);
    
    // 卡片边框
    ctx.strokeStyle = COLORS.onBackground;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, nextCardWidth, nextCardHeight);
    
    // 标题文字（缩小比例）
    ctx.fillStyle = COLORS.onSurfaceVariant;
    ctx.font = 'bold 7px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('NEXT', nextCardWidth / 2, 5);
    
    // 渲染下一个方块
    if (this.nextBlock) {
      const cellSize = 10;
      const shape = this.nextBlock.getShape();
      const shapeWidth = shape[0].length;
      const shapeHeight = shape.length;
      const blockWidth = shapeWidth * cellSize;
      const blockHeight = shapeHeight * cellSize;
      const blockX = (nextCardWidth - blockWidth) / 2;
      const blockY = (nextCardHeight - blockHeight) / 2 + 10;
      
      ctx.save();
      ctx.translate(blockX, blockY);
      
      // 渲染方块形状
      for (let y = 0; y < shapeHeight; y++) {
        for (let x = 0; x < shapeWidth; x++) {
          if (shape[y][x]) {
            // 方块颜色
            ctx.fillStyle = this.nextBlock.color;
            // 方块边框
            ctx.strokeStyle = COLORS.onBackground;
            ctx.lineWidth = 2;
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
          }
        }
      }
      ctx.restore();
    }
    
    ctx.restore();
  }

  /**
   * 渲染关卡UI（游戏区顶部中间）
   */
  renderLevelUI(offsetX, offsetY, gridWidth) {
    const { ctx } = this;
    const canvas = ctx.canvas;
    
    // 关卡卡片尺寸（与SCORE卡片相同）
    const levelCardWidth = 67;
    const levelCardHeight = 47;
    
    // 计算位置：网格顶部中间
    const levelCardX = offsetX + gridWidth / 2 - levelCardWidth / 2;
    let levelCardY = offsetY - levelCardHeight - 10; // 网格上方10px
    
    // 边界检查：确保不会与广告区域严重重叠
    const minY = this.adManager.getAdHeight() + 5; // 广告下方5px
    if (levelCardY < minY) {
      // 如果会与广告区域重叠，调整到广告下方
      levelCardY = minY;
    }
    
    // 绘制LEVEL卡片（旋转2度，与NEXT卡片对称）
    ctx.save();
    ctx.translate(levelCardX + levelCardWidth / 2, levelCardY + levelCardHeight / 2);
    ctx.rotate(2 * Math.PI / 180);
    ctx.translate(-levelCardWidth / 2, -levelCardHeight / 2);
    
    // 卡片阴影（手动绘制，4px偏移）
    ctx.fillStyle = COLORS.onBackground;
    ctx.fillRect(4, 4, levelCardWidth, levelCardHeight);
    
    // 卡片背景
    ctx.fillStyle = COLORS.surfaceContainerHigh;
    ctx.fillRect(0, 0, levelCardWidth, levelCardHeight);
    
    // 卡片边框
    ctx.strokeStyle = COLORS.onBackground;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, levelCardWidth, levelCardHeight);
    
    // 标题文字
    ctx.fillStyle = COLORS.onSurfaceVariant;
    ctx.font = 'bold 7px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('LEVEL', levelCardWidth / 2, 5);
    
    // 关卡数字（大号显示）
    ctx.fillStyle = COLORS.primary;
    ctx.font = 'bold 16px Arial';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.level.toString(), levelCardWidth / 2, levelCardHeight / 2 + 3);
    
    // 网格尺寸显示
    const gridSize = GRID_SIZES[this.gridSizeIndex];
    const speedRate = SPEED_RATES[this.speedIndex];
    ctx.fillStyle = COLORS.onSurfaceVariant;
    ctx.font = 'bold 5px Arial';
    ctx.textBaseline = 'top';
    const gridInfo = `${gridSize.cols}×${gridSize.rows}`;
    const speedInfo = `${speedRate.toFixed(2)}×`;
    ctx.fillText(gridInfo, levelCardWidth / 2, levelCardHeight - 15);
    ctx.fillText(speedInfo, levelCardWidth / 2, levelCardHeight - 8);
    
    ctx.restore();
  }

  /**
   * 设置输入监听
   */
  setupInput() {
    // 键盘输入
    wx.onKeyDown((res) => {
      this.keys[res.keyCode] = true;
    });
    
    wx.onKeyUp((res) => {
      this.keys[res.keyCode] = false;
    });
    
    // 触摸输入由Main类统一处理
    // wx.onTouchStart((e) => {
    //   const touch = e.touches[0];
    //   this.handleTouch(touch.clientX, touch.clientY);
    // });
  }

  /**
   * 处理触摸输入
   */
  handleTouch(x, y) {
    // 首先检查是否点击了广告
    if (this.adManager.handleClick(x, y)) {
      console.log('触摸被广告区域拦截', x, y);
      return; // 广告被点击，不处理游戏操作
    }

    if (this.paused) {
      for (const btn of this._pauseMenuButtons || []) {
        if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
          if (btn.id === 'continue') {
            this.paused = false;
            console.log('游戏继续');
          } else if (btn.id === 'restart') {
            if (this.onRestart) {
              this.onRestart();
            } else {
              this.restart();
            }
          } else if (btn.id === 'quit') {
            if (this.onQuit) this.onQuit();
          }
          return;
        }
      }
      return;
    }
    
    // 检查是否点击了胜利弹窗的NEXT按钮
    if (this.showVictoryPopup) {
      const { x: btnX, y: btnY, width, height, visible } = this.victoryButton;
      if (width > 0 && height > 0 && x >= btnX && x <= btnX + width && y >= btnY && y <= btnY + height) {
        console.log('点击胜利弹窗NEXT按钮', x, y, btnX, btnY, width, height);
        this.showVictoryPopup = false;
        this.victoryButton.visible = false;
        // 重置游戏状态，进入下一关（重新开始本关）
        this.resetForNextLevel();
        return;
      }
    }
    
    if (this.gameOver) {
      for (const btn of this._gameOverButtons) {
        if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
          console.log(`点击游戏结束按钮: ${btn.id}`, x, y);
          if (btn.id === 'revive') {
            this.reviveByAd();
          } else if (btn.id === 'restart') {
            if (this.onRestart) {
              this.onRestart();
            } else {
              this.restart();
            }
          } else if (btn.id === 'quit') {
            if (this.onQuit) this.onQuit();
          }
          return;
        }
      }
      console.log('游戏结束但未点击按钮', x, y);
      return;
    }

    // 检查暂停按钮
    if (!this.showVictoryPopup) {
      const pb = this.pauseButton;
      if (x >= pb.x && x <= pb.x + pb.width && y >= pb.y && y <= pb.y + pb.height) {
        this.paused = !this.paused;
        // console.log(this.paused ? '游戏暂停' : '游戏继续');
        return;
      }
    }
    
    // 检查是否点击了控制按钮
    const canvas = this.ctx.canvas;
    
    // 如果点击在底部区域，则检查按钮
    if (y >= canvas.height - this.bottomHeight) {
      for (const button of this.controlButtons) {
        if (x >= button.x && x <= button.x + button.width &&
            y >= button.y && y <= button.y + button.height) {
          switch (button.id) {
            case 'left':
              this.moveBlock(-1, 0);
              break;
            case 'down':
              this.moveBlock(0, 1);
              break;
            case 'rotate':
              this.rotateBlock();
              break;
            case 'right':
              this.moveBlock(1, 0);
              break;
          }
          return;
        }
      }
    }
    // 如果点击不在按钮区域，忽略（不处理游戏操作）
  }

  /**
   * 处理键盘输入
   */
  handleInput() {
    // 左箭头：37，右箭头：39，下箭头：40，上箭头：38（旋转），空格：32（硬降）
    if (this.keys[37]) { // 左
      this.moveBlock(-1, 0);
      this.keys[37] = false; // 防止连续触发
    }
    if (this.keys[39]) { // 右
      this.moveBlock(1, 0);
      this.keys[39] = false;
    }
    if (this.keys[40]) { // 下
      this.moveBlock(0, 1);
      this.keys[40] = false;
    }
    if (this.keys[38]) { // 上
      this.rotateBlock();
      this.keys[38] = false;
    }
    if (this.keys[32]) { // 空格
      this.hardDrop();
      this.keys[32] = false;
    }
  }

  /**
   * 移动当前方块
   */
  moveBlock(dx, dy) {
    if (this.gameOver) return;
    
    const clone = this.currentBlock.clone();
    clone.move(dx, dy);
    
    if (this.grid.isValidShapePosition(clone.getShape(), clone.x, clone.y)) {
      this.currentBlock.move(dx, dy);
      return true;
    }
    
    // 如果是向下移动失败，则锁定方块
    if (dy > 0) {
      this.lockBlock();
    }
    
    return false;
  }

  /**
   * 旋转当前方块
   */
  rotateBlock() {
    if (this.gameOver) return;
    
    const clone = this.currentBlock.clone();
    clone.rotate();
    
    // 尝试墙踢（wall kick）：如果旋转后位置无效，尝试左右移动一格
    if (this.grid.isValidShapePosition(clone.getShape(), clone.x, clone.y)) {
      this.currentBlock.rotate();
      return;
    }
    
    // 尝试向左移动
    clone.x -= 1;
    if (this.grid.isValidShapePosition(clone.getShape(), clone.x, clone.y)) {
      this.currentBlock.rotate();
      this.currentBlock.x -= 1;
      return;
    }
    
    // 尝试向右移动
    clone.x += 2;
    if (this.grid.isValidShapePosition(clone.getShape(), clone.x, clone.y)) {
      this.currentBlock.rotate();
      this.currentBlock.x += 1;
      return;
    }
  }

  /**
   * 硬降（方块直接落到底部）
   */
  hardDrop() {
    if (this.gameOver) return;
    
    while (this.moveBlock(0, 1)) {
      // 持续向下移动直到不能移动为止
    }
    this.lockBlock();
  }

  /**
   * 锁定当前方块（放置到网格中）
   */
  lockBlock() {
    const { shape, x, y, color } = this.currentBlock;
    this.grid.placeShape(shape, x, y, color);
    
    // 检查并清除完整的行
    const lines = this.grid.clearLines();
    if (lines > 0) {
      this.linesCleared += lines;
      const points = this.calculateScore(lines);
      this.score += points;
      this.updateLevel();
    }
    
    // 创建新方块
    this.createNewBlock();
  }

  /**
   * 计算得分
   */
  calculateScore(lines) {
    return SCORE_CONFIG.lineClearPoints[lines];
  }

  /**
   * 更新游戏等级（基于累计得分）
   */
  updateLevel() {
    // 检查是否进入新关卡
    if (this.score >= SCORE_CONFIG.levelUpThreshold) {
      const oldLevel = this.level;
      this.level = this.level+1;
      
      // 更新难度配置
      this.updateLevelConfig();
      
      // 重置网格以适应新关卡
      this.resetGridForNewLevel();
      
      // 触发胜利弹窗（仅当关卡变化时）
      this.showVictoryPopup = true;
      // 随机选择弹窗文案
      const messages = ['算你走运', '太牛啦', '一般般'];
      this.victoryMessage = messages[Math.floor(Math.random() * messages.length)];
      
      // 更新最高分
      if (this.score > this.highScore) {
        this.highScore = this.score;
      }
      
      // 保存玩家数据（关卡和最高分）
      saveOnLevelComplete(this.level, this.score, this.highScore);
      
      console.log(`升级: ${oldLevel} -> ${this.level}, 格子=${GRID_SIZES[this.gridSizeIndex].cols}x${GRID_SIZES[this.gridSizeIndex].rows}, 速度=${SPEED_RATES[this.speedIndex]}, 初始层=${this.initialLayers}`);
    }
  }

  /**
   * 更新游戏逻辑
   */
  update(deltaTime) {
    // 更新死亡动画（无论游戏状态如何）
    this.pengfuAnimation.update(Date.now());
    
    // 更新广告状态（无论游戏状态如何）
    this.adManager.update(this.lastTime);
    
    if (this.gameOver || this.paused || this.showVictoryPopup) return;
    
    this.handleInput();
    
    // 更新网格动画状态
    this.grid.updateAnimation();
    
    // 方块自动下落
    this.dropCounter += deltaTime;
    if (this.dropCounter > this.dropInterval) {
      this.moveBlock(0, 1);
      this.dropCounter = 0;
    }
  }

  /**
   * 渲染游戏
   */
  render() {
    const { ctx } = this;
    const canvas = ctx.canvas;
    
    // 清空画布（使用设计系统背景色）
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 渲染广告区域
    this.adManager.render(ctx);
    
    // 计算游戏区域位置（居中，考虑广告和底部按键区高度）
    const gridWidth = this.grid.cols * this.grid.cellSize;
    const gridHeight = this.grid.rows * this.grid.cellSize;
    
    // 获取当前广告高度（可能因广告可见性而改变）
    const currentAdHeight = this.adManager.getAdHeight();
    
    // 计算安全边界
    const topBoundary = currentAdHeight + 10;
    const bottomBoundary = canvas.height - this.bottomHeight - 10;
    const availableSpace = bottomBoundary - topBoundary;
    
    const offsetX = (canvas.width - gridWidth) / 2;
    let offsetY;
    
    if (gridHeight <= availableSpace) {
      // 网格可以完全放入可用空间，垂直居中
      offsetY = topBoundary + (availableSpace - gridHeight) / 2;
    } else {
      // 网格太大，无法完全放入可用空间
      // 使用最小cellSize时仍太大，只能顶部对齐
      offsetY = topBoundary;
      console.warn(`网格高度(${gridHeight}px)超过可用空间(${availableSpace}px)，使用顶部对齐`);
    }
    
    // 最终安全检查：优先确保网格不会与底部按键区重叠
    const gridBottom = offsetY + gridHeight;
    const buttonTop = canvas.height - this.bottomHeight;
    
    // 如果网格会与按钮区域重叠，调整位置
    if (gridBottom > buttonTop - 5) { // 留5px安全边距
      // 优先确保不覆盖按钮区域，即使这意味着可能与广告区域重叠
      const requiredOffsetY = buttonTop - gridHeight - 5;
      
      // 如果调整后的位置会导致网格与广告区域严重重叠（超过20像素），记录警告
      if (requiredOffsetY < topBoundary - 20) {
        console.warn(`网格无法完全放入安全区域，可能与广告区域重叠: offsetY=${requiredOffsetY}, topBoundary=${topBoundary}`);
      }
      
      offsetY = requiredOffsetY;
    }
    
    // 额外检查：如果网格仍然与按钮区域重叠（极端情况），强制调整
    if (offsetY + gridHeight > buttonTop) {
      offsetY = buttonTop - gridHeight;
      console.warn(`强制调整网格位置以避免与按钮区域重叠`);
    }
    
    // 保存画布状态
    ctx.save();
    ctx.translate(offsetX, offsetY);
    
    // 渲染网格
    this.grid.render(ctx);
    
    // 渲染当前方块
    if (this.currentBlock) {
      this.currentBlock.render(ctx, this.grid.cellSize);
    }
    
    // 恢复画布状态
    ctx.restore();
    
    // 渲染积分和下一个方块UI（按照原型设计）
    if (!this.gameOver) {
      this.renderScoreAndNextBlockUI(offsetX, offsetY, gridWidth, gridHeight);
      // 渲染关卡UI（游戏区顶部中间）
      this.renderLevelUI(offsetX, offsetY, gridWidth);
    }
    
    // 渲染游戏信息（游戏结束弹窗）
    // 使用固定位置，因为弹窗会覆盖整个屏幕
    this.renderGameInfo(0, 0);

    // 渲染底部控制按钮
    this.renderControlButtons();

    // 渲染死亡动画
    this.pengfuAnimation.render(ctx);

    if (this.paused) {
      this.renderPauseMenu();
    }
  }

  /**
   * 渲染底部控制按钮
   */
  renderPauseMenu() {
    const ctx = this.ctx;
    const canvas = ctx.canvas;
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, w, h);

    const dw = 260;
    const padding = 28;
    const titleH = 28;
    const btnW = 200;
    const btnH = 48;
    const btnGap = 14;
    const contentH = titleH + 24 + btnH * 3 + btnGap * 2;
    const dh = padding * 2 + contentH;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;
    const btnX = dx + (dw - btnW) / 2;
    const btnStartY = dy + padding + titleH + 24;

    ctx.save();
    ctx.translate(dx + dw / 2, dy + dh / 2);
    ctx.rotate(-1 * Math.PI / 180);
    ctx.translate(-(dx + dw / 2), -(dy + dh / 2));
    ctx.fillStyle = '#fffcf5';
    ctx.strokeStyle = '#322f22';
    ctx.lineWidth = 4;
    drawRoundedRect(ctx, dx, dy, dw, dh, 18);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#322f22';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', w / 2, dy + padding + titleH / 2);

    ctx.fillStyle = '#322f22';
    ctx.fillRect(w / 2 - 30, dy + padding + titleH + 8, 60, 2);

    const buttons = [
      { id: 'continue', text: 'CONTINUE' },
      { id: 'restart', text: 'RESTART' },
      { id: 'quit', text: 'QUIT' },
    ];

    this._pauseMenuButtons = [];

    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const btnY = btnStartY + i * (btnH + btnGap);
      this._pauseMenuButtons.push({ id: btn.id, x: btnX, y: btnY, w: btnW, h: btnH });

      ctx.save();
      ctx.translate(btnX + btnW / 2, btnY + btnH / 2);
      ctx.rotate(-1 * Math.PI / 180);
      ctx.translate(-(btnX + btnW / 2), -(btnY + btnH / 2));

      ctx.fillStyle = '#322f22';
      drawRoundedRect(ctx, btnX + 3, btnY + 3, btnW, btnH, btnH / 2);
      ctx.fill();

      ctx.fillStyle = '#fdd1b4';
      ctx.strokeStyle = '#322f22';
      ctx.lineWidth = 3;
      drawRoundedRect(ctx, btnX, btnY, btnW, btnH, btnH / 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();

      ctx.fillStyle = '#322f22';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.text, btnX + btnW / 2, btnY + btnH / 2);
    }
  }

  renderControlButtons() {
    const { ctx } = this;
    const canvas = ctx.canvas;
    
    // 底部区域背景（浅色背景，顶部边框和阴影）
    ctx.fillStyle = COLORS.surfaceContainerLow;
    ctx.fillRect(0, canvas.height - this.bottomHeight, canvas.width, this.bottomHeight);
    
    // 顶部边框
    ctx.fillStyle = COLORS.onBackground;
    ctx.fillRect(0, canvas.height - this.bottomHeight, canvas.width, 4);
    
    // 顶部阴影（向上偏移）
    ctx.fillStyle = 'rgba(50, 47, 34, 0.05)';
    ctx.fillRect(0, canvas.height - this.bottomHeight - 4, canvas.width, 4);
    
    // 按钮参数
    const buttonCount = this.controlButtons.length;
    const buttonMargin = 20; // 按钮与边缘的间距
    const buttonSpacing = 20; // 按钮之间的间距
    const totalMargin = buttonMargin * 2 + buttonSpacing * (buttonCount - 1);
    const buttonWidth = Math.min(80, (canvas.width - totalMargin) / buttonCount);
    const buttonHeight = Math.min(80, this.bottomHeight - 20);
    const buttonY = canvas.height - this.bottomHeight + (this.bottomHeight - buttonHeight) / 2;
    
    // 计算第一个按钮的X位置（水平居中）
    const totalWidth = buttonWidth * buttonCount + buttonSpacing * (buttonCount - 1);
    const startX = (canvas.width - totalWidth) / 2;
    
    // 渲染每个按钮
    for (let i = 0; i < buttonCount; i++) {
      const button = this.controlButtons[i];
      const buttonX = startX + i * (buttonWidth + buttonSpacing);
      
      // 按钮颜色（旋转按钮特殊颜色）
      const isRotateButton = button.id === 'rotate';
      const buttonColor = isRotateButton ? '#FF9500' : COLORS.secondaryContainer;
      const buttonScale = isRotateButton ? 1.2 : 1.0; // 旋转按钮更大更突出
      const scaledWidth = buttonWidth * buttonScale;
      const scaledHeight = buttonHeight * buttonScale;
      const scaledX = buttonX - (scaledWidth - buttonWidth) / 2;
      const scaledY = buttonY - (scaledHeight - buttonHeight) / 2;
      
      // 更新按钮位置（用于点击检测）- 使用缩放后的坐标和尺寸
      button.x = scaledX;
      button.y = scaledY;
      button.width = scaledWidth;
      button.height = scaledHeight;
      
      // 绘制阴影（使用Canvas阴影属性实现模糊效果）
      ctx.save();
      const shadowColor = isRotateButton ? 'rgba(50, 47, 34, 0.7)' : EFFECTS.shadowColor;
      const shadowOffset = isRotateButton ? 18 : EFFECTS.shadowOffset;
      const shadowBlur = isRotateButton ? 22 : EFFECTS.shadowBlur;
      ctx.shadowColor = shadowColor;
      ctx.shadowOffsetX = shadowOffset;
      ctx.shadowOffsetY = shadowOffset;
      ctx.shadowBlur = shadowBlur;
      ctx.fillStyle = shadowColor;
      drawRoundedRect(ctx, scaledX, scaledY, scaledWidth, scaledHeight, scaledWidth / 2);
      ctx.fill();
      ctx.restore();
      
      // 绘制按钮背景（圆形）
      ctx.fillStyle = buttonColor;
      drawRoundedRect(ctx, scaledX, scaledY, scaledWidth, scaledHeight, scaledWidth / 2);
      ctx.fill();
      
      // 绘制按钮边框
      ctx.strokeStyle = COLORS.onBackground;
      ctx.lineWidth = 4;
      drawRoundedRect(ctx, scaledX, scaledY, scaledWidth, scaledHeight, scaledWidth / 2);
      ctx.stroke();
      
      // 绘制按钮图标（更粗的图标）
      const fontCoff = isRotateButton ? 0.9 : 0.45;
      ctx.font = `bold ${Math.floor(scaledWidth * fontCoff)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // 绘制图标描边（加粗效果）
      ctx.strokeStyle = COLORS.onSecondaryContainer;
      ctx.lineWidth = 3;
      ctx.strokeText(
        button.icon,
        scaledX + scaledWidth / 2,
        scaledY + scaledHeight / 2
      );
      // 绘制图标填充
      ctx.fillStyle = COLORS.onSecondaryContainer;
      ctx.fillText(
        button.icon,
        scaledX + scaledWidth / 2,
        scaledY + scaledHeight / 2
      );
      
      // 移除按钮描述（小字）
    }
  }

  /**
   * 渲染游戏信息（分数、等级、下一个方块等）
   */
  renderGameInfo(x, y) {
    const { ctx } = this;
    
    // 胜利弹窗
    if (this.showVictoryPopup) {
      const adHeight = this.adManager.getAdHeight();
      const canvas = ctx.canvas;
      
      // 半透明覆盖层（只覆盖游戏区域，不覆盖广告区域）
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, adHeight, canvas.width, canvas.height - adHeight);
      
      // 弹窗尺寸和位置
      const popupWidth = canvas.width * 0.7;
      const popupHeight = 250; // 胜利弹窗高度
      const popupX = (canvas.width - popupWidth) / 2;
      const popupY = adHeight + (canvas.height - adHeight - popupHeight) / 2;
      
      // 弹窗背景
      ctx.fillStyle = COLORS.surfaceContainer;
      ctx.fillRect(popupX, popupY, popupWidth, popupHeight);
      
      // 弹窗边框
      ctx.strokeStyle = COLORS.primary;
      ctx.lineWidth = 3;
      ctx.strokeRect(popupX, popupY, popupWidth, popupHeight);
      
      // 弹窗标题：关卡信息
      ctx.fillStyle = COLORS.onSurface;
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`关卡 ${this.level}`, popupX + popupWidth / 2, popupY + 50);
      
      // 随机文案
      ctx.font = 'bold 28px Arial';
      ctx.fillText(this.victoryMessage, popupX + popupWidth / 2, popupY + 110);
      
      // 按钮尺寸
      const buttonWidth = 180;
      const buttonHeight = 50;
      const buttonX = popupX + (popupWidth - buttonWidth) / 2;
      const buttonY = popupY + popupHeight - buttonHeight - 30;
      
      // 按钮背景
      ctx.fillStyle = COLORS.primary;
      ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
      
      // 按钮边框
      ctx.strokeStyle = COLORS.primaryContainer;
      ctx.lineWidth = 2;
      ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
      
      // 按钮文字
      ctx.fillStyle = COLORS.onPrimary;
      ctx.font = 'bold 22px Arial';
      ctx.fillText('下一关', buttonX + buttonWidth / 2, buttonY + buttonHeight / 2 + 3);
      
      // 保存按钮位置
      this.victoryButton.x = buttonX;
      this.victoryButton.y = buttonY;
      this.victoryButton.width = buttonWidth;
      this.victoryButton.height = buttonHeight;
      this.victoryButton.visible = true;
      
      // 隐藏其他弹窗按钮
      this.restartButton.visible = false;
      this.reviveButton.visible = false;
    }
    // 游戏结束弹窗
    else if (this.gameOver) {
      const adHeight = this.adManager.getAdHeight();
      const canvas = ctx.canvas;
      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, adHeight, w, h - adHeight);

      const dw = 260;
      const padding = 24;
      const titleH = 28;
      const textBlockH = 50;
      const btnW = 200;
      const btnH = 44;
      const btnGap = 12;
      const btnCount = this.reviveUsed ? 2 : 3;
      const btnsTotal = btnCount * btnH + (btnCount - 1) * btnGap;
      const dh = padding * 2 + titleH + 14 + textBlockH + 10 + btnsTotal;
      const dx = (w - dw) / 2;
      const dy = adHeight + (h - adHeight - dh) / 2;
      const btnX = dx + (dw - btnW) / 2;
      const btnStartY = dy + padding + titleH + 14 + textBlockH + 10;

      this._gameOverButtons = [];

      ctx.save();
      ctx.translate(dx + dw / 2, dy + dh / 2);
      ctx.rotate(-1 * Math.PI / 180);
      ctx.translate(-(dx + dw / 2), -(dy + dh / 2));
      ctx.fillStyle = '#fffcf5';
      ctx.strokeStyle = '#322f22';
      ctx.lineWidth = 4;
      drawRoundedRect(ctx, dx, dy, dw, dh, 18);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#322f22';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GAME OVER', w / 2, dy + padding + titleH / 2);

      ctx.fillStyle = '#322f22';
      ctx.fillRect(w / 2 - 25, dy + padding + titleH + 6, 50, 2);

      ctx.font = '16px Arial';
      ctx.fillStyle = '#5f5b4d';
      ctx.fillText(`Score: ${this.score}    Best: ${this.highScore}`, w / 2, dy + padding + titleH + 14 + textBlockH / 2);

      const gameOverBtns = this.reviveUsed
        ? [{ id: 'restart', text: 'RESTART' }, { id: 'quit', text: 'QUIT' }]
        : [{ id: 'revive', text: '▶ AD' }, { id: 'restart', text: 'RESTART' }, { id: 'quit', text: 'QUIT' }];

      for (let i = 0; i < gameOverBtns.length; i++) {
        const btn = gameOverBtns[i];
        const btnY = btnStartY + i * (btnH + btnGap);
        this._gameOverButtons.push({ id: btn.id, x: btnX, y: btnY, w: btnW, h: btnH });

        ctx.save();
        ctx.translate(btnX + btnW / 2, btnY + btnH / 2);
        ctx.rotate(-1 * Math.PI / 180);
        ctx.translate(-(btnX + btnW / 2), -(btnY + btnH / 2));

        ctx.fillStyle = '#322f22';
        drawRoundedRect(ctx, btnX + 3, btnY + 3, btnW, btnH, btnH / 2);
        ctx.fill();

        const btnBgColor = btn.id === 'revive' ? '#a3e1ca' : btn.id === 'restart' ? '#fdd1b4' : '#ff8c94';
        ctx.fillStyle = btnBgColor;
        ctx.strokeStyle = '#322f22';
        ctx.lineWidth = 3;
        drawRoundedRect(ctx, btnX, btnY, btnW, btnH, btnH / 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();

        ctx.fillStyle = '#322f22';
        ctx.font = 'bold 15px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(btn.text, btnX + btnW / 2, btnY + btnH / 2);
      }

      this.victoryButton.visible = false;
    } else {
      // 游戏未结束时隐藏所有弹窗按钮
      this.restartButton.visible = false;
      this.reviveButton.visible = false;
      this.victoryButton.visible = false;
    }
  }

  /**
   * 游戏主循环
   */
  gameLoop(timestamp) {
    const deltaTime = timestamp - this.lastTime || 0;
    this.lastTime = timestamp;
    
    this.update(deltaTime);
    this.render();
    
    this.aniId = requestAnimationFrame(this.gameLoop.bind(this));
  }

   /**
    * 进入下一关（网格已在updateLevel中重置，此处只需隐藏弹窗并继续游戏）
    */
   resetForNextLevel() {
     console.log(`进入下一关: 关卡 ${this.level}, 格子=${GRID_SIZES[this.gridSizeIndex].cols}x${GRID_SIZES[this.gridSizeIndex].rows}, 初始层数=${this.initialLayers}`);
     
     // 隐藏胜利弹窗
     this.showVictoryPopup = false;
     this.victoryButton.visible = false;
     
     // 重置其他弹窗按钮状态
     this.restartButton.visible = false;
     this.restartButton.x = 0;
     this.restartButton.y = 0;
     this.restartButton.width = 0;
     this.restartButton.height = 0;
     
     this.reviveButton.visible = false;
     this.reviveButton.x = 0;
     this.reviveButton.y = 0;
     this.reviveButton.width = 0;
     this.reviveButton.height = 0;
     
     // 重置复活状态
     this.reviveUsed = false;
     
     // 注意：广告管理器不会被重置，广告会继续显示
     
     // 停止死亡动画
     this.pengfuAnimation.stop();
     
     // 网格已在updateLevel的resetGridForNewLevel中重置
     // 当前方块和下一个方块已在resetGridForNewLevel中重置
     // 游戏状态已更新，直接继续游戏即可
   }

  /**
   * 重新开始游戏
   */
  restart(savedLevel, savedHighScore) {
    this.grid = new Grid(this.cellSize);
    this.currentBlock = null;
    this.nextBlock = null;
    this.gameOver = false;
    this.paused = false;
    this.score = 0;
    this.level = savedLevel || this.level;
    this.highScore = savedHighScore || this.highScore;
    this.linesCleared = 0;
    this.dropInterval = 1000;
    this.dropCounter = 0;
    this.keys = {};
    
    // 重置按钮状态
    this.restartButton.visible = false;
    this.restartButton.x = 0;
    this.restartButton.y = 0;
    this.restartButton.width = 0;
    this.restartButton.height = 0;
    
    this.reviveButton.visible = false;
    this.reviveButton.x = 0;
    this.reviveButton.y = 0;
    this.reviveButton.width = 0;
    this.reviveButton.height = 0;
    
    // 重置复活状态
    this.reviveUsed = false;
    
    // 重置胜利弹窗状态
    this.showVictoryPopup = false;
    this.victoryMessage = '';
    this.victoryButton.visible = false;
    this.victoryButton.x = 0;
    this.victoryButton.y = 0;
    this.victoryButton.width = 0;
    this.victoryButton.height = 0;
    
    // 注意：广告管理器不会被重置，广告会继续显示
    
    // 停止死亡动画
    this.pengfuAnimation.stop();
    
    if (this.musicManager) {
      this.musicManager.playRandom();
    }

    this.createNewBlock();
  }

  /**
   * 通过观看广告复活
   */
  reviveByAd() {
    console.log('尝试通过广告复活...');
    
    // 显示激励视频广告
    this.adManager.showRewardedAd(
      // 广告观看成功回调
      () => {
        console.log('广告观看成功，执行复活逻辑');
        
        // 清除底部4行方块（提供更多空间）
        const blocksCleared = this.grid.clearBottomRows(4);
        console.log(`清除了 ${blocksCleared} 个方块`);
        
        // 重置游戏状态
        this.gameOver = false;
        this.reviveUsed = true;
        
        // 隐藏弹窗按钮
        this.restartButton.visible = false;
        this.reviveButton.visible = false;
        
        // 重新创建当前方块（使用现有的下一个方块）
        this.currentBlock = this.nextBlock;
        if (this.currentBlock) {
      this.currentBlock.setPosition(Math.floor(this.grid.cols / 2) - 2, 0);
        }
        
        // 生成新的下一个方块
        this.nextBlock = new Tetromino(Tetromino.randomType());
        
        // 检查新方块是否可以放置
        if (this.currentBlock && !this.grid.isValidShapePosition(
          this.currentBlock.getShape(),
          this.currentBlock.x,
          this.currentBlock.y
        )) {
          // 如果仍然无法放置，尝试清除更多行（最多再清除3行）
          for (let i = 0; i < 3; i++) {
            this.grid.clearBottomRows(1);
            if (this.grid.isValidShapePosition(
              this.currentBlock.getShape(),
              this.currentBlock.x,
              this.currentBlock.y
            )) {
              break;
            }
          }
        }
        
        // 如果最终仍然无法放置，则游戏结束
        if (this.currentBlock && !this.grid.isValidShapePosition(
          this.currentBlock.getShape(),
          this.currentBlock.x,
          this.currentBlock.y
        )) {
          console.log('复活失败，网格已满');
          this.gameOver = true;
          this.restartButton.visible = true;
          this.reviveButton.visible = true;
        } else {
          console.log('复活成功，游戏继续');
          // 停止死亡动画
          this.pengfuAnimation.stop();
        }
      },
      // 广告观看失败回调
      (error) => {
        console.log('广告观看失败，无法复活:', error);
        // 可以在这里给用户提示
      }
    );
  }

  /**
   * 销毁游戏资源
   */
  destroy() {
    // 销毁广告资源
    this.adManager.destroy();
    
    // 停止死亡动画
    this.pengfuAnimation.stop();
    
    // 停止背景音乐
    if (this.musicManager) {
      this.musicManager.stop();
    }

    // 取消动画帧
    cancelAnimationFrame(this.aniId);
  }
}

// 将分数配置暴露给全局作用域，便于调试
if (typeof GameGlobal !== 'undefined') {
  GameGlobal.SCORE_CONFIG = SCORE_CONFIG;
}