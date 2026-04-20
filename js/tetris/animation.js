/**
 * 帧动画类 - 用于播放TexturePacker打包的精灵图动画
 * 动态加载tplist文件解析帧数据，支持任意数量的图集
 */
export default class PengfuAnimation {
  // 是否启用动态加载tplist文件（如果为false，直接使用默认帧数据）
  static DYNAMIC_LOADING = false;

  constructor() {
    // 动画状态
    this.active = false;
    this.currentFrame = 0;
    this.frameDuration = 100; // 每帧显示时间（毫秒）
    this.lastUpdateTime = 0;
    this.loop = false; // 是否循环播放
    this.onComplete = null; // 动画完成回调
    
    // 资源加载状态
    this.frames = []; // 帧数据（从tplist解析）
    this.images = []; // 存储所有图集图像
    this.totalAtlases = 0; // 动态检测图集数量
    this.resourcesLoaded = false; // 所有资源（图像+帧数据）加载完成
    
    // 待处理的播放请求（资源加载完成前调用了play）
    this.pendingPlay = null;
    
    // 渲染位置和缩放
    this.x = 0;
    this.y = 0;
    this.scale = 1.0;
    
    // 开始异步加载所有资源
    this.loadAllResources();
  }
  
  /**
   * 加载所有资源（tplist帧数据和图像）
   */
  async loadAllResources() {
    console.log('开始加载动画资源...');
    
    try {
      // 1. 动态检测图集数量并加载tplist文件
      console.log('步骤1: 加载帧数据...');
      await this.loadFrameData();
      console.log('帧数据加载完成');
    } catch (error) {
      console.error('动态加载tplist文件失败，使用默认帧数据:', error);
      // 加载失败时创建默认帧数据
      this.createDefaultFrames();
    }
    
    console.log(`当前帧数据: ${this.frames.length}帧, 图集数: ${this.totalAtlases}`);
    
    try {
      // 2. 加载所有图集图像（无论帧数据加载成功与否都尝试）
      console.log('步骤2: 加载图集图像...');
      await this.loadAllImages();
      console.log('图集图像加载完成');
    } catch (error) {
      console.error('加载图集图像失败:', error);
      // 图像加载失败仍继续，可能部分图像无法显示
    }
    
    // 所有资源加载尝试完成，标记为已加载
    this.resourcesLoaded = true;
    console.log(`Pengfu动画资源加载完成: ${this.frames.length}帧, ${this.totalAtlases}个图集`);
    
    // 检查是否有待处理的播放请求
    this.checkPendingPlay();
  }
  
  /**
   * 创建默认帧数据（当动态加载失败时使用）
   */
  createDefaultFrames() {
    console.warn('=== 创建默认帧数据（动态加载失败）===');
    
    this.frames = [];
    this.totalAtlases = 5;
    const frameWidth = 432;
    const frameHeight = 576;
    
    for (let atlasIndex = 0; atlasIndex < this.totalAtlases; atlasIndex++) {
      const framesPerAtlas = (atlasIndex === 4) ? 1 : 12;
      for (let localFrameIndex = 0; localFrameIndex < framesPerAtlas; localFrameIndex++) {
        let x, y;
        if (framesPerAtlas === 12) {
          // 4x3网格布局
          const gridX = localFrameIndex % 4;
          const gridY = Math.floor(localFrameIndex / 4);
          x = gridX * frameWidth;
          y = gridY * frameHeight;
        } else {
          x = 0;
          y = 0;
        }
        this.frames.push({
          atlasIndex,
          x,
          y,
          width: frameWidth,
          height: frameHeight
        });
      }
    }
    
    console.log(`创建默认帧数据: ${this.frames.length}帧, ${this.totalAtlases}个图集`);
  }
  
  /**
   * 检查并执行待处理的播放请求
   */
  checkPendingPlay() {
    if (this.pendingPlay) {
      console.log('执行待处理的播放请求');
      const { x, y, scale, loop, onComplete } = this.pendingPlay;
      this.pendingPlay = null;
      this.startPlay(x, y, scale, loop, onComplete);
    }
  }
  
