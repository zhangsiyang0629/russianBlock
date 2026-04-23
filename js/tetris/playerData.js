const CLOUD_ENV = 'cloudbase-d5gyz0rzwf3c9a078';

const LOCAL_STORAGE_KEY = 'playerData';

let cloudInitialized = false;

function initCloud() {
  if (cloudInitialized) return true;
  if (typeof wx === 'undefined' || !wx.cloud) {
    console.warn('微信云开发不可用');
    return false;
  }
  try {
    wx.cloud.init({ env: CLOUD_ENV, traceUser: true });
    cloudInitialized = true;
    console.log('云开发初始化成功');
    return true;
  } catch (err) {
    console.error('云开发初始化失败:', err);
    return false;
  }
}

async function getOpenId() {
  if (typeof wx === 'undefined' || !wx.cloud) return null;
  try {
    const loginRes = await wx.cloud.callFunction({
      name: 'login'
    });
    return loginRes.result.openid;
  } catch (err) {
    console.warn('获取openid失败:', err);
    return null;
  }
}

function getDefaultNickname() {
  const randomStr = Math.random().toString().slice(2, 8);
  return `游客${Date.now()}${randomStr}`;
}

function getDefaultAvatar() {
  return 'images/default-avatar.png';
}

async function getOrCreatePlayerData() {
  if (initCloud()) {
    try {
      const db = wx.cloud.database();
      // 获取当前用户的openid
      const openid = await getOpenId();
      
      if (!openid) {
        throw new Error('无法获取openid，降级到本地存储');
      }
      
      // 使用openid精确查询当前用户的数据
      const result = await db.collection('player_data').where({
        _openid: openid
      }).get();
      console.log('使用openid查询结果:', result.data.length, '条数据', openid);
      
      if (result.data.length > 0) {
        return result.data[0];
      }
      
      // 创建新用户数据
      const defaultData = {
        nickname: getDefaultNickname(),
        avatarUrl: getDefaultAvatar(),
        highScore: 0,
        level: 1,
        updateTime: db.serverDate()
      };
      await db.collection('player_data').add({ data: defaultData });
      
      // 重新查询新创建的数据
      const newResult = await db.collection('player_data').where({
        _openid: openid
      }).get();
      return newResult.data[0] || null;
    } catch (err) {
      console.error('云数据库操作失败，降级到本地存储:', err);
    }
  }
  return getLocalPlayerData();
}

function getLocalPlayerData() {
  try {
    const savedData = wx.getStorageSync(LOCAL_STORAGE_KEY);
    if (savedData) {
      return savedData;
    }
  } catch (err) {
    console.error('读取本地玩家数据失败:', err);
  }
  const defaultData = {
    nickname: getDefaultNickname(),
    avatarUrl: getDefaultAvatar(),
    highScore: 0,
    level: 1,
    updateTime: new Date().toISOString()
  };
  saveLocalPlayerData(defaultData);
  return defaultData;
}

function saveLocalPlayerData(data) {
  try {
    wx.setStorageSync(LOCAL_STORAGE_KEY, data);
  } catch (err) {
    console.error('保存本地玩家数据失败:', err);
  }
}

async function updatePlayerData(updateFields) {
  if (initCloud()) {
    try {
      const db = wx.cloud.database();
      // 获取当前用户的openid
      const openid = await getOpenId();
      
      if (!openid) {
        throw new Error('无法获取openid，降级到本地存储');
      }
      
      // 使用openid精确查询当前用户的数据
      const result = await db.collection('player_data').where({
        _openid: openid
      }).get();
      
      if (result.data.length > 0) {
        // 更新现有记录
        const record = result.data[0];
        await db.collection('player_data').doc(record._id).update({
          data: {
            ...updateFields,
            updateTime: db.serverDate()
          }
        });
        return true;
      } else {
        // 没有找到记录，创建新记录
        const defaultData = {
          nickname: getDefaultNickname(),
          avatarUrl: getDefaultAvatar(),
          highScore: 0,
          level: 1,
          ...updateFields, // 合并传入的更新字段
          updateTime: db.serverDate()
        };
        await db.collection('player_data').add({ data: defaultData });
        return true;
      }
    } catch (err) {
      console.error('云数据库更新失败，降级到本地存储:', err);
    }
  }
  // 降级到本地存储
  const localData = getLocalPlayerData();
  Object.assign(localData, updateFields, { updateTime: new Date().toISOString() });
  saveLocalPlayerData(localData);
  return true;
}

async function saveOnLevelComplete(level, score, oldHighScore) {
  const newHighScore = Math.max(score, oldHighScore || 0);
  return updatePlayerData({
    level: level,
    highScore: newHighScore
  });
}

async function saveOnGameOver(score, oldHighScore) {
  const newHighScore = Math.max(score, oldHighScore || 0);
  return updatePlayerData({
    highScore: newHighScore
  });
}

async function updateUserInfo(nickname, avatarUrl) {
  return updatePlayerData({ nickname, avatarUrl });
}

export {
  getOrCreatePlayerData,
  updatePlayerData,
  saveOnLevelComplete,
  saveOnGameOver,
  initCloud,
  updateUserInfo
};
