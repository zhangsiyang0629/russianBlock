// 体力系统管理器
import { updatePlayerData } from './playerData.js';

export default class EnergyManager {
  constructor() {
    // 体力上限
    this.maxEnergy = 30;
    // 恢复间隔（毫秒）：3分钟 = 180000毫秒
    this.recoveryInterval = 180000;
    // 每次游戏消耗体力
    this.costPerGame = 2;
    
    // 初始化体力数据
    this.initEnergyData();
  }
  
  /**
   * 从云数据更新体力数据（用于跨设备同步）
   * @param {Object} cloudData - 云数据库中的体力数据
   */
  updateFromCloudData(cloudData) {
    if (!cloudData) return;
    
    const cloudEnergy = cloudData.energy;
    const cloudUpdateTime = cloudData.energyUpdateTime || cloudData.lastUpdateTime;
    const cloudLastDate = cloudData.lastDate;
    
    // 如果云数据缺少必要字段，跳过
    if (cloudEnergy === undefined || cloudUpdateTime === undefined) {
      return;
    }
    
    // 比较时间戳，选择最新的数据
    if (cloudUpdateTime > this.lastUpdateTime) {
      console.log('使用云数据库体力数据（更新）');
      this.energy = cloudEnergy;
      this.lastUpdateTime = cloudUpdateTime;
      this.lastDate = cloudLastDate || this.getCurrentDate();
      // 保存到本地存储
      this.saveEnergyData();
    } else if (cloudUpdateTime < this.lastUpdateTime) {
      console.log('本地体力数据更新，同步到云数据库');
      // 本地数据更新，云数据库会在saveEnergyData中同步
    }
    // 如果时间戳相等，无需操作
  }
  
  /**
   * 初始化体力数据（从存储加载或创建默认值）
   */
  initEnergyData() {
    try {
      // 尝试从存储加载体力数据
      const savedData = wx.getStorageSync('energyData');
      
      if (savedData) {
        this.energy = savedData.energy;
        this.lastUpdateTime = savedData.lastUpdateTime;
        this.lastDate = savedData.lastDate; // 上次检查的日期
      } else {
        // 新用户：初始满体力
        this.energy = this.maxEnergy;
        this.lastUpdateTime = Date.now();
        this.lastDate = this.getCurrentDate();
        this.saveEnergyData();
      }
    } catch (error) {
      console.error('加载体力数据失败:', error);
      // 使用默认值
      this.energy = this.maxEnergy;
      this.lastUpdateTime = Date.now();
      this.lastDate = this.getCurrentDate();
    }
    
    // 更新体力（考虑时间恢复和每日重置）
    this.updateEnergy();
  }
  
  /**
   * 获取当前日期字符串（YYYY-MM-DD）
   */
  getCurrentDate() {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  }
  
  /**
   * 检查并处理每日重置（0点重置为满体力）
   */
  checkDailyReset() {
    const currentDate = this.getCurrentDate();
    
    // 如果日期变化，表示新的一天，重置体力
    if (currentDate !== this.lastDate) {
      console.log(`日期变化: ${this.lastDate} -> ${currentDate}, 重置体力`);
      this.energy = this.maxEnergy;
      this.lastDate = currentDate;
      this.lastUpdateTime = Date.now();
      this.saveEnergyData();
      return true;
    }
    return false;
  }
  
  /**
   * 计算经过的时间并恢复体力
   */
  calculateEnergyRecovery() {
    const now = Date.now();
    const elapsed = now - this.lastUpdateTime;
    
    if (elapsed <= 0) return;
    
    // 计算可以恢复的体力点数
    const recoveryPoints = Math.floor(elapsed / this.recoveryInterval);
    
    if (recoveryPoints > 0) {
      // 恢复体力，不超过上限
      this.energy = Math.min(this.maxEnergy, this.energy + recoveryPoints);
      // 更新时间（只更新到最后一个完整恢复点的时间）
      this.lastUpdateTime += recoveryPoints * this.recoveryInterval;
      this.saveEnergyData();
    }
  }
  
  /**
   * 更新体力状态（每日重置 + 时间恢复）
   */
  updateEnergy() {
    // 先检查每日重置
    this.checkDailyReset();
    // 再计算时间恢复
    this.calculateEnergyRecovery();
  }
  
  /**
   * 获取当前体力值
   */
  getCurrentEnergy() {
    this.updateEnergy();
    return this.energy;
  }
  
  /**
   * 获取体力显示字符串（如 "15/30"）
   */
  getEnergyDisplay() {
    return `${this.getCurrentEnergy()}/${this.maxEnergy}`;
  }
  
  /**
   * 获取下次恢复倒计时（秒）
   * 返回0表示体力已满或无需恢复
   */
  getNextRecoveryCountdown() {
    this.updateEnergy();
    
    // 如果体力已满，无需恢复
    if (this.energy >= this.maxEnergy) {
      return 0;
    }
    
    const now = Date.now();
    const elapsed = now - this.lastUpdateTime;
    const remaining = this.recoveryInterval - (elapsed % this.recoveryInterval);
    
    return Math.ceil(remaining / 1000); // 返回秒
  }
  
  /**
   * 获取下次恢复时间格式化字符串（如 "02:15"）
   */
  getNextRecoveryTime() {
    const seconds = this.getNextRecoveryCountdown();
    if (seconds <= 0) {
      return '已满';
    }
    
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  /**
   * 消耗体力（开始游戏）
   * @returns {boolean} 是否消耗成功（体力足够）
   */
  consumeEnergy() {
    this.updateEnergy();
    
    if (this.energy >= this.costPerGame) {
      this.energy -= this.costPerGame;
      this.lastUpdateTime = Date.now();
      this.saveEnergyData();
      return true;
    }
    return false;
  }
  
  /**
   * 检查是否有足够体力开始游戏
   */
  hasEnoughEnergy() {
    return this.getCurrentEnergy() >= this.costPerGame;
  }
  
  /**
   * 获取体力信息对象（用于UI显示）
   */
  getEnergyInfo() {
    return {
      current: this.getCurrentEnergy(),
      max: this.maxEnergy,
      display: this.getEnergyDisplay(),
      nextRecovery: this.getNextRecoveryTime(),
      hasEnough: this.hasEnoughEnergy(),
      costPerGame: this.costPerGame
    };
  }
  
  /**
   * 保存体力数据到存储
   */
  saveEnergyData() {
    try {
      const energyData = {
        energy: this.energy,
        lastUpdateTime: this.lastUpdateTime,
        lastDate: this.lastDate
      };
      wx.setStorageSync('energyData', energyData);
      
      // 同步到云数据库
      this.syncToCloud();
    } catch (error) {
      console.error('保存体力数据失败:', error);
    }
  }
  
  /**
   * 同步体力数据到云数据库
   */
  async syncToCloud() {
    try {
      await updatePlayerData({
        energy: this.energy,
        energyUpdateTime: this.lastUpdateTime,
        lastDate: this.lastDate
      });
    } catch (error) {
      console.warn('同步体力数据到云数据库失败:', error);
    }
  }
  
  /**
   * 重置体力为满值（测试用）
   */
  resetToFull() {
    this.energy = this.maxEnergy;
    this.lastUpdateTime = Date.now();
    this.lastDate = this.getCurrentDate();
    this.saveEnergyData();
  }
}