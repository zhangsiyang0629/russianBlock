/**
 * 方块形状定义
 * 每个形状是一个三维数组：[旋转状态][行][列]
 */
const SHAPES = {
  I: [
    [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]],
    [[0,0,1,0], [0,0,1,0], [0,0,1,0], [0,0,1,0]],
    [[0,0,0,0], [0,0,0,0], [1,1,1,1], [0,0,0,0]],
    [[0,1,0,0], [0,1,0,0], [0,1,0,0], [0,1,0,0]]
  ],
  J: [
    [[1,0,0], [1,1,1], [0,0,0]],
    [[0,1,1], [0,1,0], [0,1,0]],
    [[0,0,0], [1,1,1], [0,0,1]],
    [[0,1,0], [0,1,0], [1,1,0]]
  ],
  L: [
    [[0,0,1], [1,1,1], [0,0,0]],
    [[0,1,0], [0,1,0], [0,1,1]],
    [[0,0,0], [1,1,1], [1,0,0]],
    [[1,1,0], [0,1,0], [0,1,0]]
  ],
  O: [
    [[0,0,0,0], [0,1,1,0], [0,1,1,0], [0,0,0,0]]
  ],
  S: [
    [[0,1,1], [1,1,0], [0,0,0]],
    [[0,1,0], [0,1,1], [0,0,1]],
    [[0,0,0], [0,1,1], [1,1,0]],
    [[1,0,0], [1,1,0], [0,1,0]]
  ],
  T: [
    [[0,1,0], [1,1,1], [0,0,0]],
    [[0,1,0], [0,1,1], [0,1,0]],
    [[0,0,0], [1,1,1], [0,1,0]],
    [[0,1,0], [1,1,0], [0,1,0]]
  ],
  Z: [
    [[1,1,0], [0,1,1], [0,0,0]],
    [[0,0,1], [0,1,1], [0,1,0]],
    [[0,0,0], [1,1,0], [0,1,1]],
    [[0,1,0], [1,1,0], [1,0,0]]
  ]
};

/**
 * 方块颜色映射
 */
const COLORS = {
  I: 1,
  J: 2,
  L: 3,
  O: 4,
  S: 5,
  T: 6,
  Z: 7
};

// 设计系统方块颜色（与grid.js保持一致）
const BLOCK_COLORS = [
  '#000000', // 0: 空
  '#993d46', // 1: I (primary)
  '#296654', // 2: J (secondary)
  '#75553e', // 3: L (tertiary)
  '#ff8c94', // 4: O (primaryContainer)
  '#b1efd8', // 5: S (secondaryContainer)
  '#fdd1b4', // 6: T (tertiaryContainer)
  '#b02500'  // 7: Z (error)
];

/**
 * 方块类
 */
export default class Tetromino {
  constructor(type = 'I') {
    this.type = type;
    this.color = COLORS[type];
    this.shapes = SHAPES[type];
    this.rotation = 0; // 当前旋转状态索引
    this.x = 3; // 初始位置（列）
    this.y = 0; // 初始位置（行）
    
    // 获取当前形状矩阵
    this.shape = this.shapes[this.rotation];
  }

  /**
   * 获取当前形状矩阵
   */
  getShape() {
    return this.shape;
  }

  /**
   * 获取形状的宽度和高度
   */
  getSize() {
    return {
      width: this.shape[0].length,
      height: this.shape.length
    };
  }

  /**
   * 旋转方块（顺时针）
   */
  rotate() {
    const nextRotation = (this.rotation + 1) % this.shapes.length;
    this.rotation = nextRotation;
    this.shape = this.shapes[nextRotation];
  }

  /**
   * 逆时针旋转
   */
  rotateCCW() {
    const nextRotation = (this.rotation - 1 + this.shapes.length) % this.shapes.length;
    this.rotation = nextRotation;
    this.shape = this.shapes[nextRotation];
  }

  /**
   * 移动方块
   */
  move(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  /**
   * 设置位置
   */
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  /**
   * 克隆当前方块（用于碰撞检测预计算）
   */
  clone() {
    const clone = new Tetromino(this.type);
    clone.rotation = this.rotation;
    clone.x = this.x;
    clone.y = this.y;
    clone.shape = this.shape;
    return clone;
  }

  /**
   * 渲染方块
   */
  render(ctx, cellSize) {
    const { shape, x, y, color } = this;
    
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (shape[row][col]) {
          this.drawBlock(ctx, (x + col) * cellSize, (y + row) * cellSize, cellSize, color);
        }
      }
    }
  }

  drawBlock(ctx, x, y, size, color) {
    // 绘制方块背景
    ctx.fillStyle = BLOCK_COLORS[color];
    ctx.fillRect(x, y, size, size);
    
    // 创建蜡笔纹理（简单的斜线图案）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    const patternSize = 4;
    for (let i = -patternSize; i < size + patternSize; i += patternSize * 2) {
      ctx.fillRect(x + i, y, patternSize, size);
    }
    
    // 绘制方块边框
    ctx.strokeStyle = '#322f22'; // onBackground
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, size, size);
  }

  /**
   * 随机生成一个方块类型
   */
  static randomType() {
    const types = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
    return types[Math.floor(Math.random() * types.length)];
  }
}