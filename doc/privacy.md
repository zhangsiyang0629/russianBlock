# 小游戏隐私合规开发指南

## 流程
1. C端隐私授权交互，可以自定义设计更符合游戏风格的弹窗样式，包括但不限于点击按钮同意授权式、勾选同意授权式，也可以采用隐私弹窗组件；
2. 上报用户授权信息，自定义设置的曝光、用户同意隐私政策与否都需要上报小游戏平台，以正常调用用户数据接口。

## 标准API处理用户个人信息
| 用户信息类型 | 接口或组件 |
| :--- | :--- |
| 昵称、头像 | `wx.getUserName`, `wx.getUserProfile`, `wx.createUserInfoButton` |
| 位置信息 | `wx.authorize({scope:'scope.userLocation'})`, `wx.authorize({scope: 'scope.userLocationBackground'})`, `wx.getLocation`, `wx.getFuzzyLocation` |
| 微信运动步数 | `wx.authorize({scope: 'scope.werun'})`, `wx.getWeRunData` |
| 选中的照片或视频信息 | `wx.chooseImage`, `wx.chooseMedia` |
| 选中的文件 | `wx.chooseMessageFile` |
| 麦克风 | `wx.authorize({scope: 'scope.record'})`, `wx.startRecord`, `RecorderManager.start`, `RecorderManager.stop` |
| 摄像头 | `wx.authorize({scope: 'scope.camera'})`, `wx.createVKSession`, `wx.createCamera` |
| 蓝牙 | `wx.openBluetoothAdapter`, `wx.createBLEPeripheralServer` |
| 相册（仅写入）权限 | `wx.authorize({scope: 'scope.writePhotosAlbum'})`, `wx.saveImageToPhotosAlbum` |
| 微信朋友关系 | `wx.getFriendCloudStorage`, `wx.getGroupCloudStorage`, `wx.getGroupInfo`, `wx.getPotentialFriendList`, `wx.getUserCloudStorageKeys`, `GameServerManager.getFriendsStateData`, `wx.getUserInteractiveStorage` |
| 游戏社区数据 | `wx.getGameClubData` |
| 直播数据 | `wx.getChannelsLiveInfo` |
| 加速传感器 | `wx.stopAccelerometer`, `wx.startAccelerometer`, `wx.onAccelerometerChange`, `wx.offAccelerometerChange` |
| 磁场传感器 | `wx.stopCompass`, `wx.startCompass`, `wx.onCompassChange`, `wx.offCompassChange` |
| 方向传感器 | `wx.stopDeviceMotionListening`, `wx.startDeviceMotionListening`, `wx.onDeviceMotionChange`, `wx.offDeviceMotionChange` |
| 陀螺仪传感器 | `wx.stopGyroscope`, `wx.startGyroscope`, `wx.onGyroscopeChange`, `wx.offGyroscopeChange` |
| 剪切板 | `wx.setClipboardData`, `wx.getClipboardData` |

## 自定义设置授权
1. 注册实现自定义隐私弹窗的回调函数，即通过 wx.onNeedPrivacyAuthorization传入回调函数的方式来实现自定义模式。
```
wx.onNeedPrivacyAuthorization(resolve => {
    // ------ 自定义设置逻辑 ------ 
    // TODO：开发者弹出自定义的隐私弹窗（如果是勾选样式，开发者应在此实现自动唤出隐私勾选页面）
    // 页面展示给用户时，开发者调用 resolve({ event: 'exposureAuthorization' }) 告知平台隐私弹窗页面已曝光
    // 用户表示同意后，开发者调用 resolve({ event: 'agree' }) 告知平台用户已经同意，resolve要求用户有过点击行为。
    // 用户表示拒绝后，开发者调用 resolve({ event: 'disagree' }) 告知平台用户已经拒绝，resolve要求用户有过点击行为。
    // 是否需要控制间隔以及间隔时间，开发者可以自行实现
    // 勾选样式应以用户确认按钮的点击为准，无需每次勾选都上报
    // 如果需要主动弹窗见wx.requirePrivacyAuthorize
})

// 弹窗界面需带上《隐私保护指引》的链接，点击后调用wx.openPrivacyContract打开指引详情
wx.openPrivacyContract({
    success: () => {}, // 打开成功
    fail: () => {}, // 打开失败
    complete() => {}
})
```
  - 注意
    - 隐私弹窗页面曝光、用户同意、用户拒绝需上报小游戏平台
    - 隐私政策链接必须使用wx.openPrivacyContract接口打开
2. 主动展示弹窗请求用户同意，在调用相关接口之前如果没有获得用户同意，基础库会主动弹出曝光自定义弹窗以获取用户的同意授权（“非标准API”需要开发者自行适配）。开发者可以自行在处理用户个人信息之前选择任意合适时机拉起隐私弹窗以获取用户的同意授权。
```
// 调用wx.requirePrivacyAuthorize拉起自定义隐私弹窗
// 若用户已同意且隐私政策无变更则直接跳过用户确认阶段进入success回调，否则需要拉起隐私弹窗，请求用户确认（通过调用wx.onNeedPrivacyAuthorization注册的回调函数来拉起自定义的隐私弹窗），用户同意后才进入success回调
wx.requirePrivacyAuthorize({
    success: res => {
        // 进入success回调说明用户已同意隐私政策
        // TODO：非标准API的方式处理用户个人信息
    },
    fail: () => {
        // 进入fail回调说明用户拒绝隐私政策
        // 游戏需要放弃处理用户个人信息，同时不要阻断游戏主流程
    },
    complete() 
}) 
```

