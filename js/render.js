GameGlobal.canvas = wx.createCanvas();

// 尝试获取窗口信息，如果失败（可能是隐私授权未通过）则使用默认值
let windowInfo;
try {
  windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
} catch (error) {
  console.warn('获取窗口信息失败，使用默认值:', error);
  // 默认值，大部分手机屏幕尺寸
  windowInfo = {
    screenWidth: 375,
    screenHeight: 667
  };
}

canvas.width = windowInfo.screenWidth;
canvas.height = windowInfo.screenHeight;

export const SCREEN_WIDTH = windowInfo.screenWidth;
export const SCREEN_HEIGHT = windowInfo.screenHeight;