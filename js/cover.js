/**
 * 游戏封面类
 * 参考 ui/cover.html 设计
 */
export default class Cover {
  constructor(ctx, getEnergyInfo = null, onPrivacyAction = null) {
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
    
    // 隐私协议状态
    this.privacyAgreed = false; // 初始状态为未同意
    this.privacyCheckbox = { id: 'privacyCheckbox', x: 0, y: 0, size: 20 };
    this.privacyText = '我已详细阅读并同意<用户服务协议>和<隐私保护政策>';
    this.privacyLinks = {
      terms: { id: 'termsLink', text: '用户服务协议' },
      privacy: { id: 'privacyLink', text: '隐私保护政策' }
    };
    
    // 回调函数
    this.getEnergyInfo = getEnergyInfo;
    this.onPrivacyAction = onPrivacyAction;
    
    // 隐私协议状态管理
    this.privacyPending = false; // 授权进行中标志
    
    // 隐私授权弹窗
    this.privacyModal = {
      show: false, // 是否显示弹窗
      title: '隐私协议确认',
      message: '请确认您已详细阅读并同意用户服务协议和隐私保护政策',
      checkbox: {
        checked: false, // 弹窗内勾选框状态
        x: 0,
        y: 0,
        size: 20
      },
      confirmButton: {
        id: 'agree-btn',
        text: '确认同意',
        x: 0,
        y: 0,
        width: 120,
        height: 40,
        color: '#4CAF50'
      },
      cancelButton: {
        id: 'privacyCancel',
        text: '取消',
        x: 0,
        y: 0,
        width: 80,
        height: 40,
        color: '#757575'
      }
    };
    
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

    // 绘制隐私协议确认弹窗（如果有）
    this.drawPrivacyModal(ctx, canvas);
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
   * 显示隐私协议确认弹窗
   * @param {boolean} useCurrentAgreed 是否使用当前隐私协议同意状态作为默认勾选状态
   */
   showPrivacyModal(useCurrentAgreed = true) {
     console.log('显示隐私协议确认弹窗（已改用微信原生Modal），useCurrentAgreed:', useCurrentAgreed);
     // 使用微信原生Modal，Canvas弹窗不显示
     this.privacyModal.show = false;
     this.privacyModal.checkbox.checked = useCurrentAgreed ? this.privacyAgreed : false;
     console.log('弹窗状态: show=', this.privacyModal.show, 'checkbox.checked=', this.privacyModal.checkbox.checked);
   }

  /**
   * 隐藏隐私协议确认弹窗
   */
  hidePrivacyModal() {
    console.log('隐藏隐私协议确认弹窗');
    this.privacyModal.show = false;
  }

  /**
   * 绘制隐私协议确认弹窗
   */
  drawPrivacyModal(ctx, canvas) {
    if (!this.privacyModal.show) return;

    const modal = this.privacyModal;
    const modalWidth = Math.min(canvas.width - 80, 500);
    const modalHeight = 280;
    const modalX = (canvas.width - modalWidth) / 2;
    const modalY = (canvas.height - modalHeight) / 2;

    // 绘制半透明背景
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // 绘制弹窗背景
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#DDDDDD';
    ctx.lineWidth = 1;
    // 绘制圆角矩形（简化版，使用普通矩形）
    this.drawRoundedRect(ctx, modalX, modalY, modalWidth, modalHeight, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 绘制标题
    ctx.save();
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(modal.title, modalX + modalWidth / 2, modalY + 40);
    ctx.restore();

    // 绘制消息
    ctx.save();
    ctx.fillStyle = '#666666';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    const messageLines = this.wrapText(ctx, modal.message, modalWidth - 80);
    const lineHeight = 20;
    messageLines.forEach((line, index) => {
      ctx.fillText(line, modalX + 40, modalY + 80 + index * lineHeight);
    });
    ctx.restore();

    // 绘制勾选框区域
    const checkbox = modal.checkbox;
    checkbox.x = modalX + 40;
    checkbox.y = modalY + 140;
    
    // 绘制勾选框边框
    ctx.save();
    ctx.strokeStyle = checkbox.checked ? '#4CAF50' : '#888888';
    ctx.lineWidth = 2;
    ctx.strokeRect(checkbox.x, checkbox.y, checkbox.size, checkbox.size);
    
    // 如果已勾选，绘制对勾
    if (checkbox.checked) {
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(checkbox.x + 4, checkbox.y + 4, checkbox.size - 8, checkbox.size - 8);
      
      // 绘制白色对勾
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(checkbox.x + 6, checkbox.y + checkbox.size / 2);
      ctx.lineTo(checkbox.x + checkbox.size / 2, checkbox.y + checkbox.size - 6);
      ctx.lineTo(checkbox.x + checkbox.size - 6, checkbox.y + 8);
      ctx.stroke();
    }
    ctx.restore();

    // 绘制勾选框文本
    ctx.save();
    ctx.fillStyle = '#333333';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('我已详细阅读并同意上述隐私协议', 
                 checkbox.x + checkbox.size + 10, 
                 checkbox.y + checkbox.size / 2 + 4);
    ctx.restore();

    // 计算按钮位置
    const buttonSpacing = 20;
    const totalButtonWidth = modal.confirmButton.width + buttonSpacing + modal.cancelButton.width;
    const buttonStartX = modalX + (modalWidth - totalButtonWidth) / 2;
    
    // 更新确认按钮坐标
    modal.confirmButton.x = buttonStartX;
    modal.confirmButton.y = modalY + modalHeight - 70;
    
    // 绘制确认按钮
    this.drawButton(ctx, modal.confirmButton, 8, modal.confirmButton.color, '#FFFFFF');

    // 更新取消按钮坐标
    modal.cancelButton.x = buttonStartX + modal.confirmButton.width + buttonSpacing;
    modal.cancelButton.y = modalY + modalHeight - 70;
    
    // 绘制取消按钮
    this.drawButton(ctx, modal.cancelButton, 8, modal.cancelButton.color, '#FFFFFF');
  }

  /**
   * 文本换行工具函数
   */
  wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + ' ' + word).width;
      if (width < maxWidth) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  }

