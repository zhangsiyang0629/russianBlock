/**
 * 游戏封面类
 * 参考 ui/cover.html 设计
 */
export default class Cover {
  constructor(ctx, getEnergyInfo = null) {
    this.ctx = ctx;
    this.canvas = ctx.canvas;
    
    // 封面状态
    this.active = true;
    this.resourcesLoaded = false;
    
    // 图片资源
    this.characterImage = null;
    
    // 按钮定义
    this.buttons = [
      { id: 'play', text: 'PLAY', x: 0, y: 0, width: 0, height: 0, color: '#FFB347' }
    ];
    
    // 底部导航
    this.navItems = [
      { id: 'scoresNav', icon: '📊', text: 'Scores', active: true },
      { id: 'settingsNav', icon: '⚙', text: 'Settings', active: false }
    ];
    
    // 体力信息获取函数
    this.getEnergyInfo = getEnergyInfo;
    
    // 开始加载资源
    this.loadResources();
  }
  
  /**
   * 加载图片资源
   */
  loadResources() {
    console.log('加载封面资源...');
    
    // 加载角色图片
    if (typeof wx !== 'undefined' && wx.createImage) {
      this.characterImage = wx.createImage();
      
      // 尝试多种路径格式，包括不同前缀和分包路径
      const pathFormats = [
        'subpackages/images/mike.png',
        'images/mike.png',
        'mike.png'
      ];
      
      let imagesLoaded = 0;
      const totalImages = 1;
      
      // 为图像创建重试逻辑
      const tryLoadImage = (formatIndex) => {
        if (formatIndex >= pathFormats.length) {
          // 所有格式都尝试过了，仍然失败
          console.error('封面角色图像所有路径格式都加载失败');
          imagesLoaded++;
          if (imagesLoaded === totalImages) {
            this.resourcesLoaded = true;
            console.log('封面资源加载尝试完成');
          }
          return;
        }
        
        const src = pathFormats[formatIndex];
        console.log(`加载封面图像，尝试格式 ${formatIndex}: ${src}`);
        this.characterImage.src = src;
        
        // 临时存储当前格式索引
        this.characterImage._currentFormat = formatIndex;
        this.characterImage._src = src;
      };
      
      this.characterImage.onload = () => {
        console.log(`封面角色图像加载成功 (格式 ${this.characterImage._currentFormat}: ${this.characterImage._src})`);
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
          this.resourcesLoaded = true;
          console.log('封面资源加载完成');
        }
      };
      
      this.characterImage.onerror = (err) => {
        console.error(`封面角色图像格式 ${this.characterImage._currentFormat} 加载失败:`, err);
        console.error(`失败详情: src="${this.characterImage._src}", error=${err?.message || err}`);
        
        // 尝试下一个格式
        const nextFormatIndex = this.characterImage._currentFormat + 1;
        if (nextFormatIndex < pathFormats.length) {
          console.log(`封面图像尝试下一个格式 ${nextFormatIndex}`);
          setTimeout(() => tryLoadImage(nextFormatIndex), 10);
        } else {
          // 所有格式都失败了
          console.error('封面角色图像所有格式都加载失败');
          imagesLoaded++;
          if (imagesLoaded === totalImages) {
            this.resourcesLoaded = true;
            console.log('封面资源加载尝试完成（可能失败）');
          }
        }
      };
      
      // 开始尝试加载第一个格式
      tryLoadImage(0);
    } else {
      // 非微信环境（调试用）
      console.warn('非微信环境，跳过图片加载');
      this.resourcesLoaded = true;
    }
  }
  

  
  /**
   * 渲染封面
   */
  render() {
    if (!this.active) return;
    
    const { ctx, canvas } = this;
    const width = canvas.width;
    const height = canvas.height;
    
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    // 绘制纸质纹理背景
    this.drawPaperTexture();
    
    // 绘制装饰性蜡笔方块
    this.drawDecorativeBlocks();
    
    // 绘制体力信息
    this.drawEnergyInfo();
    
    // 绘制中央角色部分
    this.drawCharacterSection();
    
    // 绘制游戏标题
    this.drawGameTitle();
    
    // 绘制操作按钮
    this.drawActionButtons();
    
    // 绘制底部导航
    this.drawBottomNav();
  }
  
  /**
   * 绘制纸质纹理背景
   */
  drawPaperTexture() {
    const { ctx, canvas } = this;
    
    // 浅黄色背景
    ctx.fillStyle = '#fffcf5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 简单模拟纸张纹理：绘制一些噪点
    ctx.fillStyle = 'rgba(50, 47, 34, 0.02)';
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const size = Math.random() * 3;
      ctx.fillRect(x, y, size, size);
    }
  }
  
  /**
   * 绘制装饰性蜡笔方块
   */
  drawDecorativeBlocks() {
    const { ctx, canvas } = this;
    const width = canvas.width;
    const height = canvas.height;
    
    // 方块1: 粉色，左上方
    ctx.save();
    ctx.fillStyle = '#ef7f87';
    ctx.strokeStyle = '#322f22';
    ctx.lineWidth = 4;
    ctx.translate(width * 0.1, height * 0.1);
    ctx.rotate(-12 * Math.PI / 180);
    this.drawCrayonBlock(ctx, 0, 0, 60, 60);
    ctx.restore();
    
    // 方块2: 绿色，右上方
    ctx.save();
    ctx.fillStyle = '#a3e1ca';
    ctx.strokeStyle = '#322f22';
    ctx.lineWidth = 4;
    ctx.translate(width * 0.85, height * 0.15);
    ctx.rotate(15 * Math.PI / 180);
    this.drawCrayonBlock(ctx, 0, 0, 45, 75);
    ctx.restore();
    
    // 方块3: 橙色，左下方
    ctx.save();
    ctx.fillStyle = '#fdd1b4';
    ctx.strokeStyle = '#322f22';
    ctx.lineWidth = 4;
    ctx.translate(width * 0.05, height * 0.6);
    ctx.rotate(-8 * Math.PI / 180);
    this.drawCrayonBlock(ctx, 0, 0, 75, 52);
    ctx.restore();
    
    // 方块4: 粉色，右下方
    ctx.save();
    ctx.fillStyle = '#ef7f87';
    ctx.strokeStyle = '#322f22';
    ctx.lineWidth = 4;
    ctx.translate(width * 0.92, height * 0.4);
    ctx.rotate(25 * Math.PI / 180);
    this.drawCrayonBlock(ctx, 0, 0, 60, 60);
    ctx.restore();
  }
  
  /**
   * 绘制单个蜡笔方块（简化版）
   */
  drawCrayonBlock(ctx, x, y, width, height) {
    // 绘制填充矩形
    ctx.fillRect(x, y, width, height);
    
    // 绘制边框
    ctx.strokeRect(x, y, width, height);
    
    // 简单的蜡笔纹理：绘制一些斜线
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < width + height; i += 8) {
      ctx.beginPath();
      ctx.moveTo(x + i, y);
      ctx.lineTo(x, y + i);
      ctx.stroke();
    }
    ctx.restore();
  }
  
  /**
   * 绘制中央角色部分
   */
  drawCharacterSection() {
    const { ctx, canvas } = this;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2 - 40;
    
    // 绘制角色图片
    if (this.characterImage) {
      const imgWidth = 200;
      const imgHeight = 200;
      const imgX = centerX - imgWidth / 2;
      const imgY = centerY - imgHeight / 2 - 60;
      
      // 绘制不规则边框
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#322f22';
      ctx.lineWidth = 4;
      ctx.translate(imgX, imgY);
      ctx.rotate(-1 * Math.PI / 180);
      
      // 绘制带边框的矩形
      ctx.fillRect(0, 0, imgWidth, imgHeight);
      ctx.strokeRect(0, 0, imgWidth, imgHeight);
      
      // 绘制图片
      ctx.drawImage(this.characterImage, 10, 10, imgWidth - 20, imgHeight - 20);
      ctx.restore();
      
      // 绘制对话气泡
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#322f22';
      ctx.lineWidth = 4;
      ctx.translate(imgX + imgWidth - 20, imgY - 20);
      ctx.rotate(12 * Math.PI / 180);
      
      // 绘制圆角矩形
      const bubbleWidth = 120;
      const bubbleHeight = 40;
      const borderRadius = 10;
      
      ctx.fillRect(0, 0, bubbleWidth, bubbleHeight);
      ctx.strokeRect(0, 0, bubbleWidth, bubbleHeight);
      
      // 绘制对话气泡尾部
      ctx.beginPath();
      ctx.moveTo(bubbleWidth - 20, bubbleHeight);
      ctx.lineTo(bubbleWidth - 10, bubbleHeight + 15);
      ctx.lineTo(bubbleWidth, bubbleHeight);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // 绘制文字
      ctx.fillStyle = '#322f22';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('"CYKA BLOCKS!"', bubbleWidth / 2, bubbleHeight / 2);
      ctx.restore();
    } else {
      // 图片未加载时绘制占位符
      const placeholderWidth = 200;
      const placeholderHeight = 200;
      const placeholderX = centerX - placeholderWidth / 2;
      const placeholderY = centerY - placeholderHeight / 2 - 60;
      
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#322f22';
      ctx.lineWidth = 4;
      ctx.fillRect(placeholderX, placeholderY, placeholderWidth, placeholderHeight);
      ctx.strokeRect(placeholderX, placeholderY, placeholderWidth, placeholderHeight);
      
      ctx.fillStyle = '#322f22';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Character', centerX, centerY - 60);
    }
  }
  
  /**
   * 绘制游戏标题
   */
  drawGameTitle() {
    const { ctx, canvas } = this;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2 + 80;
    
    ctx.save();
    ctx.fillStyle = '#FFB347'; // 主色
    ctx.strokeStyle = '#322f22';
    ctx.lineWidth = 6;
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(centerX, centerY);
    ctx.rotate(-2 * Math.PI / 180);
    
    // 绘制文字轮廓
    ctx.strokeText('SKETCHY', 0, -30);
    ctx.strokeText('TETRIS', 0, 30);
    
    // 绘制填充文字
    ctx.fillText('SKETCHY', 0, -30);
    ctx.fillText('TETRIS', 0, 30);
    
    ctx.restore();
  }
  
  /**
   * 绘制操作按钮
   */
  drawActionButtons() {
    const { ctx, canvas } = this;
    const centerX = canvas.width / 2;
    const buttonStartY = canvas.height / 2 + 180;
    
    // Play 按钮
    const playButton = this.buttons[0];
    const playButtonWidth = 300;
    const playButtonHeight = 70;
    playButton.x = centerX - playButtonWidth / 2;
    playButton.y = buttonStartY;
    playButton.width = playButtonWidth;
    playButton.height = playButtonHeight;
    
    // 检查体力是否足够
    let buttonColor = playButton.color;
    let textColor = '#ffffff';
    let isDisabled = false;
    
    if (this.getEnergyInfo) {
      const energyInfo = this.getEnergyInfo();
      if (energyInfo && !energyInfo.hasEnough) {
        buttonColor = '#b2ad9c'; // 灰色
        textColor = '#7b7767'; // 暗灰色文字
        isDisabled = true;
      }
    }
    
    this.drawButton(ctx, playButton, 0, buttonColor, textColor, isDisabled);
  }
  
  /**
   * 绘制单个按钮
   */
  drawButton(ctx, button, rotation = 0, buttonColor = null, textColor = null, isDisabled = false) {
    ctx.save();
    
    // 应用旋转
    const buttonCenterX = button.x + button.width / 2;
    const buttonCenterY = button.y + button.height / 2;
    ctx.translate(buttonCenterX, buttonCenterY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-buttonCenterX, -buttonCenterY);
    
    // 绘制阴影（圆角）
    ctx.fillStyle = isDisabled ? '#b2ad9c' : '#322f22';
    const borderRadius = button.height / 2;
    this.drawRoundedRect(ctx, button.x + 6, button.y + 6, button.width, button.height, borderRadius);
    ctx.fill();
    
    // 绘制按钮背景
    const bgColor = buttonColor || button.color;
    ctx.fillStyle = bgColor;
    ctx.strokeStyle = isDisabled ? '#b2ad9c' : '#322f22';
    ctx.lineWidth = 4;
    
    // 绘制圆角矩形
    this.drawRoundedRect(ctx, button.x, button.y, button.width, button.height, borderRadius);
    ctx.fill();
    ctx.stroke();
    
    // 绘制按钮文字
    const txtColor = textColor || (button.id === 'play' ? '#ffffff' : '#322f22');
    ctx.fillStyle = txtColor;
    ctx.font = button.id === 'play' ? 'bold 32px Arial' : 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      button.text,
      button.x + button.width / 2,
      button.y + button.height / 2
    );
    
    ctx.restore();
  }
  
  /**
   * 绘制圆角矩形路径
   */
  drawRoundedRect(ctx, x, y, width, height, radius) {
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
   * 绘制底部导航
   */
  drawBottomNav() {
    const { ctx, canvas } = this;
    const navHeight = 80;
    const navY = canvas.height - navHeight;
    
    // 绘制导航栏背景
    ctx.fillStyle = '#fffcf5';
    ctx.strokeStyle = '#322f22';
    ctx.lineWidth = 4;
    ctx.fillRect(0, navY, canvas.width, navHeight);
    ctx.strokeRect(0, navY, canvas.width, navHeight);
    
    // 绘制导航项
    const itemCount = this.navItems.length;
    const itemWidth = canvas.width / itemCount;
    
    for (let i = 0; i < itemCount; i++) {
      const item = this.navItems[i];
      const itemX = i * itemWidth;
      const itemCenterX = itemX + itemWidth / 2;
      
      if (item.active) {
        // 激活项：绘制彩色背景
        ctx.save();
        ctx.fillStyle = '#FFB347';
        ctx.translate(itemCenterX, navY + navHeight / 2);
        ctx.rotate(-2 * Math.PI / 180);
        
        const activeSize = 50;
        ctx.fillRect(-activeSize / 2, -activeSize / 2, activeSize, activeSize);
        
        ctx.strokeStyle = '#322f22';
        ctx.lineWidth = 4;
        ctx.strokeRect(-activeSize / 2, -activeSize / 2, activeSize, activeSize);
        ctx.restore();
      }
      
      // 绘制图标
      ctx.fillStyle = item.active ? '#ffffff' : '#322f22';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.icon, itemCenterX, navY + navHeight / 2 - 10);
      
      // 绘制文字
      ctx.font = 'bold 10px Arial';
      ctx.fillText(item.text, itemCenterX, navY + navHeight / 2 + 15);
    }
  }
  
  /**
   * 处理点击事件
   * @param {number} x - 点击X坐标
   * @param {number} y - 点击Y坐标
   * @returns {string|null} 被点击的元素ID，或null
   */
  handleClick(x, y) {
    if (!this.active) return null;
    
    // 检查按钮点击
    for (const button of this.buttons) {
      if (x >= button.x && x <= button.x + button.width &&
          y >= button.y && y <= button.height) {
        console.log(`点击按钮: ${button.id}`);
        
        // 特殊处理PLAY按钮：检查体力
        if (button.id === 'play' && this.getEnergyInfo) {
          const energyInfo = this.getEnergyInfo();
          if (energyInfo && !energyInfo.hasEnough) {
            console.warn('体力不足，无法开始游戏');
            // TODO: 显示UI提示
            return null;
          }
        }
        
        return button.id;
      }
    }
    }
    
    // 检查导航点击
    const navHeight = 80;
    const navY = this.canvas.height - navHeight;
    if (y >= navY) {
      const itemCount = this.navItems.length;
      const itemWidth = this.canvas.width / itemCount;
      const index = Math.floor(x / itemWidth);
      if (index >= 0 && index < itemCount) {
        const item = this.navItems[index];
        console.log(`点击导航: ${item.id}`);
        return item.id;
      }
    }
    
    return null;
  }
  
  /**
   * 绘制体力信息（右上角）
   */
  drawEnergyInfo() {
    if (!this.getEnergyInfo) return;
    
    const energyInfo = this.getEnergyInfo();
    if (!energyInfo) return;
    
    const { ctx, canvas } = this;
    const energyWidth = 80;
    const energyHeight = 40;
    const margin = 15;
    const energyX = canvas.width - energyWidth - margin;
    const energyY = margin;
    
    // 保存画布状态
    ctx.save();
    
    // 绘制体力卡片背景（旋转-2度）
    ctx.translate(energyX + energyWidth / 2, energyY + energyHeight / 2);
    ctx.rotate(-2 * Math.PI / 180);
    ctx.translate(-energyWidth / 2, -energyHeight / 2);
    
    // 卡片阴影（手动绘制，4px偏移）
    ctx.fillStyle = '#322f22';
    ctx.fillRect(4, 4, energyWidth, energyHeight);
    
    // 卡片背景（使用表面容器高色）
    ctx.fillStyle = '#eae2cb'; // surfaceContainerHigh
    ctx.fillRect(0, 0, energyWidth, energyHeight);
    
    // 卡片边框
    ctx.strokeStyle = '#322f22';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, energyWidth, energyHeight);
    
    // 体力标题
    ctx.fillStyle = '#5f5b4d'; // onSurfaceVariant
    ctx.font = 'bold 7px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('ENERGY', energyWidth / 2, 5);
    
    // 体力值（大号显示）
    ctx.fillStyle = energyInfo.hasEnough ? '#993d46' : '#b02500'; // primary or error
    ctx.font = 'bold 16px Arial';
    ctx.textBaseline = 'middle';
    ctx.fillText(energyInfo.display, energyWidth / 2, energyHeight / 2 + 3);
    
    // 恢复倒计时
    ctx.fillStyle = '#5f5b4d'; // onSurfaceVariant
    ctx.font = 'bold 5px Arial';
    ctx.textBaseline = 'top';
    ctx.fillText(`恢复 ${energyInfo.nextRecovery}`, energyWidth / 2, energyHeight - 8);
    
    ctx.restore();
  }

  /**
   * 隐藏封面
   */
  hide() {
    this.active = false;
    console.log('封面隐藏');
  }
  
  /**
   * 显示封面
   */
  show() {
    this.active = true;
    console.log('封面显示');
  }
}