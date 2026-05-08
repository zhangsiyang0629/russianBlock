const CLOUD_ENV = 'cloudbase-d5gyz0rzwf3c9a078';

const LOCAL_STORAGE_KEY = 'playerData';

let cloudInitialized = false;
let cachedOpenId = null;

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
  if (cachedOpenId) return cachedOpenId;
  if (typeof wx === 'undefined' || !wx.cloud) return null;
  try {
    const res = await wx.cloud.callFunction({ name: 'login' });
    if (res.result && res.result.openid) {
      cachedOpenId = res.result.openid;
      return cachedOpenId;
    }
  } catch (err) {
    console.warn('获取 openid 失败:', err);
  }
  return null;
}

function getDefaultNickname() {
  const randomStr = Math.random().toString().slice(2, 8);
  return `游客${Date.now()}${randomStr}`;
}

function getDefaultAvatar() {
  return 'subpackages/images/mike.png';
}

function createDefaultPlayerData(overrides = {}, serverDate = null) {
  return {
    nickname: getDefaultNickname(),
    avatarUrl: getDefaultAvatar(),
    highScore: 0,
    level: 1,
    energy: 30,
    energyUpdateTime: Date.now(),
    lastDate: new Date().toISOString().split('T')[0],
    ...overrides,
    updateTime: serverDate || new Date().toISOString(),
  };
}

/**
 * 确保玩家数据包含体力字段（用于向后兼容）
 */
async function ensureEnergyFields(db, playerData) {
  const needsUpdate = {};
  const now = Date.now();
  const today = new Date().toISOString().split('T')[0];
  
  // 检查energy字段
  if (playerData.energy === undefined) {
    needsUpdate.energy = 30;
  }
  
  // 检查energyUpdateTime字段
  if (playerData.energyUpdateTime === undefined) {
    needsUpdate.energyUpdateTime = now;
  }
  
  // 检查lastDate字段
  if (playerData.lastDate === undefined) {
    needsUpdate.lastDate = today;
  }
  
  // 如果有字段需要更新，则更新云数据库
  if (Object.keys(needsUpdate).length > 0) {
    try {
      await db.collection('player_data').doc(playerData._id).update({
        data: needsUpdate
      });
      console.log('更新缺失的体力字段:', needsUpdate);
      // 同时更新本地对象
      Object.assign(playerData, needsUpdate);
    } catch (err) {
      console.error('更新体力字段失败:', err);
    }
  }
}

async function getOrCreatePlayerData() {
  if (initCloud()) {
    try {
      const db = wx.cloud.database();
      const openid = await getOpenId();
      if (!openid) throw new Error('无法获取 openid');

      const result = await db.collection('player_data').where({
        _openid: openid
      }).get();

      if (result.data.length > 0) {
        const playerData = result.data[0];
        await ensureEnergyFields(db, playerData);
        return playerData;
      }
      
      const defaultData = createDefaultPlayerData({}, db.serverDate());
      await db.collection('player_data').add({ data: defaultData });
      
      return { ...defaultData, _id: null };
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
   const defaultData = createDefaultPlayerData();
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
      const openid = await getOpenId();
      if (!openid) throw new Error('无法获取 openid');

      const result = await db.collection('player_data').where({
        _openid: openid
      }).get();
      
      if (result.data.length > 0) {
        const record = result.data[0];
        await db.collection('player_data').doc(record._id).update({
          data: {
            ...updateFields,
            updateTime: db.serverDate()
          }
        });
        return true;
      } else {
        const defaultData = createDefaultPlayerData(updateFields, db.serverDate());
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
  const result = await updatePlayerData({
    level: level,
    highScore: newHighScore
  });
  syncRanking({ level, highScore: newHighScore });
  return result;
}

async function saveOnGameOver(score, oldHighScore, gameMode = 'level') {
  const newHighScore = Math.max(score, oldHighScore || 0);
  const result = await updatePlayerData({
    highScore: newHighScore
  });
  syncRanking({ highScore: newHighScore, gameMode });
  return result;
}

async function updateUserInfo(nickname, avatarUrl) {
  const result = await updatePlayerData({ nickname, avatarUrl });
  syncRanking({ nickname, avatarUrl });
  return result;
}

/**
 * 同步玩家数据到排行榜表
 * @param {Object} fields - 需要同步的字段
 */
async function syncRanking(fields = {}) {
  try {
    const playerData = await getOrCreatePlayerData();
    if (!playerData) return;
    
    const rankingData = {
      nickname: fields.nickname || playerData.nickname,
      avatarUrl: fields.avatarUrl || playerData.avatarUrl,
      highScore: fields.highScore !== undefined ? fields.highScore : playerData.highScore,
      level: fields.level !== undefined ? fields.level : playerData.level,
      gameMode: fields.gameMode || 'level',
    };
    
    if (typeof wx !== 'undefined' && wx.cloud) {
      const db = wx.cloud.database();
      const openid = cachedOpenId || await getOpenId();
      if (!openid) return;
      const existRes = await db.collection('rankings')
        .where({ _openid: openid })
        .get();
      if (existRes.data.length > 0) {
        await db.collection('rankings').doc(existRes.data[0]._id).update({
          data: { ...rankingData, updateTime: db.serverDate() }
        });
      } else {
        await db.collection('rankings').add({
          data: { ...rankingData, updateTime: db.serverDate() }
        });
      }
    } else {
      console.log('模拟模式: 同步排行榜数据', rankingData);
    }
  } catch (err) {
    console.warn('同步排行榜数据失败:', err);
  }
}

export {
  getOrCreatePlayerData,
  updatePlayerData,
  saveOnLevelComplete,
  saveOnGameOver,
  initCloud,
  updateUserInfo
};
