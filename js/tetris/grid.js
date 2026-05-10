// 设计系统颜色（来自Google Stitch原型）
const GRID_COLORS = {
  // 背景和表面
  surfaceContainerLowest: '#ffffff',
  onBackground: '#322f22',
  outline: '#7b7767',
  outlineVariant: '#b2ad9c',

  // 方块颜色映射（俄罗斯方块标准颜色 -> 设计系统颜色）
  blockColors: [
    '#000000', // 0: 空
    '#993d46', // 1: I (primary)
    '#296654', // 2: J (secondary)
    '#75553e', // 3: L (tertiary)
    '#ff8c94', // 4: O (primaryContainer)
    '#b1efd8', // 5: S (secondaryContainer)
    '#fdd1b4', // 6: T (tertiaryContainer)
    '#b02500'  // 7: Z (error)
  ],

  // 效果
  shadowColor: 'rgba(50, 47, 34, 0.08)',
  shadowOffset: 8,
  gridLineOpacity: 0.2,
  borderWidth: 6,
};

/**
 * 游戏网格类
 * 管理动态尺寸的游戏区域
 */
export default class Grid {
  constructor(cellSize = 30, cols = 10, rows = 20) {
    this.cols = cols;
    this.rows = rows;
    this.cellSize = cellSize; // 每个格子的像素大小
    this.grid = this.createEmptyGrid();

    // 消除行动画状态
    this.clearAnimation = {
      active: false,         // 是否有动画正在进行
      startTime: 0,          // 动画开始时间
      duration: 800,         // 动画持续时间（毫秒）
      clearedRows: [],       // 被消除的行号
      particles: []          // 灰尘粒子
    };
  }

  createEmptyGrid() {
    return Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
  }

  /**
   * 检查位置是否有效（不超出边界且未被占用）
   */
  isValidPosition(x, y) {
    return x >= 0 && x < this.cols && y >= 0 && y < this.rows && this.grid[y][x] === 0;
  }