  /**
   * 处理弹窗内的点击
   * @returns {string|null} 被点击的元素ID
   */
  handleModalClick(x, y) {
    if (!this.privacyModal.show) return null;

    const modal = this.privacyModal;
    
    // 检查勾选框点击
    const checkbox = modal.checkbox;
    if (x >= checkbox.x && x <= checkbox.x + checkbox.size &&
        y >= checkbox.y && y <= checkbox.y + checkbox.size) {
      console.log('点击弹窗内勾选框，当前状态:', modal.checkbox.checked);
      modal.checkbox.checked = !modal.checkbox.checked;
      return 'privacyModalCheckbox';
    }
    
    // 检查确认按钮点击
    const confirmButton = modal.confirmButton;
    if (x >= confirmButton.x && x <= confirmButton.x + confirmButton.width &&
        y >= confirmButton.y && y <= confirmButton.y + confirmButton.height) {
      console.log('点击弹窗确认按钮');
      return 'agree-btn';
    }
    
    // 检查取消按钮点击
    const cancelButton = modal.cancelButton;
    if (x >= cancelButton.x && x <= cancelButton.x + cancelButton.width &&
        y >= cancelButton.y && y <= cancelButton.y + cancelButton.height) {
      console.log('点击弹窗取消按钮');
      return 'privacyCancel';
    }
    
    return null;
  }

