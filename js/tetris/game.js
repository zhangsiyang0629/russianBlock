const isDebugMode = false;

import Grid from './grid.js';
import Tetromino from './block.js';
import AdManager from './ad.js';
import FailLaughAnimation from './failLaughAnim.js';
import { saveOnLevelComplete, saveOnGameOver } from './playerData.js';
import { drawRoundedRect } from './utils.js';
import { EventScheduler, EVENT_CONFUSION, EVENT_INK, EVENT_BOOM, registerEvent, getEventHandler } from './events.js';
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
  lineClearPoints: [0, 10, 25, 50, 80],
  levelUpThreshold: 150,
};

// 关卡通关分数配置，未配置的关卡默认 levelUpThreshold
const LEVEL_UP_SCORES = {
  1: 100,
  2: 100,
  3: 100,
  4: 100,
  5: 100,
  6: 100,
  7: 100,
  8: 90,
};

// 无尽模式速度配置
const INFINITE_SPEED_LEVELS = [
  { score: 0, speed: 1.0 },
  { score: 300, speed: 1.1 },
  { score: 800, speed: 1.2 },
  { score: 1500, speed: 1.3 },
  { score: 2500, speed: 1.4 },
  { score: 4000, speed: 1.5 },
  { score: 6000, speed: 1.6 },
];

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
  constructor(ctx, savedLevel = 1, savedHighScore = 0, musicManager = null, gameMode = 'level') {
    this.ctx = ctx;
    const canvas = ctx.canvas;

    this.musicManager = musicManager;
    this.gameMode = gameMode;
    if (this.musicManager) {
      this.musicManager.setMode(gameMode);
    }

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
    this.level = savedLevel;
    this.highScore = savedHighScore;
    this.linesCleared = 0;

    let gridCols, gridRows;
    if (this.gameMode === 'infinite') {
      this.infiniteSpeedIdx = 0;
      gridCols = 15;
      gridRows = 23;
    } else {
      this.updateLevelConfig();
      const gridSize = GRID_SIZES[this.gridSizeIndex];
      gridCols = gridSize.cols;
      gridRows = gridSize.rows;
    }

    const maxCellSizeByWidth = Math.floor(this.availableWidth / gridCols);
    const maxCellSizeByHeight = Math.floor(this.availableHeight / gridRows);
    const cellSize = Math.min(maxCellSizeByWidth, maxCellSizeByHeight, 30);
    const safeCellSize = Math.max(8, cellSize);

    console.log(`布局计算: 屏幕=${canvas.width}x${canvas.height}, 网格尺寸=${gridCols}x${gridRows}, cellSize=${safeCellSize}`);

    this.cellSize = safeCellSize;
    this.grid = new Grid(safeCellSize, gridCols, gridRows);
    this.currentBlock = null;
    this.nextBlock = null;
    this.speedUpText = { active: false, timer: 0, alpha: 0, scale: 0.8 };
    this._skipTalk = false;
    this._talkPrevGrid = undefined;
    this._talkPrevSpeed = undefined;

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
    this.touchKeys = {};

    // 暂停按钮
    this.pauseButton = { x: 0, y: 0, width: 0, height: 0 };
    this.gameSettings = { musicOn: true, musicVolume: 0.5, sfxOn: true, sfxVolume: 0.5 };
    this.loadGameSettings();
    this._gameOverButtons = [];

    // 复活状态
    this.reviveUsed = false; // 是否已使用过复活
    this._adLoading = false;
    this._adError = '';

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
    this.victoryShareButton = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      visible: false
    };

    this.gameState = 'playing';
    this.winRow = 0;
    this.winTimer = 0;
    this.winPanelScale = 0;
    this.winPanelTimer = 0;

    this.scoreFloats = [];
    this.scoreStars = [];
    this.starImage = null;
    this.shareImage = null;
    this.scoreRoll = { active: false, from: 0, to: 0, timer: 0 };
    if (typeof wx !== 'undefined' && wx.createImage) {
      const s = wx.createImage();
      s.onload = () => { this.starImage = s; };
      s.src = 'subpackages/images/star.png';
      const sh = wx.createImage();
      sh.onload = () => { this.shareImage = sh; };
      sh.src = 'subpackages/images/share.png';
    }

    // 控制按钮状态（左移、加速、变换、右移）
    this.controlButtons = [
      { id: 'left', x: 0, y: 0, width: 0, height: 0, icon: '←', desc: '左移' },
      { id: 'down', x: 0, y: 0, width: 0, height: 0, icon: '↓', desc: '加速' },
      { id: 'rotate', x: 0, y: 0, width: 0, height: 0, icon: '⟳', desc: '变换' },
      { id: 'right', x: 0, y: 0, width: 0, height: 0, icon: '→', desc: '右移' }
    ];

    // 动画实例
    this.failLaughAnim = new FailLaughAnimation();

    this.talkTimer = 0;
    this.talkFrame = 0;
    this.talkImages = [];
    this.talkText = '';
    this.talkColor = '';
    this._talkLoaded = false;
    this.loadTalkAtlases();

    // 事件系统
    this.eventScheduler = new EventScheduler(this.gameMode === 'infinite' ? 0 : this.level);
    this.nextBlockConfused = false;
    this.victoryEffects = new Effects();
    this.smokeImage = null;
    this.smokeParticles = [];
    if (typeof wx !== 'undefined' && wx.createImage) {
      const img = wx.createImage();
      img.onload = () => { this.smokeImage = img; };
      img.src = 'subpackages/images/smoke.png';
    }
    registerEvent(EVENT_CONFUSION, () => { this.nextBlockConfused = true; });

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
      this.inkImage = img;
      img.onload = () => {};
      img.src = 'subpackages/images/ink.png';
    }
    registerEvent(EVENT_INK, () => {
      this.playSfx('audio/ink.mp3');
      const startInk = () => {
        if (!this.inkImage || this.inkImage.width <= 1) return;
        if (this.inkPhase !== 'idle') return;
        this.inkPhase = 'entering';
        this.inkTimer = 0;
        this.inkScale = 0;
        this.inkAlpha = 1;
      };
      startInk();
      setTimeout(startInk, 300);
      setTimeout(startInk, 800);
    });

    // 炸弹事件
    this.bombPhase = 'idle';
    this.bombTimer = 0;
    this.bombGridX = 0;
    this.bombGridY = 0;
    this.bombFallY = 0;
    this.bombFuseFrame = 0;
    this.bombFuseImages = [];
    this.boomImage = null;
    this.bombFallImage = null;
    this.bombShakeOffX = 0;
    this.bombShakeOffY = 0;
    this.bombDebris = [];
    this._bombFuseLoaded = false;
    this._bombBlasted = false;
    if (typeof wx !== 'undefined' && wx.createImage) {
      const img = wx.createImage();
      img.onload = () => { this.boomImage = img; };
      img.src = 'subpackages/images/boom.png';
      const fall = wx.createImage();
      fall.onload = () => { this.bombFallImage = fall; };
      fall.src = 'subpackages/images/bomb.png';
      this.loadBoomFuseAtlases();
    }
    registerEvent(EVENT_BOOM, () => { this.triggerBomb(); });

    // 预绑定游戏循环函数，避免每帧创建新闭包
    this._boundLoop = this.gameLoop.bind(this);

    // 初始化
    this.init();
  }

  shareToGameCircle(title) {
    if (typeof wx === 'undefined') return;
    if (wx.shareAppMessage) {
      wx.shareAppMessage({
        title: title,
        success: () => console.log('分享成功'),
        fail: () => console.log('分享取消'),
      });
    }
  }

  shareAppMessage(title, onSuccess) {
    if (typeof wx === 'undefined') return;
    if (wx.shareAppMessage) {
      wx.shareAppMessage({
        title: title,
        success: () => {
          console.log('分享成功');
          if (onSuccess) onSuccess();
        },
        fail: () => console.log('分享取消或失败'),
      });
    }
  }

  setState(newState) {
    this.gameState = newState;
  }

  init() {
    this.createNewBlock();
  }

  playSfx(src) {
    if (typeof wx === 'undefined' || !wx.createInnerAudioContext) return;
    if (!this.gameSettings.sfxOn) return;
    if (!this._sfxCtx) {
      this._sfxCtx = wx.createInnerAudioContext();
      this._sfxCtx.obeyMuteSwitch = false;
    }
    this._sfxCtx.volume = this.gameSettings.sfxVolume;
    this._sfxCtx.src = src;
    this._sfxCtx.play();
  }

  async loadBoomFuseAtlases() {
    if (typeof wx === 'undefined' || !wx.getFileSystemManager) return;
    if (typeof wx !== 'undefined' && wx.loadSubpackage) {
      try { await new Promise((r, j) => wx.loadSubpackage({ name: 'animation', success: r, fail: j })); } catch (e) { return; }
    }
    let i = 0;
    while (true) {
      try {
        const data = wx.getFileSystemManager().readFileSync(`subpackages/animation/images/boom-${i}.json`, 'utf8');
        JSON.parse(data);
      } catch (e) { break; }
      const img = wx.createImage();
      img.src = `subpackages/animation/images/boom-${i}.png`;
      this.bombFuseImages.push(img);
      i++;
    }
    this._bombFuseLoaded = true;
  }

  async loadTalkAtlases() {
    if (typeof wx === 'undefined' || !wx.getFileSystemManager) return;
    if (typeof wx !== 'undefined' && wx.loadSubpackage) {
      try { await new Promise((r, j) => wx.loadSubpackage({ name: 'animation', success: r, fail: j })); } catch (e) { return; }
    }
    let i = 0;
    while (true) {
      try {
        wx.getFileSystemManager().readFileSync(`subpackages/animation/images/talk-${i}.json`, 'utf8');
      } catch (e) { break; }
      const img = wx.createImage();
      img.src = `subpackages/animation/images/talk-${i}.png`;
      this.talkImages.push(img);
      i++;
    }
    this._talkLoaded = true;
  }

  startTalk(prevLevel, prevGridSizeIdx, prevSpeedIdx) {
    this.setState('talking');
    this.talkTimer = 0;
    this.talkFrame = 0;
    const config = this.gameMode === 'infinite' ? null : this.calculateLevelConfig(this.level);
    const curSpeed = config ? SPEED_RATES[config.speedIndex] : 1;
    const curGrid = config ? GRID_SIZES[config.gridSizeIndex] : { cols: this.grid.cols, rows: this.grid.rows };
    const prevSpeed = prevSpeedIdx !== undefined ? SPEED_RATES[prevSpeedIdx] : 1;
    const prevGrid = prevGridSizeIdx !== undefined ? GRID_SIZES[prevGridSizeIdx] : curGrid;
    if (curSpeed > prevSpeed) {
      this.talkText = '加速啦 !!!';
      this.talkColor = '#FF3333';
    } else if (curGrid.cols > prevGrid.cols || curGrid.rows > prevGrid.rows) {
      this.talkText = '大大大 !!!';
      this.talkColor = '#FF8800';
    } else {
      this.talkText = '祝你好运 !!!';
      this.talkColor = '#33AA33';
    }
  }

  triggerBomb() {
    if (this.bombPhase !== 'idle') return;
    const gridData = this.grid.getGridData();
    let maxRow = -1;
    for (let r = 0; r < this.grid.rows; r++) {
      let hasBlock = false;
      for (let c = 0; c < this.grid.cols; c++) {
        if (gridData[r][c]) { hasBlock = true; break; }
      }
      if (hasBlock) maxRow = r;
    }
    const layers = maxRow + 1;
    console.log("layers:", layers);
    if (layers < 2) return;

    const positions = [];
    for (let r = 0; r <= maxRow; r++) {
      for (let c = 0; c <= this.grid.cols - 2; c++) {
        if (gridData[r][c] || gridData[r][c + 1]) {
          positions.push({ x: c, y: r });
        }
      }
    }
    if (positions.length === 0) return;
    const pos = positions[Math.floor(Math.random() * positions.length)];
    pos.y = Math.max(0, pos.y - 1);

    this.bombGridX = pos.x;
    this.bombGridY = pos.y;
    this.bombPhase = 'fall';
    this.playSfx('audio/bomb.mp3');
    this.bombTimer = 0;
    this.bombFallY = 0;
    this.bombFuseFrame = 0;
    this._bombBlasted = false;
  }

  executeBombBlast() {
    const cx = this.bombGridX + 1;
    const cy = this.bombGridY + 1;
    const gridData = this.grid.getGridData();
    const targets = [];
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const r = cy + dr;
        const c = cx + dc;
        if (r >= 0 && r < this.grid.rows && c >= 0 && c < this.grid.cols) {
          if (gridData[r][c]) targets.push({ r, c });
        }
      }
    }
    if (targets.length === 0) return;
    const destroyCount = Math.min(targets.length, Math.floor(Math.random() * Math.min(21, targets.length)) + 5);
    for (let i = targets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [targets[i], targets[j]] = [targets[j], targets[i]];
    }
    const cell = this.grid.cellSize;
    for (let i = 0; i < destroyCount; i++) {
      const t = targets[i];
      this.grid.setCell(t.r, t.c, 0);
      this.bombDebris.push({
        x: t.c * cell + cell / 2,
        y: t.r * cell + cell / 2,
        vx: (Math.random() - 0.5) * 200,
        vy: -Math.random() * 200 - 100,
        life: 1,
        decay: Math.random() * 0.015 + 0.01,
        size: Math.random() * cell * 0.5 + cell * 0.3,
        color: ['#993d46', '#296654', '#75553e', '#ff8c94', '#b1efd8', '#fdd1b4', '#b02500'][Math.floor(Math.random() * 7)],
      });
    }
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
    } catch (e) { }
  }

  saveGameSettings() {
    try { wx.setStorageSync('coverSettings', this.gameSettings); } catch (e) { }
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
    if (this.aniId) {
      cancelAnimationFrame(this.aniId);
      this.aniId = null;
    }
    this.setupInput();
    if (this.musicManager) {
      this.musicManager.playRandom();
    }
    if (!this._skipTalk) {
      this.startTalk(this.level - 1, undefined, undefined);
    }
    this._skipTalk = false;
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
      this.playSfx('audio/fail.mp3');
      console.log('Game Over!');
      if (this.musicManager) {
        this.musicManager.stop();
      }

      // 更新最高分并保存玩家数据
      if (this.score > this.highScore) {
        this.highScore = this.score;
      }
      saveOnGameOver(this.score, this.highScore, this.gameMode);

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
    ctx.fillText('分数', scoreCardWidth / 2, 5);

    // 分数数字（缩小比例）
    ctx.fillStyle = COLORS.primary;
    ctx.font = 'bold 16px Arial';
    ctx.textBaseline = 'middle';
    if (this.gameMode === 'infinite') {
      const scoreDisplay = this.scoreRoll.active ? Math.round(this.scoreRoll.from + (this.scoreRoll.to - this.scoreRoll.from) * Math.min(1, this.scoreRoll.timer / 400)) : this.score;
      ctx.fillText(scoreDisplay.toString(), scoreCardWidth / 2, scoreCardHeight / 2 + 3);
    } else {
      const thr = LEVEL_UP_SCORES[this.level] !== undefined ? LEVEL_UP_SCORES[this.level] : SCORE_CONFIG.levelUpThreshold;
      ctx.fillText(`${this.score}/${thr}`, scoreCardWidth / 2, scoreCardHeight / 2 + 3);
    }

    // 关卡显示
    ctx.fillStyle = COLORS.onSurfaceVariant;
    ctx.font = 'bold 5px Arial';
    ctx.textBaseline = 'top';
    ctx.fillText(this.gameMode === 'infinite' ? '无尽' : `关卡 ${this.level}`, scoreCardWidth / 2, scoreCardHeight - 8);

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
    if (this.gameMode === 'infinite') {
      ctx.fillText(`历史最高 ${this.highScore}`, scoreCardX + scoreCardWidth / 2, scoreCardY + scoreCardHeight + 5);
      this._scoreCenter = { x: scoreCardX + scoreCardWidth / 2, y: scoreCardY + scoreCardHeight / 2 };
    }
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
    // ctx.fillStyle = COLORS.onSurfaceVariant;
    // ctx.font = 'bold 7px Arial';
    // ctx.textAlign = 'center';
    // ctx.textBaseline = 'top';
    // ctx.fillText('NEXT', nextCardWidth / 2, 5);

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
    ctx.fillText(this.gameMode === 'infinite' ? '无尽' : '关卡', levelCardWidth / 2, 5);

    // 关卡数字（大号显示）
    ctx.fillStyle = COLORS.primary;
    ctx.textBaseline = 'middle';
    if (this.gameMode === 'infinite') {
      ctx.font = 'bold 32px Arial';
      ctx.fillText('∞', levelCardWidth / 2, levelCardHeight / 2 + 2);
    } else {
      ctx.font = 'bold 16px Arial';
      ctx.fillText(this.level.toString(), levelCardWidth / 2, levelCardHeight / 2 + 3);
    }

    // 网格尺寸显示
    const gridSize = GRID_SIZES[this.gridSizeIndex];
    const speedRate = SPEED_RATES[this.speedIndex];
    ctx.fillStyle = COLORS.onSurfaceVariant;
    ctx.font = 'bold 5px Arial';
    ctx.textBaseline = 'top';
    let gridInfo, speedInfo;
    if (this.gameMode === 'infinite') {
      gridInfo = `${this.grid.cols}×${this.grid.rows}`;
      const speedVal = INFINITE_SPEED_LEVELS[this.infiniteSpeedIdx].speed;
      speedInfo = `${speedVal.toFixed(1)}×`;
    } else {
      gridInfo = `${gridSize.cols}×${gridSize.rows}`;
      speedInfo = `${speedRate.toFixed(2)}×`;
    }
    ctx.fillText(gridInfo, levelCardWidth / 2, levelCardHeight - 15);
    ctx.fillText(speedInfo, levelCardWidth / 2, levelCardHeight - 8);

    ctx.restore();
  }

  handleTouchPress(x, y) {
    if (y >= this.ctx.canvas.height - this.bottomHeight) {
      for (const btn of this.controlButtons) {
        if (x >= btn.x && x <= btn.x + btn.width && y >= btn.y && y <= btn.y + btn.height) {
          this.touchKeys[btn.id] = true;
          return;
        }
      }
    }
  }

  handleTouchRelease() {
    this.touchKeys = {};
  }

  /**
   * 设置输入监听
   */
  setupInput() {
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
          } else if (btn.id === 'restart') {
            if (this.onRestart) { this.onRestart(); } else { this.restart(); }
          } else if (btn.id === 'quit') {
            if (this.gameMode === 'infinite' && this.score > 0 && !this.gameOver) {
              saveOnGameOver(this.score, this.highScore);
            }
            if (this.onQuit) this.onQuit();
          } else if (btn.id === 'musicToggle') {
            this.gameSettings.musicOn = !this.gameSettings.musicOn;
            if (this.musicManager) this.musicManager.setOn(this.gameSettings.musicOn);
            this.saveGameSettings();
          } else if (btn.id === 'musicSlider') {
            const vol = Math.max(0, Math.min(1, (x - btn.x) / btn.w));
            this.gameSettings.musicVolume = vol;
            if (this.musicManager) this.musicManager.setVolume(vol);
            this.saveGameSettings();
          } else if (btn.id === 'sfxToggle') {
            this.gameSettings.sfxOn = !this.gameSettings.sfxOn;
            this.saveGameSettings();
          } else if (btn.id === 'sfxSlider') {
            const vol = Math.max(0, Math.min(1, (x - btn.x) / btn.w));
            this.gameSettings.sfxVolume = vol;
            this.saveGameSettings();
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
        this.victoryShareButton.visible = false;
        this.resetForNextLevel();
        return;
      }
      if (this.victoryQuitButton.visible && x >= this.victoryQuitButton.x && x <= this.victoryQuitButton.x + this.victoryQuitButton.width && y >= this.victoryQuitButton.y && y <= this.victoryQuitButton.y + this.victoryQuitButton.height) {
        if (this.onQuit) this.onQuit();
        return;
      }
      if (this.victoryShareButton && this.victoryShareButton.visible && x >= this.victoryShareButton.x && x <= this.victoryShareButton.x + this.victoryShareButton.width && y >= this.victoryShareButton.y && y <= this.victoryShareButton.y + this.victoryShareButton.height) {
        this.shareAppMessage(`我刚刚通关了第${this.level}关，来挑战我吧！`);
        return;
      }
    }

    if (this.gameOver) {
      for (const btn of this._gameOverButtons) {
        if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
          console.log(`点击游戏结束按钮: ${btn.id}`, x, y);
          if (btn.id === 'revive') {
            this.reviveByAd();
          } else if (btn.id === 'shareRevive') {
            this.gameOver = false;
            this.reviveUsed = true;
            const savedScore = this.score;
            const savedHS = this.highScore;
            this.restart(this.level, savedHS);
            this.reviveUsed = true;
            if (this.gameMode === 'infinite') {
              this.score = savedScore;
              this.highScore = Math.max(savedHS, savedScore);
            }
            this.failLaughAnim.stop();
          } else if (btn.id === 'restart') {
            this._adError = '';
            if (this.onRestart) {
              this.onRestart();
            } else {
              this.restart();
            }
          } else if (btn.id === 'quit') {
            this._adError = '';
            if (this.onQuit) this.onQuit();
          }
          return;
        }
      }
      console.log('游戏结束但未点击按钮', x, y);
      return;
    }

    if (!this.showVictoryPopup) {
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
            case 'rotate':
              this.rotateBlock();
              break;
          }
          if (button.id !== 'down' && button.id !== 'left' && button.id !== 'right') {
            this.touchKeys = {};
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
    if (this.touchKeys['left']) {
      if (!this._moveTimer || Date.now() - this._moveTimer > 100) {
        this.moveBlock(-1, 0);
        this._moveTimer = Date.now();
      }
    }
    if (this.touchKeys['right']) {
      if (!this._moveTimer || Date.now() - this._moveTimer > 100) {
        this.moveBlock(1, 0);
        this._moveTimer = Date.now();
      }
    }
    if (this.touchKeys['down']) {
      if (!this._downTimer || Date.now() - this._downTimer > 100) {
        this.moveBlock(0, 1);
        this._downTimer = Date.now();
      }
    }

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

    const lines = this.grid.clearLines();
    if (lines > 0) {
      this.playSfx('audio/blockdown.mp3');
      this.linesCleared += lines;
      const points = this.calculateScore(lines);
      const oldScore = this.score;
      this.score += points;

      const floatColors = ['#999999', '#33CC33', '#3399FF', '#9933FF'];
      const floatSizes = [24, 26, 30, 38];
      const clearedRows = this.grid._lastClearedRows || [];
      const avgRow = clearedRows.length > 0 ? clearedRows.reduce((a, b) => a + b, 0) / clearedRows.length : this.grid.rows * 0.5;
      this.scoreFloats.push({
        text: `+${points}`,
        x: (this._gridOffX || 0) + this.grid.cols * this.grid.cellSize / 2,
        y: (this._gridOffY || 0) + avgRow * this.grid.cellSize,
        color: floatColors[Math.min(lines, 4) - 1],
        size: floatSizes[Math.min(lines, 4) - 1],
        life: 1,
      });
      this._lastFloatOldScore = oldScore;
      this._lastFloatPoints = points;
      if (this.gameMode !== 'infinite' && this.gameState === 'playing') {
        const threshold = LEVEL_UP_SCORES[this.level] !== undefined ? LEVEL_UP_SCORES[this.level] : SCORE_CONFIG.levelUpThreshold;
        if (this.score >= threshold) {
          this.gameState = 'clearing';
          this.winRow = this.findTopBlockRow();
          // console.log(`关卡完成! score=${this.score}, lines=${this.linesCleared}, winRow=${this.winRow}`);
          this.winTimer = 0;
    this.eventScheduler.reset(this.gameMode === 'infinite' ? 0 : this.level);
        }
      }
      if (this.gameState === 'playing') {
        this.gameMode === 'infinite' ? this.updateInfiniteSpeed() : this.updateLevel();
      }
    }

    if (this.gameState === 'playing') {
      const eventId = this.eventScheduler.onBlockLanded();
      if (eventId) {
        const handler = getEventHandler(eventId);
        if (handler) handler();
      }
      this.createNewBlock();
    }
  }

  /**
   * 计算得分
   */
  calculateScore(lines) {
    return SCORE_CONFIG.lineClearPoints[lines];
  }

  updateInfiniteSpeed() {
    let newIdx = 0;
    for (let i = INFINITE_SPEED_LEVELS.length - 1; i >= 0; i--) {
      if (this.score >= INFINITE_SPEED_LEVELS[i].score) { newIdx = i; break; }
    }
    if (newIdx !== this.infiniteSpeedIdx) {
      this.infiniteSpeedIdx = newIdx;
      this.dropInterval = Math.floor(1000 / INFINITE_SPEED_LEVELS[newIdx].speed);
      this.speedUpText.active = true;
      this.speedUpText.timer = 0;
      this.speedUpText.alpha = 0;
      this.speedUpText.scale = 0.8;
    }
  }

  findTopBlockRow() {
    const d = this.grid.getGridData();
    for (let r = 0; r < this.grid.rows; r++)
      for (let c = 0; c < this.grid.cols; c++)
        if (d[r][c]) return r;
    return this.grid.rows;
  }

  /**
   * 更新游戏等级（基于累计得分）
   */
  updateLevel() {
    const threshold = LEVEL_UP_SCORES[this.level] !== undefined ? LEVEL_UP_SCORES[this.level] : SCORE_CONFIG.levelUpThreshold;
    if (this.score >= threshold) {
      const oldLevel = this.level;
      const oldGridIdx = this.gridSizeIndex;
      const oldSpeedIdx = this.speedIndex;
      this.level = this.level + 1;

      this.updateLevelConfig();
      this._talkPrevGrid = oldGridIdx;
      this._talkPrevSpeed = oldSpeedIdx;
      this.eventScheduler.reset(this.level);

      // 重置网格以适应新关卡
      this.resetGridForNewLevel();

      // 切换新音乐（新关卡播放新音乐）
      if (this.musicManager) {
        this.musicManager.playRandom();
      }

      // 触发胜利弹窗（仅当关卡变化时）
      this.playSfx('audio/victor.mp3');
      this.showVictoryPopup = true;
      // 随机选择弹窗文案
      const messages = ['运气好', '酷', '一般般'];
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

    // 更新网格动画状态（始终调用，确保clearAnimation能完成）
    this.grid.updateAnimation();

    // 泼墨效果
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

    if (this.bombPhase !== 'idle' && !this.paused) {
      this.bombTimer += deltaTime;
      if (this.bombPhase === 'fall') {
        const fallMs = 500;
        const t = Math.min(1, this.bombTimer / fallMs);
        this.bombFallY = t;
        if (this.bombTimer >= fallMs) {
          this.bombPhase = 'fuse';
          this.bombTimer = 0;
        }
      } else if (this.bombPhase === 'fuse') {
        const fuseMs = 1000;
        const total = this.bombFuseImages.length || 1;
        this.bombFuseFrame = Math.floor(this.bombTimer / (fuseMs / total));
        if (this.bombTimer >= fuseMs) {
          this.bombPhase = 'expand';
          this.playSfx('audio/boom.mp3');
          this.bombTimer = 0;
        }
      } else if (this.bombPhase === 'expand') {
        if (this.bombTimer >= 500) {
          if (!this._bombBlasted) {
            this._bombBlasted = true;
            this.executeBombBlast();
          }
          this.bombPhase = 'shake';
          this.bombTimer = 0;
        }
      } else if (this.bombPhase === 'shake') {
        this.bombShakeOffX = (Math.random() - 0.5) * 8;
        this.bombShakeOffY = (Math.random() - 0.5) * 8;
        if (this.bombTimer >= 1000) {
          this.bombPhase = 'fade';
          this.bombTimer = 0;
        }
      } else if (this.bombPhase === 'fade') {
        if (this.bombTimer >= 1000) {
          this.bombPhase = 'idle';
        }
      }
    }

    for (let i = this.bombDebris.length - 1; i >= 0; i--) {
      const d = this.bombDebris[i];
      d.x += d.vx * deltaTime / 1000;
      d.y += d.vy * deltaTime / 1000;
      d.vy += 400 * deltaTime / 1000;
      d.life -= d.decay;
      if (d.life <= 0) this.bombDebris.splice(i, 1);
    }

    for (let i = this.scoreFloats.length - 1; i >= 0; i--) {
      const f = this.scoreFloats[i];
      f.y -= 50 * deltaTime / 1000;
      f.life -= deltaTime / 1000;
      if (f.life <= 0.35 && !f._starSpawned) {
        f._starSpawned = true;
        for (let j = 0; j < 6; j++) {
          this.scoreStars.push({
            x: f.x + (Math.random() - 0.5) * 40,
            y: f.y + (Math.random() - 0.5) * 40,
            phase: 'twinkle', timer: 0,
            delay: j * 80,
          });
        }
      }
      if (f.life <= 0) this.scoreFloats.splice(i, 1);
    }

    let anyStarArrived = false;
    for (let i = this.scoreStars.length - 1; i >= 0; i--) {
      const s = this.scoreStars[i];
      if (s.delay > 0) { s.delay -= deltaTime; continue; }
      s.timer += deltaTime;
      if (s.phase === 'twinkle' && s.timer >= 500) { s.phase = 'fly'; s.timer = 0; }
      if (s.phase === 'fly') {
        const t = this._scoreCenter || { x: 15, y: 60 };
        s.x += (t.x - s.x) * 0.05;
        s.y += (t.y - s.y) * 0.05;
        if (s.timer >= 650) {
          this.scoreStars.splice(i, 1);
          anyStarArrived = true;
        }
      }
    }
    if (anyStarArrived && this.scoreStars.length === 0) {
      this.scoreRoll.active = true;
      this.scoreRoll.from = this._lastFloatOldScore || 0;
      this.scoreRoll.to = this.score;
      this.scoreRoll.timer = 0;
    }

    if (this.scoreRoll.active) {
      this.scoreRoll.timer += deltaTime;
      if (this.scoreRoll.timer >= 400) { this.scoreRoll.active = false; }
    }

    if (this.speedUpText.active) {
      this.speedUpText.timer += deltaTime;
      if (this.speedUpText.timer < 300) {
        this.speedUpText.alpha = this.speedUpText.timer / 300;
        this.speedUpText.scale = 0.8 + 0.2 * (this.speedUpText.timer / 300);
      } else if (this.speedUpText.timer < 1300) {
        this.speedUpText.alpha = 1;
        this.speedUpText.scale = 1;
      } else if (this.speedUpText.timer < 1600) {
        this.speedUpText.alpha = 1 - (this.speedUpText.timer - 1300) / 300;
      } else {
        this.speedUpText.active = false;
      }
    }

    if (this.gameState === 'talking') {
      if (this.paused) return;
      this.talkTimer += deltaTime;
      if (this.talkTimer < 3000) {
        this.talkFrame = Math.floor(this.talkTimer / (3000 / Math.max(1, this.talkImages.length))) % Math.max(1, this.talkImages.length);
      } else if (this.talkTimer < 3500) {
        // fading phase
      } else {
        this.setState('playing');
      }
      return;
    }

    if (this.gameState === 'clearing') {
      if (this.winRow > this.grid.rows || (this.winRow === this.findTopBlockRow() && this.winTimer === 0 && this.grid.clearAnimation.active)) {
        // waiting for clearLines animation from lockBlock to finish
        if (!this.grid.clearAnimation.active) { this.winTimer = 0; }
        return;
      }
      if (!this.grid.clearAnimation.active && !this.paused) {
        this.winTimer += deltaTime;
        if (this.winTimer >= 300) {
          this.winTimer = 0;
          const row = this.winRow;
          if (row < this.grid.rows) {
            let has = false;
            for (let c = 0; c < this.grid.cols; c++) {
              if (this.grid.getGridData()[row][c]) has = true;
            }
            if (has) {
              this.grid.startClearAnimation([row]);
              this.playSfx('audio/blockdown.mp3');
            }
            for (let c = 0; c < this.grid.cols; c++) {
              this.grid.setCell(row, c, 0);
            }
            this.winRow = row + 1;
          }
          if (row >= this.grid.rows) {
            this.setState('panel');
            this.winPanelTimer = 0;
            this.winPanelScale = 0.2;
            this.playSfx('audio/victor.mp3');
            this.showVictoryPopup = true;
            this.victoryMessage = ['运气好', '酷', '一般般'][Math.floor(Math.random() * 3)];
            this.victoryEffects.clear();
            const oldGrid = this.gridSizeIndex;
            const oldSpeed = this.speedIndex;
            this.level = this.level + 1;
            this.updateLevelConfig();
            this.eventScheduler.reset(this.gameMode === 'infinite' ? 0 : this.level);
            this.resetGridForNewLevel();
            if (this.musicManager) {
              this.musicManager.playRandom();
            }
            this.score = 0;
            this._talkPrevGrid = oldGrid;
            this._talkPrevSpeed = oldSpeed;
            saveOnLevelComplete(this.level, 0, this.highScore);
          }
        }
      }
      return;
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
    this._gridOffX = offsetX;

    if (gridHeight <= availableSpace) {
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

    this._gridOffY = offsetY;

    ctx.save();
    ctx.translate(offsetX, offsetY);

    // 渲染网格
    this.grid.render(ctx, this.gameState);

    // 渲染当前方块
    if (this.currentBlock && this.gameState !== 'clearing') {
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

    if (this.bombPhase !== 'idle') {
      const cell = this.grid.cellSize;
      const bx = this.bombGridX * cell;
      const bTargetY = this.bombGridY * cell;
      const by = this.bombPhase === 'fall' ? -cell * 2 + bTargetY * this.bombFallY : bTargetY;
      const bw = cell * 2;
      const bh = cell * 2;

      if (this.bombPhase === 'fall' && this.bombFallImage) {
        const fallSize = Math.max(cell * 3, 30);
        ctx.drawImage(this.bombFallImage, 0, 0, this.bombFallImage.width, this.bombFallImage.height,
          bx + (bw - fallSize) / 2, by + (bh - fallSize) / 2, fallSize, fallSize);
      }

      if (this.bombPhase === 'fuse' && this._bombFuseLoaded) {
        const img = this.bombFuseImages[this.bombFuseFrame % this.bombFuseImages.length];
        if (img) {
          ctx.drawImage(img, 0, 0, img.width, img.height, bx - bw * 0.3, by - bh * 0.3, bw * 1.6, bh * 1.6);
        }
      }

      const boomSize = Math.max(this.ctx.canvas.width, this.ctx.canvas.height) / 3;

      if (this.bombPhase === 'expand' && this.boomImage) {
        const t = Math.min(1, this.bombTimer / 500);
        const scale = 0.1 + t * 0.9;
        const s = boomSize * scale;
        ctx.drawImage(this.boomImage, 0, 0, this.boomImage.width, this.boomImage.height,
          bx + (bw - s) / 2, by + (bh - s) / 2, s, s);
      }

      if ((this.bombPhase === 'shake' || this.bombPhase === 'fade') && this.boomImage) {
        const alpha = this.bombPhase === 'fade' ? Math.max(0, 1 - this.bombTimer / 1000) : 1;
        ctx.globalAlpha = alpha;
        ctx.drawImage(this.boomImage, 0, 0, this.boomImage.width, this.boomImage.height,
          bx + (bw - boomSize) / 2 + this.bombShakeOffX,
          by + (bh - boomSize) / 2 + this.bombShakeOffY,
          boomSize, boomSize);
        ctx.globalAlpha = 1;
      }

      for (const d of this.bombDebris) {
        ctx.globalAlpha = Math.max(0, d.life);
        ctx.fillStyle = d.color;
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.life * 10);
        ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size);
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
    if (this.inkPhase !== 'idle' && this.inkImage && this.inkImage.width > 1) {
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

    // 渲染说话动画
    if (this.gameState === 'talking' && this.talkImages.length > 0) {
      const alpha = this.talkTimer >= 3000 ? Math.max(0, 1 - (this.talkTimer - 3000) / 500) : 1;
      ctx.globalAlpha = alpha;

      const cell = this.grid.cellSize;
      const ch = cell * 8;
      const cw = ch * (144 / 256);
      const img = this.talkImages[this.talkFrame % this.talkImages.length];
      if (img) {
        ctx.drawImage(img, 0, 0, img.width, img.height, offsetX + 6, offsetY + gridHeight - ch - 4, cw, ch);
      }

      const bubbleX = offsetX + 76;
      const bubbleY = offsetY + gridHeight - ch - 4 - 30;
      ctx.font = 'bold 22px Arial';
      const tw = ctx.measureText(this.talkText).width;
      const padX = 20;
      const bw = Math.min((tw + padX * 2) * 0.9, gridWidth * 0.7);
      const bh = 50;
      const bx = Math.min(bubbleX, offsetX + gridWidth - bw - 6);
      const by = Math.max(bubbleY, offsetY);

      const rx = bw / 2;
      const ry = bh / 2;
      const ecx = bx + rx;
      const ecy = by + ry;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#322f22';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(ecx, ecy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = this.talkColor;
      ctx.font = 'bold 22px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.talkText, bx + bw / 2, by + bh / 2);

      ctx.globalAlpha = 1;
    }

    for (const f of this.scoreFloats) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.font = `bold ${f.size}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#322f22';
      ctx.lineWidth = 3;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    for (const s of this.scoreStars) {
      if (this.starImage) {
        ctx.save();
        const twinkle = 0.6 + 0.4 * Math.abs(Math.sin(s.timer * 0.008 * Math.PI));
        const sc = s.phase === 'twinkle' ? twinkle : 1;
        ctx.globalAlpha = s.phase === 'twinkle' ? twinkle : Math.max(0, 1 - s.timer / 600);
        const ss = 48 * sc;
        ctx.drawImage(this.starImage, 0, 0, this.starImage.width, this.starImage.height,
          s.x - ss / 2, s.y - ss / 2, ss, ss);
        ctx.restore();
      }
    }

    // 渲染死亡动画
    this.failLaughAnim.render(ctx);

    if (this.paused) {
      this.renderPauseMenu();
    }

    if (this.speedUpText.active) {
      ctx.globalAlpha = this.speedUpText.alpha;
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 3);
      ctx.scale(this.speedUpText.scale, this.speedUpText.scale);
      ctx.fillStyle = '#FFD700';
      ctx.strokeStyle = '#322f22';
      ctx.lineWidth = 4;
      ctx.font = 'bold 44px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText('加速啦 !!!', 0, 0);
      ctx.fillText('加速啦 !!!', 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
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

    const dw = 280;
    const padding = 24;
    const titleH = 26;
    const secH = 44;
    const btnW = 210;
    const btnH = 46;
    const btnGap = 12;
    const secGap = 10;
    const btnsTotal = btnH * 3 + btnGap * 2;
    const contentH = titleH + 8 + secH * 2 + secGap + 12 + btnsTotal;
    const dh = padding * 2 + contentH;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;
    const sectionX = dx + 16;
    const contentW = dw - 32;

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
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', w / 2, dy + padding + titleH / 2);

    ctx.fillStyle = '#322f22';
    ctx.fillRect(w / 2 - 25, dy + padding + titleH + 5, 50, 2);

    let sy = dy + padding + titleH + 14;
    const toggleW = 40;
    const toggleH = 22;

    const drawToggle = (tx, ty, on, onColor) => {
      ctx.fillStyle = on ? onColor : '#b2ad9c';
      drawRoundedRect(ctx, tx, ty, toggleW, toggleH, toggleH / 2);
      ctx.fill();
      const knobX = on ? tx + toggleW - 10 - 2 : tx + 2;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(knobX + 9, ty + toggleH / 2, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#322f22';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    const drawSlider = (sx, sy, sw, val, color) => {
      const barH = 5;
      const thumbR = 8;
      ctx.fillStyle = '#eae2cb';
      drawRoundedRect(ctx, sx, sy + 9 - barH / 2, sw, barH, barH / 2);
      ctx.fill();
      ctx.fillStyle = color;
      const fillW = sw * val;
      if (fillW > barH) {
        drawRoundedRect(ctx, sx, sy + 9 - barH / 2, fillW, barH, barH / 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(sx + sw * val, sy + 9, thumbR, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#322f22';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    this._pauseMenuButtons = [];

    ctx.fillStyle = '#5f5b4d';
    ctx.font = '13px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('♫ 音乐', sectionX, sy + toggleH / 2);
    const mtX = sectionX + contentW - toggleW;
    this._pauseMenuButtons.push({ id: 'musicToggle', x: mtX, y: sy, w: toggleW, h: toggleH });
    drawToggle(mtX, sy, this.gameSettings.musicOn, '#993d46');
    sy += toggleH + 2;
    this._pauseMenuButtons.push({ id: 'musicSlider', x: sectionX, y: sy, w: contentW, h: 18 });
    drawSlider(sectionX, sy, contentW, this.gameSettings.musicVolume, '#993d46');
    sy += 18 + secGap;

    ctx.fillStyle = '#5f5b4d';
    ctx.font = '13px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔊 音效', sectionX, sy + toggleH / 2);
    const stX = sectionX + contentW - toggleW;
    this._pauseMenuButtons.push({ id: 'sfxToggle', x: stX, y: sy, w: toggleW, h: toggleH });
    drawToggle(stX, sy, this.gameSettings.sfxOn, '#296654');
    sy += toggleH + 2;
    this._pauseMenuButtons.push({ id: 'sfxSlider', x: sectionX, y: sy, w: contentW, h: 18 });
    drawSlider(sectionX, sy, contentW, this.gameSettings.sfxVolume, '#296654');

    sy += 18 + 18;
    const btnStartY = sy;
    const btnX = dx + (dw - btnW) / 2;
    const menuBtns = [
      { id: 'continue', text: '继续' },
      { id: 'restart', text: '重新开始' },
      { id: 'quit', text: '退出' },
    ];

    for (let i = 0; i < menuBtns.length; i++) {
      const btn = menuBtns[i];
      const btnY = btnStartY + i * (btnH + btnGap);
      this._pauseMenuButtons.push({ id: btn.id, x: btnX, y: btnY, w: btnW, h: btnH });
      ctx.save();
      ctx.translate(btnX + btnW / 2, btnY + btnH / 2);
      ctx.rotate(-1 * Math.PI / 180);
      ctx.translate(-(btnX + btnW / 2), -(btnY + btnH / 2));
      ctx.fillStyle = '#322f22';
      drawRoundedRect(ctx, btnX + 3, btnY + 3, btnW, btnH, btnH / 2);
      ctx.fill();
      const bg = btn.id === 'quit' ? '#ff8c94' : '#fdd1b4';
      ctx.fillStyle = bg;
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

    // 按钮布局：水平居中
    // 上一行：[← 下移] [⟳] [→ 下移]  左右大，变换略小
    // 下一行：    [↓]                  居中圆形
    const padding = 8;
    const gap = 8;

    const areaTop = canvas.height - this.bottomHeight + padding;
    const areaHeight = this.bottomHeight - padding * 2;

    // 大按钮直径（左右、向下）
    const bigSize = Math.min(64, Math.floor(areaHeight * 0.44));
    // 变换按钮约大按钮的 85%
    const rotateSize = Math.floor(bigSize * 0.85);

    // 按钮簇宽度
    const clusterWidth = bigSize + gap + rotateSize + gap + bigSize;

    // 水平居中
    const clusterLeft = Math.floor((canvas.width - clusterWidth) / 2);

    // 整体垂直居中
    const totalClusterH = bigSize + gap + bigSize;
    const clusterY = areaTop + Math.floor((areaHeight - totalClusterH) / 2);

    const row1Y = clusterY;
    const row2Y = clusterY + bigSize + gap;

    // 变换按钮在行内垂直居中
    const rotateOffset = Math.floor((bigSize - rotateSize) / 2);

    // 左右按钮下移偏移量
    const sideOffset = Math.floor(bigSize * 0.3);

    // 定位每个按钮
    for (const button of this.controlButtons) {
      switch (button.id) {
        case 'left':
          button.x = clusterLeft;
          button.y = row1Y + sideOffset;
          button.width = bigSize;
          button.height = bigSize;
          break;
        case 'rotate':
          button.x = clusterLeft + bigSize + gap;
          button.y = row1Y + rotateOffset;
          button.width = rotateSize;
          button.height = rotateSize;
          break;
        case 'right':
          button.x = clusterLeft + bigSize + gap + rotateSize + gap;
          button.y = row1Y + sideOffset;
          button.width = bigSize;
          button.height = bigSize;
          break;
        case 'down':
          const downX = clusterLeft + Math.floor((clusterWidth - bigSize) / 2);
          button.x = downX;
          button.y = row2Y;
          button.width = bigSize;
          button.height = bigSize;
          break;
      }
    }

    // 渲染每个按钮
    for (const button of this.controlButtons) {
      const btnX = button.x;
      const btnY = button.y;
      const btnW = button.width;
      const btnH = button.height;

      const isRotateButton = button.id === 'rotate';
      const buttonColor = isRotateButton ? '#FF9500' : COLORS.secondaryContainer;

      // 绘制阴影
      ctx.save();
      const shadowColor = isRotateButton ? 'rgba(50, 47, 34, 0.7)' : EFFECTS.shadowColor;
      const shadowOffset = isRotateButton ? 14 : EFFECTS.shadowOffset;
      const shadowBlur = isRotateButton ? 18 : EFFECTS.shadowBlur;
      ctx.shadowColor = shadowColor;
      ctx.shadowOffsetX = shadowOffset;
      ctx.shadowOffsetY = shadowOffset;
      ctx.shadowBlur = shadowBlur;
      ctx.fillStyle = shadowColor;
      drawRoundedRect(ctx, btnX, btnY, btnW, btnH, btnW / 2);
      ctx.fill();
      ctx.restore();

      // 绘制按钮背景
      ctx.fillStyle = buttonColor;
      drawRoundedRect(ctx, btnX, btnY, btnW, btnH, btnW / 2);
      ctx.fill();

      // 绘制按钮边框
      ctx.strokeStyle = COLORS.onBackground;
      ctx.lineWidth = 4;
      drawRoundedRect(ctx, btnX, btnY, btnW, btnH, btnW / 2);
      ctx.stroke();

      // 绘制按钮图标
      const fontCoff = isRotateButton ? 0.9 : 0.45;
      ctx.font = `bold ${Math.floor(btnW * fontCoff)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = COLORS.onSecondaryContainer;
      ctx.lineWidth = 3;
      ctx.strokeText(button.icon, btnX + btnW / 2, btnY + btnH / 2);
      ctx.fillStyle = COLORS.onSecondaryContainer;
      ctx.fillText(button.icon, btnX + btnW / 2, btnY + btnH / 2);
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

      if (this.gameState === 'panel') {
        this.winPanelTimer += 16;
        if (this.winPanelTimer < 200) {
          this.winPanelScale = 0.2 + 0.9 * (this.winPanelTimer / 200);
        } else if (this.winPanelTimer < 600) {
          this.winPanelScale = 1.1 - 0.1 * ((this.winPanelTimer - 200) / 400);
        } else {
          this.winPanelScale = 1;
        }
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, adHeight, w, h - adHeight);

      const dw = 260;
      const padding = 28;
      const titleH = 28;
      const msgH = 26;
      const btnW = 180;
      const btnH = 44;
      const btnGap = 12;
      const dh = padding * 2 + titleH + 16 + msgH + 20 + btnH * 3 + btnGap * 2;
      const dx = (w - dw) / 2;
      const dy = adHeight + (h - adHeight - dh) / 2;

      ctx.save();
      ctx.translate(dx + dw / 2, dy + dh / 2);
      ctx.scale(this.winPanelScale, this.winPanelScale);
      ctx.rotate(-1 * Math.PI / 180);
      ctx.translate(-(dx + dw / 2), -(dy + dh / 2));
      ctx.fillStyle = '#fffcf5';
      ctx.strokeStyle = '#322f22';
      ctx.lineWidth = 4;
      drawRoundedRect(ctx, dx, dy, dw, dh, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#322f22';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`关卡 ${this.level}`, dx + dw / 2, dy + padding + titleH / 2);

      ctx.fillRect(dx + dw / 2 - 25, dy + padding + titleH + 6, 50, 2);

      ctx.font = '20px Arial';
      ctx.fillStyle = '#5f5b4d';
      ctx.fillText(this.victoryMessage, dx + dw / 2, dy + padding + titleH + 16 + msgH / 2);

      const btnX = dx + (dw - btnW) / 2;
      const shareBtnY = dy + padding + titleH + 16 + msgH + 20;
      const nextBtnY = shareBtnY + btnH + btnGap;
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
        if (text === '分享' && this.shareImage) {
          const iconSize = 22;
          const tw = ctx.measureText(text).width;
          const iconX = btnX + btnW / 2 - tw / 2 - iconSize - 6;
          ctx.drawImage(this.shareImage, iconX, y + (btnH - iconSize) / 2, iconSize, iconSize);
        }
        ctx.fillText(text, btnX + btnW / 2, y + btnH / 2);
        ctx.restore();
      };

      drawVictoryBtn(shareBtnY, '分享', '#4a90d9');
      drawVictoryBtn(nextBtnY, '下一关', '#fdd1b4');
      drawVictoryBtn(quitBtnY, '退出', '#ff8c94');
      ctx.restore();

      this.victoryButton.x = btnX;
      this.victoryButton.y = nextBtnY;
      this.victoryButton.width = btnW;
      this.victoryButton.height = btnH;
      this.victoryButton.visible = true;

      this.victoryShareButton = {
        x: btnX,
        y: shareBtnY,
        width: btnW,
        height: btnH,
        visible: true,
      };

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

      if (this._adLoading) {
        ctx.fillStyle = COLORS.primary;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const dots = '.'.repeat(Math.floor(Date.now() / 400) % 4);
        ctx.fillText(`WATCHING AD${dots}`, w / 2, dy + padding + titleH + 14 + textBlockH + 10 + btnH / 2);
      } else if (this._adError) {
        ctx.fillStyle = COLORS.error;
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this._adError, w / 2, dy + padding + titleH + 14 + textBlockH + 10 + btnH / 2);
      }

      const gameOverBtns = this._adLoading ? [] : [
        ...(this.reviveUsed ? [] : [{ id: 'shareRevive', text: '复活' }]),
        { id: 'restart', text: '重新开始' },
        { id: 'quit', text: '退出' },
      ];

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

        const btnBgColor = btn.id === 'shareRevive' ? '#a3e1ca' : btn.id === 'restart' ? '#fdd1b4' : '#ff8c94';
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
      this.victoryShareButton.visible = false;
    } else {
      this.victoryButton.visible = false;
      this.victoryQuitButton.visible = false;
      this.victoryShareButton.visible = false;
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

    this.aniId = requestAnimationFrame(this._boundLoop);
  }

  /**
   * 进入下一关（网格已在updateLevel中重置，此处只需隐藏弹窗并继续游戏）
   */
  resetForNextLevel() {
    this.showVictoryPopup = false;
    this.victoryButton.visible = false;
    this.victoryQuitButton.visible = false;
    this.victoryShareButton.visible = false;
    this.victoryEffects.clear();
    this.scoreFloats = [];
    this.scoreStars = [];
    this.scoreRoll.active = false;
    this.gameState = 'playing';
    this.reviveUsed = false;
    this.failLaughAnim.stop();
    this.playSfx('audio/talk.mp3');
    this.startTalk(this.level - 1, this._talkPrevGrid, this._talkPrevSpeed);
  }

  /**
   * 重新开始游戏
   */
  restart(savedLevel, savedHighScore) {
    if (this.gameMode === 'infinite' && this.score > 0 && !this.gameOver) {
      saveOnGameOver(this.score, this.highScore);
    }
    this._skipTalk = true;
    this.level = savedLevel || this.level;
    this.eventScheduler.reset(this.level);
    this.nextBlockConfused = false;
    this.smokeParticles = [];
    this.inkPhase = 'idle';
    this.bombPhase = 'idle';
    this.bombDebris = [];
    this.gameState = 'playing';
    this._skipTalk = false;
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
    this.victoryShareButton = { x: 0, y: 0, width: 0, height: 0, visible: false };

    this.failLaughAnim.stop();

    if (this.gameMode === 'infinite') {
      this.infiniteSpeedIdx = 0;
      this.scoreFloats = [];
      this.scoreStars = [];
      this.scoreRoll = { active: false, from: 0, to: 0, timer: 0 };
      this.gridSizeIndex = 2;
      this.speedIndex = 0;
      this.initialLayers = 0;
      const gridCols = 15;
      const gridRows = 23;
      const maxCellSizeByWidth = Math.floor(this.availableWidth / gridCols);
      const maxCellSizeByHeight = Math.floor(this.availableHeight / gridRows);
      const cellSize = Math.min(maxCellSizeByWidth, maxCellSizeByHeight, 30);
      const safeCellSize = Math.max(8, cellSize);
      this.cellSize = safeCellSize;
      this.grid = new Grid(safeCellSize, gridCols, gridRows);
      this.createNewBlock();
    } else {
      this.updateLevelConfig();
      this.resetGridForNewLevel();
    }

    if (this.musicManager) {
      this.musicManager.playRandom();
    }
  }

  /**
   * 通过观看广告复活
   */
  reviveByAd() {
    console.log('尝试通过广告复活...');
    this._adLoading = true;
    this._adError = '';

    this.adManager.showRewardedAd(
      () => {
        console.log('广告观看成功，执行复活逻辑');
        this._adLoading = false;

        const savedScore = this.score;
        const savedHighScore = this.highScore;
        this.restart(this.level, savedHighScore);
        this.reviveUsed = true;

        if (this.gameMode === 'infinite') {
          this.score = savedScore;
          this.highScore = Math.max(savedHighScore, savedScore);
        }

        this.failLaughAnim.stop();
      },
      (error) => {
        console.log('广告观看失败，无法复活:', error);
        this._adLoading = false;
        this._adError = 'AD LOAD FAILED';
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

    // 释放音效
    if (this._sfxCtx) {
      this._sfxCtx.destroy();
      this._sfxCtx = null;
    }

    // 释放图片资源
    this.starImage = null;
    this.shareImage = null;
    this.smokeImage = null;
    this.inkImage = null;
    this.boomImage = null;
    this.bombFallImage = null;
    this.talkImages = [];
    this.bombFuseImages = [];
  }
}

// 将分数配置暴露给全局作用域，便于调试
if (typeof GameGlobal !== 'undefined' && isDebugMode) {
  GameGlobal.SCORE_CONFIG = SCORE_CONFIG;
}