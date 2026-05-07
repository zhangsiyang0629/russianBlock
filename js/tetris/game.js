const isDebugMode = false;

import Grid from './grid.js';
import Tetromino from './block.js';
import AdManager from './ad.js';
import FailLaughAnimation from './failLaughAnim.js';
import { saveOnLevelComplete, saveOnGameOver } from './playerData.js';
import { drawRoundedRect } from './utils.js';
import { EventScheduler, EVENT_CONFUSION, EVENT_INK, registerEvent, getEventHandler } from './events.js';
import Effects from './effects.js';

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
    this.settingsBtn = { x: 0, y: 0, width: 0, height: 0 };
    this.showingGameSettings = false;
    this.gameSettings = { musicOn: true, musicVolume: 0.5, sfxOn: true, sfxVolume: 0.5 };
    this._gameSettingsHitAreas = {};
    this.loadGameSettings();
    this._gameOverButtons = [];

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

    this.victoryQuitButton = {
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
    this.failLaughAnim = new FailLaughAnimation();

    // 事件系统
    this.eventScheduler = new EventScheduler(this.level);
    this.nextBlockConfused = false;
    this.victoryEffects = new Effects();
    this.smokeImage = null;
    this.smokeParticles = [];
    if (typeof wx !== 'undefined' && wx.createImage) {
      const img = wx.createImage();
      img.onload = () => { this.smokeImage = img; };
      img.src = 'subpackages/images/smoke.png';
    }
    if (!getEventHandler(EVENT_CONFUSION)) {
      registerEvent(EVENT_CONFUSION, () => { this.nextBlockConfused = true; });
    }

    this.inkPhase = 'idle';
    this.inkTimer = 0;
    this.inkScale = 0;
    this.inkAlpha = 1;
    this.inkEnterMs = 700;
    this.inkHoldMs = 5000;
    this.inkExitMs = 2500;
    this.inkImage = null;
    if (typeof wx !== 'undefined' && wx.createImage) {
      const img = wx.createImage();
      img.onload = () => { this.inkImage = img; };
      img.src = 'subpackages/images/ink.png';
    }
    if (!getEventHandler(EVENT_INK)) {
      registerEvent(EVENT_INK, () => {
        this.inkPhase = 'entering';
        this.inkTimer = 0;
        this.inkScale = 0;
        this.inkAlpha = 1;
      });
    }

    // 初始化
    this.init();
  }

  init() {
    this.createNewBlock();
  }

  loadGameSettings() {
    try {
      const saved = wx.getStorageSync('coverSettings');
      if (saved) {
        if (typeof saved.musicOn === 'boolean') this.gameSettings.musicOn = saved.musicOn;
        if (typeof saved.musicVolume === 'number') this.gameSettings.musicVolume = saved.musicVolume;
        if (typeof saved.sfxOn === 'boolean') this.gameSettings.sfxOn = saved.sfxOn;
        if (typeof saved.sfxVolume === 'number') this.gameSettings.sfxVolume = saved.sfxVolume;
      }
    } catch (e) {}
  }

  saveGameSettings() {
    try { wx.setStorageSync('coverSettings', this.gameSettings); } catch (e) {}
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
    } else {
      this.currentBlock = new Tetromino(Tetromino.randomType());
    }
    const shapeW = this.currentBlock.getShape()[0].length;
    const maxX = Math.max(0, this.grid.cols - shapeW);
    this.currentBlock.setPosition(Math.floor(Math.random() * (maxX + 1)), 0);

    this.currentBlock.confused = this.nextBlockConfused;
    this.nextBlockConfused = false;

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
      const frameSize = this.failLaughAnim.getFirstFrameSize();
      const frameWidth = frameSize ? frameSize.width : 432; // 默认值
      const frameHeight = frameSize ? frameSize.height : 576; // 默认值

      const scale = targetWidth / frameWidth;
      const scaledWidth = frameWidth * scale;
      const scaledHeight = frameHeight * scale;
      const x = canvas.width - scaledWidth / 2 - 10;
      const y = canvas.height - this.bottomHeight - scaledHeight * 3.4 / 10;
      this.failLaughAnim.play(x, y, scale, false);
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

    // 设置按钮（分数区域下方，与暂停按钮样式一致）
    const setBtnW = scoreCardWidth;
    const setBtnH = Math.floor(scoreCardHeight / 2);
    const setBtnX = scoreCardX;
    const setBtnY = scoreCardY + scoreCardHeight + 22;
    this.settingsBtn = { x: setBtnX, y: setBtnY, width: setBtnW, height: setBtnH };
    ctx.save();
    ctx.translate(setBtnX + setBtnW / 2, setBtnY + setBtnH / 2);
    ctx.rotate(-2 * Math.PI / 180);
    ctx.translate(-setBtnW / 2, -setBtnH / 2);
    ctx.fillStyle = COLORS.onBackground;
    ctx.fillRect(4, 4, setBtnW, setBtnH);
    ctx.fillStyle = '#eae2cb';
    ctx.fillRect(0, 0, setBtnW, setBtnH);
    ctx.strokeStyle = COLORS.onBackground;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, setBtnW, setBtnH);
    ctx.fillStyle = COLORS.onSurface;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚙', setBtnW / 2, setBtnH / 2);
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

    if (this.showVictoryPopup) {
      let hit = false;
      if (this.victoryButton.width > 0 && x >= this.victoryButton.x && x <= this.victoryButton.x + this.victoryButton.width && y >= this.victoryButton.y && y <= this.victoryButton.y + this.victoryButton.height) {
        this.showVictoryPopup = false;
        this.victoryButton.visible = false;
        this.victoryQuitButton.visible = false;
        this.resetForNextLevel();
        return;
      }
      if (this.victoryQuitButton.visible && x >= this.victoryQuitButton.x && x <= this.victoryQuitButton.x + this.victoryQuitButton.width && y >= this.victoryQuitButton.y && y <= this.victoryQuitButton.y + this.victoryQuitButton.height) {
        if (this.onQuit) this.onQuit();
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

    if (this.showingGameSettings) {
      const h = this._gameSettingsHitAreas;
      if (h.close && x >= h.close.x && x <= h.close.x + h.close.w && y >= h.close.y && y <= h.close.y + h.close.h) { this.showingGameSettings = false; this._gameSettingsHitAreas = {}; return; }
      if (h.backBtn && x >= h.backBtn.x && x <= h.backBtn.x + h.backBtn.w && y >= h.backBtn.y && y <= h.backBtn.y + h.backBtn.h) { this.showingGameSettings = false; this._gameSettingsHitAreas = {}; return; }
      if (h.dialog && (x < h.dialog.x || x > h.dialog.x + h.dialog.w || y < h.dialog.y || y > h.dialog.y + h.dialog.h)) { this.showingGameSettings = false; this._gameSettingsHitAreas = {}; return; }
      if (h.musicToggle && x >= h.musicToggle.x && x <= h.musicToggle.x + h.musicToggle.w && y >= h.musicToggle.y && y <= h.musicToggle.y + h.musicToggle.h) {
        this.gameSettings.musicOn = !this.gameSettings.musicOn;
        if (this.musicManager) this.musicManager.setOn(this.gameSettings.musicOn);
        this.saveGameSettings();
        return;
      }
      if (h.musicSlider && x >= h.musicSlider.x && x <= h.musicSlider.x + h.musicSlider.w && y >= h.musicSlider.y && y <= h.musicSlider.y + h.musicSlider.h) {
        const vol = Math.max(0, Math.min(1, (x - h.musicSlider.x) / h.musicSlider.w));
        this.gameSettings.musicVolume = vol;
        if (this.musicManager) this.musicManager.setVolume(vol);
        this.saveGameSettings();
        return;
      }
      if (h.sfxToggle && x >= h.sfxToggle.x && x <= h.sfxToggle.x + h.sfxToggle.w && y >= h.sfxToggle.y && y <= h.sfxToggle.y + h.sfxToggle.h) {
        this.gameSettings.sfxOn = !this.gameSettings.sfxOn;
        this.saveGameSettings();
        return;
      }
      if (h.sfxSlider && x >= h.sfxSlider.x && x <= h.sfxSlider.x + h.sfxSlider.w && y >= h.sfxSlider.y && y <= h.sfxSlider.y + h.sfxSlider.h) {
        const vol = Math.max(0, Math.min(1, (x - h.sfxSlider.x) / h.sfxSlider.w));
        this.gameSettings.sfxVolume = vol;
        this.saveGameSettings();
        return;
      }
      return;
    }

    if (!this.showVictoryPopup) {
      const sb = this.settingsBtn;
      if (x >= sb.x && x <= sb.x + sb.width && y >= sb.y && y <= sb.y + sb.height) {
        this.showingGameSettings = true;
        this._gameSettingsHitAreas = {};
        return;
      }
      const pb = this.pauseButton;
      if (x >= pb.x && x <= pb.x + pb.width && y >= pb.y && y <= pb.y + pb.height) {
        this.paused = !this.paused;
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

    if (dy === 0 && this.currentBlock && this.currentBlock.confused) {
      dx = -dx;
    }

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

    const eventId = this.eventScheduler.onBlockLanded();
    console.log("eventId=", eventId)
    if (eventId) {
      const handler = getEventHandler(eventId);
      if (handler) handler();
    }

    const lines = this.grid.clearLines();
    if (lines > 0) {
      this.linesCleared += lines;
      const points = this.calculateScore(lines);
      this.score += points;
      this.updateLevel();
    }

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
      this.level = this.level + 1;

      // 更新难度配置
      this.updateLevelConfig();
      this.eventScheduler.reset(this.level);

      // 重置网格以适应新关卡
      this.resetGridForNewLevel();

      // 触发胜利弹窗（仅当关卡变化时）
      this.showVictoryPopup = true;
      // 随机选择弹窗文案
      const messages = ['LUCK', 'COOL', 'SO'];
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
    // 更新胜利烟花特效
    if (this.showVictoryPopup) {
      this.victoryEffects.tick(this.ctx.canvas.width, this.ctx.canvas.height);
    }

    // 更新死亡动画（无论游戏状态如何）
    this.failLaughAnim.update(Date.now());

    // 更新广告状态（无论游戏状态如何）
    this.adManager.update(this.lastTime);

    if (this.inkPhase !== 'idle') {
      if ((this.gameOver || this.showVictoryPopup) && this.inkPhase !== 'exiting') {
        this.inkPhase = 'exiting';
        this.inkTimer = 0;
      }
      if (!this.paused) {
        this.inkTimer += deltaTime;
      }
      if (this.inkPhase === 'entering') {
        this.inkScale = Math.min(1, this.inkTimer / this.inkEnterMs);
        if (this.inkTimer >= this.inkEnterMs) {
          this.inkPhase = 'holding';
          this.inkTimer = 0;
          this.inkScale = 1;
        }
      } else if (this.inkPhase === 'holding') {
        if (this.inkTimer >= this.inkHoldMs) {
          this.inkPhase = 'exiting';
          this.inkTimer = 0;
        }
      } else if (this.inkPhase === 'exiting') {
        this.inkAlpha = Math.max(0, 1 - this.inkTimer / this.inkExitMs);
        if (this.inkTimer >= this.inkExitMs) {
          this.inkPhase = 'idle';
        }
      }
    }

    if (this.gameOver || this.paused || this.showVictoryPopup) return;

    this.handleInput();

    if (this.currentBlock && this.currentBlock.confused) {
      const cell = this.grid.cellSize;
      const shape = this.currentBlock.getShape();
      const cx = (this.currentBlock.x + shape[0].length / 2) * cell;
      const cy = (this.currentBlock.y + shape.length / 2) * cell;
      const blockW = shape[0].length * cell;
      const blockH = shape.length * cell;
      const spread = Math.max(blockW, blockH) * 1.2;

      for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
        const p = this.smokeParticles[i];
        p.x += p.vx * deltaTime / 1000;
        p.y += p.vy * deltaTime / 1000;
        p.rotation += p.rotSpeed * deltaTime / 1000;
        p.life -= deltaTime / p.maxLife;
        p.vx += (Math.random() - 0.5) * 20 * deltaTime / 1000;
        p.vy += (Math.random() - 0.5) * 20 * deltaTime / 1000;
        if (p.life <= 0) this.smokeParticles.splice(i, 1);
      }

      if (this.smokeParticles.length < 12) {
        this.smokeParticles.push({
          x: cx + (Math.random() - 0.5) * spread,
          y: cy + (Math.random() - 0.5) * spread,
          vx: (Math.random() - 0.5) * 30,
          vy: -(Math.random() * 20 + 10),
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 2,
          life: 1,
          maxLife: Math.random() * 600 + 400,
          scale: Math.random() * 0.6 + 0.5,
        });
      }
    } else {
      this.smokeParticles = [];
    }

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

    if (this.currentBlock && this.currentBlock.confused && this.smokeImage) {
      const cell = this.grid.cellSize;
      const pSize = cell * 3;
      for (const p of this.smokeParticles) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = Math.max(0, p.life) * 0.55;
        ctx.scale(p.scale, p.scale);
        ctx.drawImage(this.smokeImage, -pSize / 2, -pSize / 2, pSize, pSize);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
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
    this.renderGameInfo(0, 0);

    // 胜利烟花特效
    if (this.showVictoryPopup) {
      this.victoryEffects.renderFireworks(ctx);
      this.victoryEffects.renderClickRipples(ctx);
    }

    // 渲染底部控制按钮
    this.renderControlButtons();

    // 泼墨效果
    if (this.inkPhase !== 'idle' && this.inkImage) {
      const imgAspect = this.inkImage.width / this.inkImage.height;
      let iw, ih;
      const cover = this.inkScale * 1.5;
      if (canvas.width / canvas.height > imgAspect) {
        ih = canvas.height * cover;
        iw = ih * imgAspect;
      } else {
        iw = canvas.width * cover;
        ih = iw / imgAspect;
      }
      ctx.globalAlpha = this.inkAlpha;
      ctx.drawImage(this.inkImage,
        0, 0, this.inkImage.width, this.inkImage.height,
        (canvas.width - iw) / 2, (canvas.height - ih) / 2, iw, ih);
      ctx.globalAlpha = 1;
    }

    // 渲染死亡动画
    this.failLaughAnim.render(ctx);

    if (this.paused) {
      this.renderPauseMenu();
    }

    if (this.showingGameSettings) {
      this.renderGameSettingsDialog();
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

  renderGameSettingsDialog() {
    const ctx = this.ctx;
    const canvas = ctx.canvas;
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, w, h);

    const dw = 260;
    const padding = 28;
    const titleH = 28;
    const contentW = dw - 48;
    const toggleW = 44;
    const toggleH = 24;

    const drawToggle = (tx, ty, on, onColor) => {
      ctx.fillStyle = on ? onColor : '#b2ad9c';
      drawRoundedRect(ctx, tx, ty, toggleW, toggleH, toggleH / 2);
      ctx.fill();
      const knobX = on ? tx + toggleW - 12 - 2 : tx + 2;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(knobX + 10, ty + toggleH / 2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#322f22';
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    const drawSlider = (sx, sy, sw, val, color) => {
      const barH = 6;
      const thumbR = 10;
      ctx.fillStyle = '#eae2cb';
      drawRoundedRect(ctx, sx, sy + 10 - barH / 2, sw, barH, barH / 2);
      ctx.fill();
      ctx.fillStyle = color;
      const fillW = sw * val;
      if (fillW > barH) drawRoundedRect(ctx, sx, sy + 10 - barH / 2, fillW, barH, barH / 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sx + sw * val, sy + 10, thumbR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#322f22';
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    const secH = toggleH + 6 + 20;
    const totalContentH = titleH + 14 + secH * 2 + 44 + 20;
    const dh = padding * 2 + totalContentH;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;
    const sectionX = dx + 24;

    this._gameSettingsHitAreas = {};

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
    ctx.fillText('SETTINGS', w / 2, dy + padding + titleH / 2);

    ctx.fillStyle = '#322f22';
    ctx.fillRect(w / 2 - 25, dy + padding + titleH + 8, 50, 2);

    const closeSize = 30;
    const closeX = dx + dw - closeSize - 8;
    const closeY = dy + 6;
    this._gameSettingsHitAreas.close = { x: closeX, y: closeY, w: closeSize, h: closeSize };
    ctx.save();
    ctx.fillStyle = '#f95630';
    ctx.beginPath();
    ctx.arc(closeX + closeSize / 2, closeY + closeSize / 2, closeSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✕', closeX + closeSize / 2, closeY + closeSize / 2);
    ctx.restore();

    let sectionY = dy + padding + titleH + 14;

    ctx.fillStyle = '#5f5b4d';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('♫ MUSIC', sectionX, sectionY + toggleH / 2);
    const mtX = sectionX + contentW - toggleW;
    this._gameSettingsHitAreas.musicToggle = { x: mtX, y: sectionY, w: toggleW, h: toggleH };
    drawToggle(mtX, sectionY, this.gameSettings.musicOn, '#993d46');
    sectionY += toggleH + 6;
    this._gameSettingsHitAreas.musicSlider = { x: sectionX, y: sectionY, w: contentW, h: 20 };
    drawSlider(sectionX, sectionY, contentW, this.gameSettings.musicVolume, '#993d46');
    sectionY += 20 + 14;

    ctx.fillStyle = '#5f5b4d';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔊 SOUND FX', sectionX, sectionY + toggleH / 2);
    const stX = sectionX + contentW - toggleW;
    this._gameSettingsHitAreas.sfxToggle = { x: stX, y: sectionY, w: toggleW, h: toggleH };
    drawToggle(stX, sectionY, this.gameSettings.sfxOn, '#296654');
    sectionY += toggleH + 6;
    this._gameSettingsHitAreas.sfxSlider = { x: sectionX, y: sectionY, w: contentW, h: 20 };
    drawSlider(sectionX, sectionY, contentW, this.gameSettings.sfxVolume, '#296654');
    sectionY += 20 + 14;

    const btnW = 160;
    const btnH = 40;
    const btnX = (w - btnW) / 2;
    this._gameSettingsHitAreas.backBtn = { x: btnX, y: sectionY, w: btnW, h: btnH };
    ctx.save();
    ctx.translate(btnX + btnW / 2, sectionY + btnH / 2);
    ctx.rotate(-1 * Math.PI / 180);
    ctx.translate(-(btnX + btnW / 2), -(sectionY + btnH / 2));
    ctx.fillStyle = '#322f22';
    drawRoundedRect(ctx, btnX + 3, sectionY + 3, btnW, btnH, btnH / 2);
    ctx.fill();
    ctx.fillStyle = '#fdd1b4';
    ctx.strokeStyle = '#322f22';
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, btnX, sectionY, btnW, btnH, btnH / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#322f22';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BACK', btnX + btnW / 2, sectionY + btnH / 2);
    ctx.restore();

    this._gameSettingsHitAreas.dialog = { x: dx, y: dy, w: dw, h: dh };
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

    if (this.showVictoryPopup) {
      const adHeight = this.adManager.getAdHeight();
      const canvas = ctx.canvas;
      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, adHeight, w, h - adHeight);

      const dw = 260;
      const padding = 28;
      const titleH = 28;
      const msgH = 26;
      const btnW = 180;
      const btnH = 44;
      const btnGap = 12;
      const dh = padding * 2 + titleH + 16 + msgH + 20 + btnH * 2 + btnGap;
      const dx = (w - dw) / 2;
      const dy = adHeight + (h - adHeight - dh) / 2;

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
      ctx.fillText(`LEVEL ${this.level}`, w / 2, dy + padding + titleH / 2);

      ctx.fillStyle = '#322f22';
      ctx.fillRect(w / 2 - 25, dy + padding + titleH + 6, 50, 2);

      ctx.font = '20px Arial';
      ctx.fillStyle = '#5f5b4d';
      ctx.fillText(this.victoryMessage, w / 2, dy + padding + titleH + 16 + msgH / 2);

      const btnX = dx + (dw - btnW) / 2;
      const nextBtnY = dy + padding + titleH + 16 + msgH + 20;
      const quitBtnY = nextBtnY + btnH + btnGap;

      const drawVictoryBtn = (y, text, color) => {
        ctx.save();
        ctx.translate(btnX + btnW / 2, y + btnH / 2);
        ctx.rotate(-1 * Math.PI / 180);
        ctx.translate(-(btnX + btnW / 2), -(y + btnH / 2));
        ctx.fillStyle = '#322f22';
        drawRoundedRect(ctx, btnX + 3, y + 3, btnW, btnH, btnH / 2);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.strokeStyle = '#322f22';
        ctx.lineWidth = 3;
        drawRoundedRect(ctx, btnX, y, btnW, btnH, btnH / 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#322f22';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, btnX + btnW / 2, y + btnH / 2);
        ctx.restore();
      };

      drawVictoryBtn(nextBtnY, 'NEXT', '#fdd1b4');
      drawVictoryBtn(quitBtnY, 'QUIT', '#ff8c94');

      this.victoryButton.x = btnX;
      this.victoryButton.y = nextBtnY;
      this.victoryButton.width = btnW;
      this.victoryButton.height = btnH;
      this.victoryButton.visible = true;

      this.victoryQuitButton.x = btnX;
      this.victoryQuitButton.y = quitBtnY;
      this.victoryQuitButton.width = btnW;
      this.victoryQuitButton.height = btnH;
      this.victoryQuitButton.visible = true;
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
      this.victoryQuitButton.visible = false;
    } else {
      this.victoryButton.visible = false;
      this.victoryQuitButton.visible = false;
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
    this.victoryQuitButton.visible = false;
    this.victoryEffects.clear();

    // 分数清零，新关卡从0开始
    this.score = 0;

    // 重置复活状态
    this.reviveUsed = false;

    // 注意：广告管理器不会被重置，广告会继续显示

    // 停止死亡动画
    this.failLaughAnim.stop();

    // 网格已在updateLevel的resetGridForNewLevel中重置
    // 当前方块和下一个方块已在resetGridForNewLevel中重置
    // 游戏状态已更新，直接继续游戏即可
  }

  /**
   * 重新开始游戏
   */
  restart(savedLevel, savedHighScore) {
    this.level = savedLevel || this.level;
    this.updateLevelConfig();
    this.eventScheduler.reset(this.level);
    this.nextBlockConfused = false;
    this.smokeParticles = [];
    this.inkPhase = 'idle';
    this.currentBlock = null;
    this.nextBlock = null;
    this.gameOver = false;
    this.paused = false;
    this.score = 0;
    this.highScore = savedHighScore || this.highScore;
    this.linesCleared = 0;
    this.dropInterval = 1000;
    this.dropCounter = 0;
    this.keys = {};

    this.reviveUsed = false;
    this.showVictoryPopup = false;
    this.victoryEffects.clear();
    this.victoryMessage = '';
    this.victoryButton.visible = false;
    this.victoryButton.x = 0;
    this.victoryButton.y = 0;
    this.victoryButton.width = 0;
    this.victoryButton.height = 0;
    this.victoryQuitButton.visible = false;
    this.victoryQuitButton.x = 0;
    this.victoryQuitButton.y = 0;
    this.victoryQuitButton.width = 0;
    this.victoryQuitButton.height = 0;

    this.failLaughAnim.stop();

    this.resetGridForNewLevel();

    if (this.musicManager) {
      this.musicManager.playRandom();
    }
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
        } else {
          console.log('复活成功，游戏继续');
          // 停止死亡动画
          this.failLaughAnim.stop();
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
    this.failLaughAnim.stop();

    // 停止背景音乐
    if (this.musicManager) {
      this.musicManager.stop();
    }

    // 取消动画帧
    cancelAnimationFrame(this.aniId);
  }
}

// 将分数配置暴露给全局作用域，便于调试
if (typeof GameGlobal !== 'undefined' && isDebugMode) {
  GameGlobal.SCORE_CONFIG = SCORE_CONFIG;
}