  /**
   * 绘制圆角矩形
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
   * 渲染封面
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
    const buttonStartY = canvas.height / 2 + 150;
    
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
    
    //console.log(`PLAY按钮坐标: x=${playButton.x}, y=${playButton.y}, width=${playButton.width}, height=${playButton.height}, canvas=${canvas.width}x${canvas.height}`);
    this.drawButton(ctx, playButton, 0, buttonColor, textColor, isDisabled);
    
    // 绘制隐私协议勾选框
    this.drawPrivacyAgreement(ctx, canvas, playButton);
  }
  
  /**
   * 绘制隐私协议勾选框和文本
   */
  drawPrivacyAgreement(ctx, canvas, playButton) {
    const checkboxSize = this.privacyCheckbox.size;
    const isAgreed = this.getPrivacyAgreed();
    
    // 计算整个隐私协议区域的宽度
    ctx.font = '12px Arial';
    const prefixText = '我已详细阅读并同意';
    const prefixWidth = ctx.measureText(prefixText).width;
    const termsLink = this.privacyLinks.terms;
    const termsWidth = ctx.measureText(termsLink.text).width;
    const andText = '和';
    const andWidth = ctx.measureText(andText).width;
    const privacyLink = this.privacyLinks.privacy;
    const privacyWidth = ctx.measureText(privacyLink.text).width;
    
    // 整个区域的宽度 = 勾选框 + 间隔 + 文本总宽度
    const totalWidth = checkboxSize + 10 + prefixWidth + termsWidth + andWidth + privacyWidth;
    
    // 计算起始x坐标，使整个区域居中
    const startX = (canvas.width - totalWidth) / 2;
    const checkboxX = startX;
    const checkboxY = playButton.y + playButton.height + 30; // PLAY按钮下方30像素
    
    // 更新勾选框坐标
    this.privacyCheckbox.x = checkboxX;
    this.privacyCheckbox.y = checkboxY;
    // console.log(`更新勾选框坐标: x=${checkboxX}, y=${checkboxY}, playButton.y=${playButton.y}, playButton.height=${playButton.height}`);
    
    // 绘制勾选框边框
    ctx.save();
    ctx.strokeStyle = isAgreed ? '#4CAF50' : '#888888';
    ctx.lineWidth = 2;
    ctx.strokeRect(checkboxX, checkboxY, checkboxSize, checkboxSize);
    
    // 如果已勾选，绘制对勾
    if (isAgreed) {
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(checkboxX + 4, checkboxY + 4, checkboxSize - 8, checkboxSize - 8);
      
      // 绘制白色对勾
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(checkboxX + 6, checkboxY + checkboxSize / 2);
      ctx.lineTo(checkboxX + checkboxSize / 2, checkboxY + checkboxSize - 6);
      ctx.lineTo(checkboxX + checkboxSize - 6, checkboxY + 8);
      ctx.stroke();
    }
    ctx.restore();
    
    // 绘制协议文本
    ctx.fillStyle = isAgreed ? '#333333' : '#888888';
    ctx.textAlign = 'left';
    const textX = checkboxX + checkboxSize + 10;
    const textY = checkboxY + checkboxSize / 2 + 4;
    
    // 绘制"我已详细阅读并同意"
    ctx.fillText(prefixText, textX, textY);
    
    // 绘制"用户服务协议"链接
    const termsLinkX = textX + prefixWidth;
    ctx.fillStyle = '#0066CC';
    ctx.fillText(termsLink.text, termsLinkX, textY);
    
    // 绘制下划线
    ctx.beginPath();
    ctx.moveTo(termsLinkX, textY + 2);
    ctx.lineTo(termsLinkX + termsWidth, textY + 2);
    ctx.strokeStyle = '#0066CC';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // 绘制"和"字
    ctx.fillStyle = '#333333';
    ctx.fillText(andText, termsLinkX + termsWidth, textY);
    
    // 绘制"隐私保护政策"链接
    const privacyLinkX = termsLinkX + termsWidth + andWidth;
    ctx.fillStyle = '#0066CC';
    ctx.fillText(privacyLink.text, privacyLinkX, textY);
    
    // 绘制下划线
    ctx.beginPath();
    ctx.moveTo(privacyLinkX, textY + 2);
    ctx.lineTo(privacyLinkX + privacyWidth, textY + 2);
    ctx.strokeStyle = '#0066CC';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // 保存链接区域用于点击检测
    termsLink.x = termsLinkX;
    termsLink.y = textY - 12; // 文本基线以上
    termsLink.width = termsWidth;
    termsLink.height = 16;
    
    privacyLink.x = privacyLinkX;
    privacyLink.y = textY - 12;
    privacyLink.width = privacyWidth;
    privacyLink.height = 16;
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
    
    console.log(`点击坐标: x=${x}, y=${y}, canvas=${this.canvas.width}x${this.canvas.height}`);
    
    // 首先检查弹窗点击（如果弹窗显示）
    if (this.privacyModal.show) {
      const modalResult = this.handleModalClick(x, y);
      if (modalResult) {
        console.log('弹窗点击结果:', modalResult);
        return modalResult;
      }
      // 如果点击了弹窗区域外，可以关闭弹窗或忽略
      // 这里我们忽略弹窗外点击，让用户必须点击按钮
      return null;
    }
    
    // 检查按钮点击
    for (const button of this.buttons) {
      if (x >= button.x && x <= button.x + button.width &&
          y >= button.y && y <= button.y + button.height) {
        console.log(`点击按钮: ${button.id}`);
        
        // 特殊处理PLAY按钮：检查体力和隐私协议
        if (button.id === 'play') {
          // 检查隐私协议 - 通过回调获取最新状态
          if (!this.getPrivacyAgreed()) {
            console.warn('请先同意用户服务协议和隐私保护政策');
            // TODO: 显示UI提示
            return null;
          }
          
          // 检查体力
          if (this.getEnergyInfo) {
            const energyInfo = this.getEnergyInfo();
            //console.log('PLAY按钮点击，体力信息:', energyInfo);
            if (energyInfo && !energyInfo.hasEnough) {
              console.warn('体力不足，无法开始游戏');
              // TODO: 显示UI提示
              return null;
            }
          }
        }
        
        return button.id;
      }
    }
    
    console.log('未命中任何按钮，按钮坐标:', JSON.stringify(this.buttons));
    
    // 检查隐私协议勾选框点击
    const checkbox = this.privacyCheckbox;
    console.log(`勾选框坐标: x=${checkbox.x}-${checkbox.x + checkbox.size}, y=${checkbox.y}-${checkbox.y + checkbox.size}, 点击坐标: x=${x}, y=${y}`);
    if (x >= checkbox.x && x <= checkbox.x + checkbox.size &&
        y >= checkbox.y && y <= checkbox.y + checkbox.size) {
      console.log('点击隐私协议勾选框，当前状态:', this.privacyAgreed);
      
      // 立即切换本地状态，提供视觉反馈
      const oldState = this.privacyAgreed;
      this.privacyAgreed = !this.privacyAgreed;
      this.privacyPending = true; // 标记授权进行中
      console.log('勾选框点击: 状态从', oldState, '切换到', this.privacyAgreed, 'pending:', this.privacyPending);
      
      // 如果用户勾选了（同意），不显示弹窗，等待wx.requirePrivacyAuthorize触发
      if (this.privacyAgreed) {
        console.log('用户同意隐私协议，等待wx.requirePrivacyAuthorize触发弹窗');
        // 弹窗将在wx.onNeedPrivacyAuthorization回调中显示
      }
      
      // 通过回调函数处理隐私协议勾选框点击
      if (this.onPrivacyAction) {
        console.log('调用onPrivacyAction(checkboxClick)');
        this.onPrivacyAction('checkboxClick');
      } else {
        console.warn('onPrivacyAction回调不存在！');
      }
      return 'privacyCheckbox';
    }
    
    // 检查协议链接点击
    for (const linkKey of ['terms', 'privacy']) {
      const link = this.privacyLinks[linkKey];
      if (link.x && link.y && link.width && link.height) {
        if (x >= link.x && x <= link.x + link.width &&
            y >= link.y && y <= link.y + link.height) {
          console.log(`点击协议链接: ${link.id}`);
          
          // 通过回调函数处理协议链接点击
          if (this.onPrivacyAction) {
            this.onPrivacyAction(`${linkKey}Click`);
          }
          return link.id;
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
   * 设置隐私协议同意状态
   * @param {boolean} agreed - 是否已同意
   */
  setPrivacyAgreed(agreed) {
    console.log('setPrivacyAgreed: 设置状态为', agreed, '之前状态:', this.privacyAgreed, 'pending:', this.privacyPending);
    this.privacyAgreed = agreed;
    this.privacyPending = false; // 授权完成，清除pending标志
  }
  
  /**
   * 获取隐私协议同意状态
   * @returns {boolean} 是否已同意隐私协议
   */
  getPrivacyAgreed() {
    // 如果授权进行中，直接返回本地状态，避免被回调覆盖
    if (this.privacyPending) {
      console.log('getPrivacyAgreed: 授权进行中，直接返回本地状态:', this.privacyAgreed);
      return this.privacyAgreed;
    }
    
    // 如果有回调函数，通过回调获取状态
    if (this.onPrivacyAction) {
      const result = this.onPrivacyAction('getAgreedStatus');
      //console.log('getPrivacyAgreed: 回调返回', result, '本地状态:', this.privacyAgreed);
      if (typeof result === 'boolean') {
        this.privacyAgreed = result;
        console.log('getPrivacyAgreed: 更新本地状态为', this.privacyAgreed);
      }
    } else {
      console.log('getPrivacyAgreed: 无回调，返回本地状态:', this.privacyAgreed);
    }
    return this.privacyAgreed;
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