  /**
   * 检查一个方块形状在给定位置是否有效
   * @param {Array} shape - 方块的形状矩阵
   * @param {number} offsetX - 水平偏移
   * @param {number} offsetY - 垂直偏移
   */
  isValidShapePosition(shape, offsetX, offsetY) {
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const gridX = offsetX + x;
          const gridY = offsetY + y;
          // 允许方块在网格上方（gridY < 0）
          if (gridY < 0) {
            // 检查水平边界
            if (gridX < 0 || gridX >= this.cols) {
              return false;
            }
            // 在网格上方总是有效的
            continue;
          }
          // 在网格内部，使用标准检查
          if (!this.isValidPosition(gridX, gridY)) {
            return false;
          }
        }
      }
    }
    return true;
  }

  getGridData() {
    return this.grid;
  }

  setCell(row, col, value) {
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      this.grid[row][col] = value;
    }
  }

  /**
   * 将方块放置到网格中
   */
  placeShape(shape, offsetX, offsetY, color) {
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const gridY = offsetY + y;
          // 只放置网格内部的方块
          if (gridY >= 0 && gridY < this.rows) {
            this.grid[gridY][offsetX + x] = color;
          }
        }
      }
    }
  }

  /**
   * 清除完整的行并返回清除的行数
   */
  clearLines() {
    let linesCleared = 0;
    const clearedRows = [];

    // 收集完整行
    for (let y = this.rows - 1; y >= 0; y--) {
      if (this.grid[y].every(cell => cell !== 0)) {
        clearedRows.push(y);
      }
    }

    // 如果有完整行，启动消除动画
    if (clearedRows.length > 0) {
      this.startClearAnimation(clearedRows);
    }
    this._lastClearedRows = [...clearedRows];

    for (let y = this.rows - 1; y >= 0; y--) {
      if (this.grid[y].every(cell => cell !== 0)) {
        this.grid.splice(y, 1);
        this.grid.unshift(Array(this.cols).fill(0));
        linesCleared++;
        y++; // 重新检查同一行（因为上面的行下移了）
      }
    }

    return linesCleared;
  }

  /**
   * 清除底部指定行数的方块（不清除行，只将方块置空）
   * @param {number} count - 要清除的行数（从底部开始）
   * @return {number} 实际清除的方块数
   */
  clearBottomRows(count) {
    let blocksCleared = 0;
    const rowsToClear = Math.min(count, this.rows);

    for (let y = this.rows - 1; y >= this.rows - rowsToClear && y >= 0; y--) {
      for (let x = 0; x < this.cols; x++) {
        if (this.grid[y][x] !== 0) {
          this.grid[y][x] = 0;
          blocksCleared++;
        }
      }
    }

    return blocksCleared;
  }

  /**
   * 启动消除行动画
   * @param {Array} clearedRows - 被消除的行号数组
   */
  startClearAnimation(clearedRows) {
    const now = Date.now();
    this.clearAnimation.active = true;
    this.clearAnimation.startTime = now;
    this.clearAnimation.clearedRows = [...clearedRows];
    this.clearAnimation.particles = [];

    this.clearAnimation.clearedBlocks = [];
    for (const row of clearedRows) {
      for (let x = 0; x < this.cols; x++) {
        const c = this.grid[row][x];
        if (c === 0) continue;
        this.clearAnimation.clearedBlocks.push({ x, y: row, color: c });
      }
    }

    // 为每个被消除的方块创建灰尘粒子
    const cell = this.cellSize;
    const colors = GRID_COLORS.blockColors;
    for (const row of clearedRows) {
      for (let x = 0; x < this.cols; x++) {
        const blockColor = this.grid[row][x];
        if (blockColor === 0) continue; // 空方块不产生粒子

        const baseColor = colors[blockColor];
        // 将十六进制颜色转换为RGB
        const r = parseInt(baseColor.slice(1, 3), 16);
        const g = parseInt(baseColor.slice(3, 5), 16);
        const b = parseInt(baseColor.slice(5, 7), 16);

        // 每个方块产生4-8个粒子（增加变化）
        const particleCount = 4 + Math.floor(Math.random() * 5);
        for (let i = 0; i < particleCount; i++) {
          // 基于方块颜色的灰尘颜色，增加更多变化
          const hueShift = (Math.random() - 0.5) * 40; // 色相偏移
          const dustR = Math.min(255, Math.max(0, r + 30 + hueShift + Math.random() * 50));
          const dustG = Math.min(255, Math.max(0, g + 30 + hueShift + Math.random() * 50));
          const dustB = Math.min(255, Math.max(0, b + 30 + hueShift + Math.random() * 50));

          // 随机粒子类型（0: 标准, 1: 快速, 2: 慢速, 3: 大颗粒）
          const particleType = Math.floor(Math.random() * 4);

          let vx, vy, size, lifeDecay;

          switch (particleType) {
            case 0: // 标准粒子
              vx = (Math.random() - 0.5) * 6;
              vy = -Math.random() * 4 - 1;
              size = Math.random() * 5 + 2;
              lifeDecay = 0.02;
              break;
            case 1: // 快速小粒子
              vx = (Math.random() - 0.5) * 10;
              vy = -Math.random() * 6 - 2;
              size = Math.random() * 3 + 1;
              lifeDecay = 0.03;
              break;
            case 2: // 慢速大粒子
              vx = (Math.random() - 0.5) * 2;
              vy = -Math.random() * 2 - 0.5;
              size = Math.random() * 8 + 3;
              lifeDecay = 0.015;
              break;
            case 3: // 旋转粒子
              vx = (Math.random() - 0.5) * 4;
              vy = -Math.random() * 3 - 1;
              size = Math.random() * 4 + 2;
              lifeDecay = 0.025;
              break;
          }

          // 添加基于位置的微小变化
          const posX = x * cell + Math.random() * cell;
          const posY = row * cell + Math.random() * cell;

          this.clearAnimation.particles.push({
            x: posX,
            y: posY,
            vx: vx,
            vy: vy,
            size: size,
            life: 1.0,
            lifeDecay: lifeDecay,
            rotation: 0,
            rotationSpeed: particleType === 3 ? (Math.random() - 0.5) * 0.2 : 0,
            color: `rgba(${dustR}, ${dustG}, ${dustB}, ${0.5 + Math.random() * 0.4})`,
            type: particleType
          });
        }
      }
    }
  }

  /**
   * 更新动画状态
   */
  updateAnimation() {
    if (!this.clearAnimation.active) return;

    const now = Date.now();
    const elapsed = now - this.clearAnimation.startTime;
    const progress = Math.min(elapsed / this.clearAnimation.duration, 1.0);

    // 更新粒子
    for (let i = this.clearAnimation.particles.length - 1; i >= 0; i--) {
      const particle = this.clearAnimation.particles[i];
      particle.x += particle.vx;
      particle.y += particle.vy;

      // 根据粒子类型应用不同的物理效果
      switch (particle.type) {
        case 0: // 标准粒子：标准重力
          particle.vy += 0.1;
          break;
        case 1: // 快速小粒子：较弱重力，空气阻力
          particle.vy += 0.07;
          particle.vx *= 0.98; // 空气阻力
          break;
        case 2: // 慢速大粒子：较强重力
          particle.vy += 0.15;
          break;
        case 3: // 旋转粒子：标准重力，旋转
          particle.vy += 0.1;
          particle.rotation += particle.rotationSpeed;
          break;
      }

      // 使用粒子的 lifeDecay 属性
      particle.life -= particle.lifeDecay;

      // 粒子死亡时可能产生次级效果
      if (particle.life <= 0) {
        // 对于大粒子，可以分裂成小粒子（可选效果）
        if (particle.type === 2 && particle.size > 5) {
          // 大粒子分裂成2-3个小粒子
          const splitCount = 2 + Math.floor(Math.random() * 2);
          for (let j = 0; j < splitCount; j++) {
            this.clearAnimation.particles.push({
              x: particle.x,
              y: particle.y,
              vx: (Math.random() - 0.5) * 3,
              vy: -Math.random() * 2,
              size: particle.size * 0.5,
              life: 0.5,
              lifeDecay: 0.04,
              rotation: 0,
              rotationSpeed: 0,
              color: particle.color.replace(/[\d\.]+\)$/, '0.4)'), // 降低透明度
              type: 1 // 快速小粒子
            });
          }
        }

        this.clearAnimation.particles.splice(i, 1);
      }
    }

    // 动画结束
    if (progress >= 1.0) {
      this.clearAnimation.active = false;
    }
  }

  /**
   * 渲染网格
   */
  render(ctx, gameState) {
    const { cols, rows, cellSize } = this;
    const width = cols * cellSize;
    const height = rows * cellSize;

    // 保存画布状态
    ctx.save();

    // 绘制阴影效果（偏移8px）
    ctx.fillStyle = GRID_COLORS.shadowColor;
    ctx.fillRect(GRID_COLORS.shadowOffset, GRID_COLORS.shadowOffset, width, height);

    // 绘制网格容器背景（白色）
    ctx.fillStyle = GRID_COLORS.surfaceContainerLowest;
    ctx.fillRect(0, 0, width, height);

    // 绘制容器边框（粗边框）
    ctx.strokeStyle = GRID_COLORS.onBackground;
    ctx.lineWidth = GRID_COLORS.borderWidth;
    ctx.strokeRect(0, 0, width, height);

    // 绘制内部网格线（半透明）
    ctx.strokeStyle = GRID_COLORS.outline;
    ctx.globalAlpha = GRID_COLORS.gridLineOpacity;
    ctx.lineWidth = 0.5;

    // 垂直线
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, height);
      ctx.stroke();
    }

    // 水平线
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(width, y * cellSize);
      ctx.stroke();
    }

    // 恢复透明度
    ctx.globalAlpha = 1.0;

    // 绘制已放置的方块
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const color = this.grid[y][x];
        if (color && color > 0) {
          // if (gameState === 'clearing') {
          //   console.log('render clearing row=', y, 'col=', x, 'color=', color);
          // }
          this.drawBlock(ctx, x, y, color);
        }
      }
    }

    // 绘制消除动画（方块倒下效果和灰尘）
    if (this.clearAnimation.active) {
      const now = Date.now();
      const elapsed = now - this.clearAnimation.startTime;
      const progress = Math.min(elapsed / this.clearAnimation.duration, 1.0);

      // 绘制动画方块
      if (this.clearAnimation.clearedBlocks) {
        for (const block of this.clearAnimation.clearedBlocks) {
          this.drawAnimatedBlock(ctx, block.x, block.y, block.color, progress);
        }
      }

      // 绘制灰尘粒子
      for (const particle of this.clearAnimation.particles) {
        ctx.save();
        ctx.translate(particle.x, particle.y);

        // 应用旋转（如果有）
        if (particle.rotation !== 0) {
          ctx.rotate(particle.rotation);
        }

        // 根据粒子类型绘制不同形状
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = particle.life;

        if (particle.type === 2) {
          // 大粒子：绘制方形
          ctx.fillRect(-particle.size, -particle.size, particle.size * 2, particle.size * 2);
        } else if (particle.type === 3) {
          // 旋转粒子：绘制星形或复杂形状
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const angle = (i * 2 * Math.PI) / 5 + particle.rotation;
            const radius = particle.size * (i % 2 === 0 ? 1 : 0.5);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.closePath();
          ctx.fill();
        } else {
          // 标准粒子：圆形
          ctx.beginPath();
          ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
      ctx.globalAlpha = 1.0;
    }

    // 恢复画布状态
    ctx.restore();
  }

  drawBlock(ctx, x, y, color) {
    const colors = GRID_COLORS.blockColors;
    const cell = this.cellSize;
    const blockX = x * cell;
    const blockY = y * cell;

    // 保存画布状态
    ctx.save();

    // 计算基于时间和位置的抖动效果（已落定方块快速小幅度抖动）
    const time = Date.now() * 0.001; // 转换为秒
    // 每个方块有独特的相位，基于位置哈希，使相邻方块抖动不同步
    const phaseHash = (x * 13 + y * 17) * 0.1;

    // 高频小幅度抖动，模拟瑟瑟发抖效果
    // 旋转（-0.5到0.5度）和位移（-0.5到0.5像素），频率极高（提高一倍）
    const rotation = Math.sin(time * 30 + phaseHash) * 0.5 * (Math.PI / 180); // -0.5到0.5度
    const translateX = Math.sin(time * 40 + phaseHash * 1.3) * 0.5; // -0.5到0.5像素
    const translateY = Math.cos(time * 35 + phaseHash * 1.7) * 0.5; // -0.5到0.5像素

    // 应用变换到方块中心
    ctx.translate(blockX + cell / 2, blockY + cell / 2);
    ctx.rotate(rotation);
    ctx.translate(-cell / 2 + translateX, -cell / 2 + translateY);

    // 绘制方块背景（蜡笔填充效果）
    ctx.fillStyle = colors[color];
    ctx.fillRect(0, 0, cell, cell);

    // 创建蜡笔纹理（简单的斜线图案）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    const patternSize = 4;
    for (let i = -patternSize; i < cell + patternSize; i += patternSize * 2) {
      ctx.fillRect(i, 0, patternSize, cell);
    }

    // 绘制方块边框
    ctx.strokeStyle = GRID_COLORS.onBackground;
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, cell, cell);

    // 恢复画布状态
    ctx.restore();
  }

  drawAnimatedBlock(ctx, x, y, color, progress) {
    const colors = GRID_COLORS.blockColors;
    const cell = this.cellSize;
    const blockX = x * cell;
    const blockY = y * cell;

    // 保存画布状态
    ctx.save();

    // 根据进度计算动画效果
    // 进度0-1：方块倒下效果

    // 使用位置和颜色生成确定性随机种子
    const seed = (x * 17 + y * 23 + color * 7) % 100;
    const rand1 = (Math.sin(seed * 0.1) + 1) * 0.5;
    const rand2 = (Math.cos(seed * 0.15) + 1) * 0.5;
    const rand3 = (Math.sin(seed * 0.23) + 1) * 0.5;
    const rand4 = (Math.cos(seed * 0.31) + 1) * 0.5;

    // 随机选择倒下方向（模拟砖块被推倒）
    const animationType = Math.floor(rand1 * 3); // 0-2

    // 1. 旋转效果（绕底部边缘倒下）
    let maxRotation, rotationDirection, rotationPivot;

    if (animationType === 0) {
      // 类型0：向左倒下（绕左下角）
      maxRotation = -Math.PI * 0.5 * (0.8 + rand2 * 0.4); // -72到-90度
      rotationDirection = 1;
      rotationPivot = 'bottom-left'; // 左下角
    } else if (animationType === 1) {
      // 类型1：向右倒下（绕右下角）
      maxRotation = Math.PI * 0.5 * (0.8 + rand2 * 0.4); // 72到90度
      rotationDirection = 1;
      rotationPivot = 'bottom-right'; // 右下角
    } else {
      // 类型2：向后倒下（绕底部中点）
      maxRotation = Math.PI * (0.7 + rand2 * 0.6); // 126到180度
      rotationDirection = 1;
      rotationPivot = 'bottom-center'; // 底部中点
    }

    // 应用非线性进度曲线（缓入缓出，模拟重力加速）
    let animatedProgress = progress;
    // 使用缓入缓出，使动画更自然
    animatedProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    const rotation = animatedProgress * maxRotation * rotationDirection;

    // 2. 透明度逐渐降低（所有类型统一）
    const alpha = 1.0 - Math.pow(progress, 1.5) * 0.8;

    // 3. 平移效果（所有类型都有明显下落）
    const centerX = this.cols / 2;
    const centerY = this.rows / 2;

    let translateX, translateY;

    // 基础下落位移（所有类型都有）
    const baseFallDistance = -animatedProgress * 15; // 基础下落距离

    // 水平移动（根据倒下方向）
    let horizontalMove = 0;

    if (animationType === 0) {
      // 向左倒下：主要向左移动，带轻微随机
      horizontalMove = -animatedProgress * 12 * (0.7 + rand3 * 0.6);
    } else if (animationType === 1) {
      // 向右倒下：主要向右移动，带轻微随机
      horizontalMove = animatedProgress * 12 * (0.7 + rand3 * 0.6);
    } else {
      // 向后倒下：轻微随机水平移动
      horizontalMove = (rand3 - 0.5) * animatedProgress * 8;
    }

    // 轻微垂直随机波动（不影响主要下落）
    const verticalWobble = Math.sin(animatedProgress * Math.PI * 2) * animatedProgress * 3 * rand4;

    translateX = horizontalMove;
    translateY = baseFallDistance + verticalWobble;

    // 添加基于位置的偏移（从中心向外）
    const fromCenterX = (x - centerX) / centerX;
    const fromCenterY = (y - centerY) / centerY;
    translateX += fromCenterX * animatedProgress * 4;
    translateY += fromCenterY * animatedProgress * 1; // 很小的垂直偏移，不影响下落

    // 4. 缩放效果（轻微变形，模拟倒下时的透视）
    let scale = 1.0;
    // 轻微缩放，模拟倒下时的变形
    scale = 1.0 + Math.sin(animatedProgress * Math.PI) * 0.1;

    // 5. 颜色变化（根据进度轻微变暗）
    const baseColor = colors[color];
    // 所有类型都随着进度轻微变暗
    const darkenFactor = progress * 0.3;
    ctx.fillStyle = this.darkenColor(baseColor, darkenFactor);

    // 根据支点位置应用变换（绕底部边缘倒下）
    let pivotX, pivotY;
    if (rotationPivot === 'bottom-left') {
      pivotX = 0;
      pivotY = cell;
    } else if (rotationPivot === 'bottom-right') {
      pivotX = cell;
      pivotY = cell;
    } else { // bottom-center
      pivotX = cell / 2;
      pivotY = cell;
    }

    // 1. 平移到支点（世界坐标）
    ctx.translate(blockX + pivotX, blockY + pivotY);
    // 2. 旋转
    ctx.rotate(rotation);
    // 3. 缩放
    ctx.scale(scale, scale);
    // 4. 平移到相对于支点的位置（加上下落和水平位移）
    ctx.translate(-pivotX + translateX, -pivotY + translateY);

    // 设置透明度
    ctx.globalAlpha = alpha;

    // 绘制方块背景（蜡笔填充效果）
    ctx.fillRect(0, 0, cell, cell);

    // 创建蜡笔纹理（简单的斜线图案）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    const patternSize = 4;
    for (let i = -patternSize; i < cell + patternSize; i += patternSize * 2) {
      ctx.fillRect(i, 0, patternSize, cell);
    }

    // 绘制方块边框（透明度也降低）
    ctx.strokeStyle = GRID_COLORS.onBackground;
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, cell, cell);

    // 恢复画布状态
    ctx.restore();
  }

  /**
   * 加深颜色
   */
  darkenColor(color, factor) {
    // 简单实现：将颜色转换为RGB并减少亮度
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    const darken = (value) => Math.max(0, Math.floor(value * (1 - factor)));

    return `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`;
  }

  /**
   * 生成初始随机砖块层
   * @param {number} layers - 层数（从底部开始）
   * @param {number} minEmptyPerRow - 每行至少留空的数量（默认1）
   */
  generateInitialLayers(layers, minEmptyPerRow = 1) {
    if (layers <= 0) return;

    const rowsToFill = Math.min(layers, this.rows);
    const startRow = this.rows - rowsToFill;

    // 方块颜色列表（排除0:空）
    const blockColors = [1, 2, 3, 4, 5, 6, 7];

    for (let y = startRow; y < this.rows; y++) {
      // 随机决定该行填充多少格子（至少留minEmptyPerRow个空位）
      const maxFilled = this.cols - minEmptyPerRow;
      const filledCount = Math.floor(Math.random() * (maxFilled - 1)) + 1; // 至少1个，最多maxFilled个

      // 随机选择哪些列填充
      const columns = Array.from({ length: this.cols }, (_, i) => i);
      // 打乱顺序
      for (let i = columns.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [columns[i], columns[j]] = [columns[j], columns[i]];
      }

      // 选择前filledCount个列进行填充
      for (let i = 0; i < filledCount; i++) {
        const x = columns[i];
        // 随机选择方块颜色
        const colorIndex = Math.floor(Math.random() * blockColors.length);
        this.grid[y][x] = blockColors[colorIndex];
      }
    }

    console.log(`生成初始砖块: ${layers}层, 实际填充${rowsToFill}行`);
  }

  /**
   * 调整颜色亮度
   */
  adjustColorBrightness(color, factor) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    const adjust = (value) => Math.min(255, Math.floor(value * factor));

    return `rgb(${adjust(r)}, ${adjust(g)}, ${adjust(b)})`;
  }
}