  /**
   * 动态加载tplist文件并解析帧数据
   */
  async loadFrameData() {
    this.frames = [];
    this.totalAtlases = 0;
    
    // 如果禁用动态加载，直接使用默认数据
    if (!PengfuAnimation.DYNAMIC_LOADING) {
      console.log('动态加载已禁用，使用默认帧数据');
      this.createDefaultFrames();
      console.log(`帧数据加载完成: ${this.frames.length}帧, ${this.totalAtlases}个图集`);
      return;
    }
    
    console.log('启用动态加载tplist文件...');
    try {
      // 微信小游戏环境
      if (typeof wx !== 'undefined') {
        await this.loadFrameDataWeChat();
      } else {
        // 浏览器环境（调试用）- 模拟加载
        await this.loadFrameDataMock();
      }
    } catch (error) {
      console.error('加载帧数据失败:', error);
    }
    
    // 如果未加载到任何帧数据，使用默认数据
    console.log(`检查帧数据: frames.length = ${this.frames.length}, totalAtlases = ${this.totalAtlases}`);
    if (this.frames.length === 0) {
      console.warn('未加载到帧数据，使用默认帧数据');
      this.createDefaultFrames();
    } else {
      console.log('帧数据加载成功，使用动态加载的数据');
    }
    
    console.log(`帧数据加载完成: ${this.frames.length}帧, ${this.totalAtlases}个图集`);
  }
  
  /**
   * 微信环境加载tplist文件
   */
  async loadFrameDataWeChat() {
    console.log('开始动态加载tplist帧数据...');
    
    let atlasIndex = 0;
    let hasMoreAtlases = true;
    
    // 尝试加载tplist文件，直到失败为止
    while (hasMoreAtlases) {
      try {
        console.log(`尝试加载图集 ${atlasIndex} 的tplist文件...`);
        const tplistData = await this.loadTplistFile(atlasIndex);
        if (tplistData && tplistData.frames) {
          console.log(`图集 ${atlasIndex} 加载成功，包含 ${tplistData.frames.length} 帧`);
          // 解析该图集的所有帧
          tplistData.frames.forEach((frameData, frameIndex) => {
            const rect = frameData.rect; // [x, y, width, height]
            this.frames.push({
              atlasIndex,
              x: rect[0],
              y: rect[1],
              width: rect[2],
              height: rect[3]
            });
          });
          
          atlasIndex++;
        } else {
          console.log(`图集 ${atlasIndex} 数据格式无效，停止检测`);
          hasMoreAtlases = false;
        }
      } catch (error) {
        // 加载失败，说明没有更多图集
        console.log(`图集 ${atlasIndex} 加载失败，停止检测:`, error.message);
        console.error('加载失败详情:', error);
        hasMoreAtlases = false;
        
        // 如果第一个图集就加载失败，抛出错误让外层处理
        if (atlasIndex === 0) {
          throw new Error(`第一个图集加载失败: ${error.message}`);
        }
      }
    }
    
    this.totalAtlases = atlasIndex;
    console.log(`动态检测到 ${this.totalAtlases} 个图集，共 ${this.frames.length} 帧`);
  }
  
  /**
   * 加载单个tplist文件
   */
  loadTplistFile(atlasIndex) {
    return new Promise((resolve, reject) => {
      const filePath = `subpackages/animation/images/pengfu-${atlasIndex}.tplist`;
      console.log(`尝试加载tplist文件: ${filePath}`);
      
      // 优先使用微信文件系统API加载本地JSON文件
      if (typeof wx !== 'undefined' && wx.getFileSystemManager) {
        const fs = wx.getFileSystemManager();
        fs.readFile({
          filePath,
          encoding: 'utf8',
          success: (res) => {
            try {
              const data = JSON.parse(res.data);
              resolve(data);
            } catch (e) {
              reject(e);
            }
          },
          fail: (err) => {
            // 文件系统API失败，尝试使用wx.request
            if (wx.request) {
              this.loadTplistFileViaRequest(filePath).then(resolve).catch(reject);
            } else {
              reject(err);
            }
          }
        });
      } else if (typeof wx !== 'undefined' && wx.request) {
        // 备选方案：使用wx.request
        this.loadTplistFileViaRequest(filePath).then(resolve).catch(reject);
      } else {
        reject(new Error('无法加载tplist文件：环境不支持'));
      }
    });
  }
  
