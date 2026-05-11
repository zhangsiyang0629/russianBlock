const cvs = wx.createCanvas();
if (typeof GameGlobal !== 'undefined') {
  GameGlobal.canvas = cvs;
}

// 尝试获取窗口信息
let windowInfo;
try {
  windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
} catch (error) {
  console.warn('获取窗口信息失败，使用默认值:', error);
  windowInfo = {
    screenWidth: 375,
    screenHeight: 667,
    windowWidth: 375,
    windowHeight: 667,
  };
}

cvs.width = windowInfo.windowWidth || windowInfo.screenWidth;
cvs.height = windowInfo.windowHeight || windowInfo.screenHeight;