  /**
   * 通过wx.request加载tplist文件（备选方案）
   */
  loadTplistFileViaRequest(filePath) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: filePath,
        dataType: 'json',
        success: (res) => {
          if (res.statusCode === 200 && res.data) {
            resolve(res.data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  }
  
  /**
   * 浏览器环境模拟加载（调试用）
   */
  async loadFrameDataMock() {
    console.warn('非微信环境，使用模拟帧数据');
    
    // 模拟当前资源结构：5个图集，前4个各12帧，最后一个1帧
    this.totalAtlases = 5;
    const frameWidth = 432;
    const frameHeight = 576;
    
    for (let atlasIndex = 0; atlasIndex < this.totalAtlases; atlasIndex++) {
      const framesPerAtlas = (atlasIndex === 4) ? 1 : 12;
      for (let localFrameIndex = 0; localFrameIndex < framesPerAtlas; localFrameIndex++) {
        let x, y;
        if (framesPerAtlas === 12) {
          // 4x3网格布局
          const gridX = localFrameIndex % 4;
          const gridY = Math.floor(localFrameIndex / 4);
          x = gridX * frameWidth;
          y = gridY * frameHeight;
        } else {
          x = 0;
          y = 0;
        }
        this.frames.push({
          atlasIndex,
          x,
          y,
          width: frameWidth,
          height: frameHeight
        });
      }
    }
    
    console.log(`模拟生成${this.frames.length}帧动画数据`);
  }
  
  /**
   * 加载所有图集图像
   */
  async loadAllImages() {
    console.log(`loadAllImages: totalAtlases = ${this.totalAtlases}`);
    if (this.totalAtlases === 0) {
      console.warn('没有检测到图集，跳过图像加载');
      return Promise.resolve();
    }
    
    let subpackageLoaded = false;
    
    // 在微信环境中，先确保分包已加载
    if (typeof wx !== 'undefined' && wx.loadSubpackage) {
      try {
        console.log('尝试加载动画分包...');
        const subpackage = await new Promise((resolve, reject) => {
          wx.loadSubpackage({
            name: 'animation',
            success: resolve,
            fail: reject
          });
        });
        console.log('动画分包加载成功:', subpackage);
        subpackageLoaded = true;
      } catch (error) {
        console.error('动画分包加载失败，图片可能无法加载:', error);
        console.error('错误详情:', error.message, error.stack);
        subpackageLoaded = false;
      }
    }
    
    console.log(`分包加载状态: ${subpackageLoaded ? '成功' : '失败或未尝试'}`);
    
    return new Promise((resolve) => {
      // 微信小游戏环境使用wx.createImage()
      if (typeof wx !== 'undefined' && wx.createImage) {
        let imagesLoaded = 0;
        console.log(`开始加载 ${this.totalAtlases} 个图集图像`);
        
        const pathFormats = [
          'subpackages/animation/images/pengfu-__INDEX__.png'
        ];
        
        for (let i = 0; i < this.totalAtlases; i++) {
          const image = wx.createImage();
          
          // 为每个图像创建重试逻辑
          const tryLoadImage = (formatIndex) => {
            if (formatIndex >= pathFormats.length) {
              // 所有格式都尝试过了，仍然失败
              console.error(`Pengfu动画图像 ${i} 所有路径格式都加载失败`);
              imagesLoaded++;
              if (imagesLoaded === this.totalAtlases) {
                console.log('所有Pengfu动画图像加载尝试完成（可能全部失败）');
                resolve();
              }
              return;
            }
            
            const src = pathFormats[formatIndex].replace('__INDEX__', i);
            console.log(`加载图像 ${i}，尝试格式 ${formatIndex}: ${src}`);
            image.src = src;
            
            // 临时存储当前格式索引
            image._currentFormat = formatIndex;
            image._src = src;
          };
          
          image.onload = () => {
            console.log(`Pengfu动画图像 ${i} 加载成功 (格式 ${image._currentFormat}: ${image._src})`);
            imagesLoaded++;
            if (imagesLoaded === this.totalAtlases) {
              console.log(`所有Pengfu动画图像加载完成，成功 ${this.totalAtlases - imagesFailed} 个，失败 ${imagesFailed} 个`);
              resolve();
            }
          };
          
          let imagesFailed = 0;
          image.onerror = (err) => {
            console.error(`Pengfu动画图像 ${i} 格式 ${image._currentFormat} 加载失败:`, err);
            console.error(`失败详情: src="${image._src}", error=${err?.message || err}`);
            
            // 尝试下一个格式
            const nextFormatIndex = image._currentFormat + 1;
            if (nextFormatIndex < pathFormats.length) {
              console.log(`图像 ${i} 尝试下一个格式 ${nextFormatIndex}`);
              setTimeout(() => tryLoadImage(nextFormatIndex), 10);
            } else {
              // 所有格式都失败了
              console.error(`图像 ${i} 所有格式都加载失败`);
              imagesFailed++;
              imagesLoaded++;
              if (imagesLoaded === this.totalAtlases) {
                console.log(`所有Pengfu动画图像加载尝试完成，成功 ${this.totalAtlases - imagesFailed} 个，失败 ${imagesFailed} 个`);
                resolve();
              }
            }
          };
          
          // 开始尝试加载第一个格式
          tryLoadImage(0);
          this.images[i] = image;
        }
      } else {
        // 浏览器环境（调试用）
        console.warn('非微信环境，跳过图像加载');
        resolve();
      }
    });
  }
  
  /**
   * 开始播放动画
   * @param {number} x - 屏幕X坐标
   * @param {number} y - 屏幕Y坐标
   * @param {number} scale - 缩放比例
   * @param {boolean} loop - 是否循环
   * @param {Function} onComplete - 完成回调
   */
  play(x, y, scale = 1.0, loop = false, onComplete = null) {
    if (!this.resourcesLoaded) {
      console.warn('动画资源未加载，保存播放请求等待资源加载完成');
      this.pendingPlay = { x, y, scale, loop, onComplete };
      return;
    }
    
    this.startPlay(x, y, scale, loop, onComplete);
  }
  
  /**
   * 实际开始播放动画（内部方法）
   */
  startPlay(x, y, scale = 1.0, loop = false, onComplete = null) {
    if (this.frames.length === 0) {
      console.error('无法播放动画：帧数据为空，请检查资源加载');
      return;
    }
    
    this.active = true;
    this.currentFrame = 0;
    this.x = x;
    this.y = y;
    this.scale = scale;
    this.loop = loop;
    this.onComplete = onComplete;
    this.lastUpdateTime = Date.now();
    
    console.log(`开始播放Pengfu动画，位置: (${x}, ${y})，缩放: ${scale}，帧数: ${this.frames.length}`);
  }
  
  /**
   * 停止动画
   */
  stop() {
    console.log('停止动画播放');
    this.active = false;
    if (this.onComplete) {
      this.onComplete();
      this.onComplete = null;
    }
  }
  
  /**
   * 更新动画状态
   * @param {number} currentTime - 当前时间（毫秒）
   */
  update(currentTime) {
    if (!this.active) {
      // console.log('更新跳过: 动画未激活');
      return;
    }
    if (!this.resourcesLoaded) {
      // console.log('更新跳过: 资源未加载');
      return;
    }
    
    const elapsed = currentTime - this.lastUpdateTime;

    if (elapsed >= this.frameDuration) {
      this.currentFrame++;

      
      // 检查是否播放完毕
      if (this.currentFrame >= this.frames.length) {
        if (this.loop) {
          this.currentFrame = 0;
        } else {
          this.stop();
          return;
        }
      }
      
      this.lastUpdateTime = currentTime;
    }
  }
  
  /**
   * 渲染当前帧
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   */
  render(ctx) {
    if (!this.active) {
      //console.log('渲染跳过: 动画未激活');
      return;
    }
    if (!this.resourcesLoaded) {
      console.log('渲染跳过: 资源未加载');
      return;
    }
    if (this.currentFrame >= this.frames.length) {
      console.log(`渲染跳过: 当前帧 ${this.currentFrame} 超出范围 (总帧数: ${this.frames.length})`);
      return;
    }
    
    const frame = this.frames[this.currentFrame];

    const scaledWidth = frame.width * this.scale;
    const scaledHeight = frame.height * this.scale;
    // 裁剪上半身（高度减半）
    const sourceHeight = frame.height / 2;
    const destHeight = scaledHeight / 2;
    const drawX = this.x - scaledWidth / 2;
    // 以中心点y为基准，居中绘制裁剪后的上半身
    const drawY = this.y - destHeight / 2;
    
    // 获取对应图集的图像
    const image = this.images[frame.atlasIndex];
    if (!image) {
      console.warn(`图集 ${frame.atlasIndex} 图像未加载，绘制占位符`);
      // 绘制占位符：红色边框矩形，内部半透明红色
      ctx.save();
      ctx.strokeStyle = '#ff0000';
      ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
      ctx.lineWidth = 2;
      ctx.fillRect(drawX, drawY, scaledWidth, destHeight);
      ctx.strokeRect(drawX, drawY, scaledWidth, destHeight);
      
      // 绘制文字
      ctx.fillStyle = '#ff0000';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('图片加载失败', this.x, drawY + destHeight / 2);
      ctx.restore();
      return;
    }
    
    ctx.save();
    
    // 绘制精灵图当前帧
    ctx.drawImage(
      image,
      frame.x, frame.y, frame.width, sourceHeight,
      drawX, drawY,
      scaledWidth, destHeight
    );
    
    ctx.restore();
  }
  
  /**
   * 检查动画是否正在播放
   * @returns {boolean}
   */
  isPlaying() {
    return this.active && this.resourcesLoaded;
  }
  
  /**
   * 设置动画速度（帧持续时间）
   * @param {number} duration - 每帧持续时间（毫秒）
   */
  setFrameDuration(duration) {
    this.frameDuration = Math.max(16, duration); // 最小16ms（约60fps）
  }
  
  /**
   * 获取第一帧的尺寸（用于计算缩放比例）
   * @returns {{width: number, height: number} | null}
   */
  getFirstFrameSize() {
    if (this.frames.length > 0) {
      const firstFrame = this.frames[0];
      return {
        width: firstFrame.width,
        height: firstFrame.height
      };
    }
    return null;
  }
}