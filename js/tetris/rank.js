const COLORS = {
  background: '#fdf6e3',
  surface: '#fdf6e3',
  surfaceContainer: '#efe8d2',
  surfaceContainerHigh: '#eae2cb',
  surfaceContainerLow: '#f8f0dc',
  surfaceContainerLowest: '#ffffff',
  onSurface: '#322f22',
  onSurfaceVariant: '#5f5b4d',
  outline: '#7b7767',
  outlineVariant: '#b2ad9c',
  primary: '#993d46',
  primaryContainer: '#ff8c94',
  onPrimary: '#ffefef',
  secondary: '#296654',
  secondaryContainer: '#b1efd8',
  tertiary: '#75553e',
  tertiaryContainer: '#fdd1b4',
  error: '#b02500',
  tertiaryFixed: '#fdd1b4',
  primaryFixed: '#ff8c94',
  secondaryFixed: '#b1efd8',
  primaryDim: '#8a313b',
  errorContainer: '#f95630',
  onTertiaryFixedVariant: '#6f4f39',
  primaryFixedDim: '#ef7f87',
  secondaryFixedDim: '#a3e1ca',
};

import { drawRoundedRect } from './utils.js';
import Effects from './effects.js';

const ITEMS_PER_PAGE = 10;
const MAX_RANK = 3000;
const TAB_HEIGHT = 44;
const ITEM_HEIGHT = 72;
const ITEM_GAP = 8;
const HERO_HEIGHT = 190;
const TOP_BAR_HEIGHT = 48;
const BOTTOM_PLAYER_HEIGHT = 72;
const BOTTOM_NAV_HEIGHT = 80;

export default class RankPanel {
  constructor(ctx, playerData, onBack, options = {}) {
    this.ctx = ctx;
    this.canvas = ctx.canvas;
    this.playerData = playerData;
    this.onBack = onBack;
    this.cover = options.cover || null;
    this.musicManager = options.musicManager || null;
    this.onPlay = options.onPlay || null;

    this.activeTab = 'score';
    this.listData = [];
    this.currentSkip = 0;
    this.hasMore = true;
    this.isLoading = false;
    this.isLoadingMore = false;
    this.active = false;
    this.scrollOffset = 0;
    this.maxScrollOffset = 0;
    this.touchStartY = 0;
    this.touchStartScroll = 0;
    this.showingSettings = false;
    this.settings = { musicOn: true, musicVolume: 0.5, sfxOn: true, sfxVolume: 0.5 };
    this._settingsHitAreas = {};
    this.loadSettings();

    this.effects = new Effects();

    this.avatarImages = {};

    this.tabButtons = [
      { id: 'score', text: '分数榜', x: 0, y: 0, w: 0, h: TAB_HEIGHT },
      { id: 'level', text: '关卡榜', x: 0, y: 0, w: 0, h: TAB_HEIGHT },
    ];
    this.backButton = { x: 0, y: 0, w: 44, h: 44 };
  }

  loadSettings() {
    try {
      const saved = wx.getStorageSync('coverSettings');
      if (saved) Object.assign(this.settings, saved);
    } catch (e) { }
  }

  saveSettings() {
    try { wx.setStorageSync('coverSettings', this.settings); } catch (e) { }
  }

  loadAvatarImage(url) {
    if (!url || this.avatarImages[url] !== undefined) return;
    if (typeof wx === 'undefined' || !wx.createImage) return;
    this.avatarImages[url] = null;
    const img = wx.createImage();
    img.onload = () => { this.avatarImages[url] = img; };
    img.onerror = () => { this.avatarImages[url] = false; };
    img.src = url;
  }

  loadAvatarsForData(data) {
    for (const item of data) {
      if (item.avatarUrl) this.loadAvatarImage(item.avatarUrl);
    }
    if (this.playerData && this.playerData.avatarUrl) {
      this.loadAvatarImage(this.playerData.avatarUrl);
    }
  }

  drawAvatar(ctx, cx, cy, r, url) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const img = url ? this.avatarImages[url] : undefined;
    if (img && typeof img !== 'boolean') {
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    } else {
      ctx.fillStyle = COLORS.onSurfaceVariant;
      ctx.font = `${r * 1.2}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👤', cx, cy + 2);
    }
    ctx.restore();
  }

  async show(tab = 'score') {
    this.activeTab = tab;
    this.active = true;
    this.listData = [];
    this.currentSkip = 0;
    this.hasMore = true;
    this.showingSettings = false;
    this.effects.clear();
    this.isLoading = true;
    this.scrollOffset = 0;
    this.avatarImages = {};
    this._shareImgLoaded = false;

    // 加载分享图标
    this._loadShareImage();

    await this.loadPage();
  }

  _loadShareImage() {
    if (typeof wx === 'undefined' || !wx.createImage) return;
    this._shareImg = wx.createImage();
    this._shareImg.onload = () => { this._shareImgLoaded = true; };
    this._shareImg.onerror = () => {};
    this._shareImg.src = 'subpackages/images/share.png';
  }

  hide() {
    this.active = false;
    this.effects.clear();
  }

  async loadPage() {
    if (this.isLoadingMore || !this.hasMore) return;
    this.isLoadingMore = true;

    try {
      const data = await this.fetchRankings(this.activeTab, this.currentSkip);
      this.listData.push(...data.data);
      this.hasMore = data.hasMore;
      this.currentSkip += ITEMS_PER_PAGE;
      this.updateMaxScrollOffset();
      this.loadAvatarsForData(data.data);
    } catch (err) {
      console.error('加载排行榜数据失败:', err);
    } finally {
      this.isLoading = false;
      this.isLoadingMore = false;
    }
  }

  async fetchRankings(type, skip) {
    if (typeof wx === 'undefined' || !wx.cloud) {
      return this.mockFetchRankings(type, skip);
    }
    try {
      const db = wx.cloud.database();
      const _ = db.command;
      const orderField = type === 'score' ? 'highScore' : 'level';
      const filter = type === 'score' ? { highScore: _.gt(0) } : { level: _.gt(1) };
      const res = await db.collection('rankings')
        .where(filter)
        .orderBy(orderField, 'desc')
        .orderBy('updateTime', 'asc')
        .skip(skip)
        .limit(ITEMS_PER_PAGE)
        .get();
      const data = res.data || [];
      for (let i = 0; i < data.length; i++) {
        data[i]._rank = skip + i + 1;
      }
      return { data, hasMore: data.length === ITEMS_PER_PAGE };
    } catch (err) {
      console.warn('获取排行榜失败，使用模拟数据:', err);
      return this.mockFetchRankings(type, skip);
    }
  }

  mockFetchRankings(type, skip) {
    const mockData = [];
    for (let i = 0; i < ITEMS_PER_PAGE; i++) {
      const rank = skip + i + 1;
      mockData.push({
        nickname: `玩家${rank}`,
        avatarUrl: '',
        highScore: Math.floor(Math.random() * 100000) + 5000,
        level: Math.floor(Math.random() * 29) + 2,
      });
    }
    mockData.sort((a, b) => {
      const aVal = type === 'score' ? a.highScore : a.level;
      const bVal = type === 'score' ? b.highScore : b.level;
      return bVal - aVal;
    });
    for (let i = 0; i < mockData.length; i++) {
      mockData[i]._rank = skip + i + 1;
    }
    return {
      data: mockData,
      hasMore: skip + ITEMS_PER_PAGE < MAX_RANK,
    };
  }

  updateMaxScrollOffset() {
    const listHeight = this.listData.length * (ITEM_HEIGHT + ITEM_GAP);
    const tabsY = TOP_BAR_HEIGHT + HERO_HEIGHT;
    const availableHeight = this.canvas.height - tabsY - TAB_HEIGHT - BOTTOM_PLAYER_HEIGHT - BOTTOM_NAV_HEIGHT;
    this.maxScrollOffset = Math.max(0, listHeight - availableHeight);
  }

  getListArea() {
    const tabsY = TOP_BAR_HEIGHT + HERO_HEIGHT;
    const listY = tabsY + TAB_HEIGHT;
    return {
      top: listY,
      bottom: this.canvas.height - BOTTOM_PLAYER_HEIGHT - BOTTOM_NAV_HEIGHT,
    };
  }

  handleTouchStart(x, y) {
    if (!this.active) return;
    this.touchStartY = y;
    this.touchStartScroll = this.scrollOffset;

    const backBtn = this.backButton;
    if (x >= backBtn.x && x <= backBtn.x + backBtn.w && y >= backBtn.y && y <= backBtn.y + backBtn.h) {
      return;
    }

    for (const tab of this.tabButtons) {
      if (x >= tab.x && x <= tab.x + tab.w && y >= tab.y && y <= tab.y + tab.h) {
        return;
      }
    }
  }

  handleTouchMove(x, y) {
    if (!this.active) return;
    const deltaY = this.touchStartY - y;
    this.scrollOffset = Math.max(0, Math.min(this.maxScrollOffset, this.touchStartScroll + deltaY));
  }

  handleTouchEnd(x, y) {
    if (!this.active) return;

    this.effects.createClickRipple(x, y);

    if (this.showingSettings) {
      return this.handleSettingsTouch(x, y);
    }

    const backBtn = this.backButton;
    if (x >= backBtn.x && x <= backBtn.x + backBtn.w && y >= backBtn.y && y <= backBtn.y + backBtn.h) {
      this.hide();
      if (this.onBack) this.onBack();
      return true;
    }

    for (const tab of this.tabButtons) {
      if (x >= tab.x && x <= tab.x + tab.w && y >= tab.y && y <= tab.y + tab.h) {
        if (tab.id !== this.activeTab) {
          this.switchTab(tab.id);
        }
        return true;
      }
    }

    // 分享按钮（底部）
    if (this.shareBtn && x >= this.shareBtn.x && x <= this.shareBtn.x + this.shareBtn.w && y >= this.shareBtn.y && y <= this.shareBtn.y + this.shareBtn.h) {
      const tabLabel = this.activeTab === 'score' ? '分数榜' : '关卡榜';
      const myItem = this.findMyItem();
      const myVal = myItem ? (this.activeTab === 'score' ? myItem.highScore : myItem.level) : 0;
      const title = `我在俄罗斯方块${tabLabel}排名中获得了${myVal}分，来挑战吧！`;
      if (typeof wx !== 'undefined' && wx.shareAppMessage) {
        wx.shareAppMessage({ title });
      }
      return true;
    }

    const listArea = this.getListArea();
    if (y >= listArea.top && y <= listArea.bottom) {
      const adjustedY = y - listArea.top + this.scrollOffset;
      const index = Math.floor(adjustedY / (ITEM_HEIGHT + ITEM_GAP));
      if (index >= 0 && index < this.listData.length) {
        return true;
      }
    }

    const navY = this.canvas.height - BOTTOM_NAV_HEIGHT;
    if (y >= navY) {
      const itemW = this.canvas.width / 3;
      const idx = Math.floor(x / itemW);
      if (idx === 0 && this.onPlay) {
        this.onPlay();
        return true;
      }
      if (idx === 2) {
        this.showingSettings = true;
        this._settingsHitAreas = {};
        return true;
      }
      return false;
    }

    const deltaY = Math.abs(this.touchStartY - y);
    if (deltaY < 10) {
      return false;
    }
    return false;
  }

  async switchTab(tabId) {
    this.activeTab = tabId;
    this.listData = [];
    this.currentSkip = 0;
    this.hasMore = true;
    this.isLoading = true;
    this.scrollOffset = 0;
    await this.loadPage();
  }

  checkLoadMore() {
    if (!this.hasMore || this.isLoadingMore) return;
    const listArea = this.getListArea();
    const visibleBottom = this.scrollOffset + (listArea.bottom - listArea.top);
    const totalHeight = this.listData.length * (ITEM_HEIGHT + ITEM_GAP);
    if (visibleBottom >= totalHeight - ITEM_HEIGHT * 2) {
      this.loadPage();
    }
  }

  render() {
    if (!this.active) return;
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    this.effects.tick(w, h);

    ctx.clearRect(0, 0, w, h);
    this.drawPaperBackground(ctx, w, h);
    this.drawTopBar(ctx, w);
    this.drawHeroSection(ctx, w);
    this.drawTabs(ctx, w);
    this.drawList(ctx, w);
    this.drawBottomPlayer(ctx, w, h);
    this.effects.renderFireworks(ctx);
    this.drawBottomNav(ctx, w, h);

    if (this.showingSettings) {
      this.renderSettingsDialog();
    }

    this.effects.renderClickRipples(ctx);
  }

  drawPaperBackground(ctx, w, h) {
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(50, 47, 34, 0.02)';
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const s = Math.random() * 3;
      ctx.fillRect(x, y, s, s);
    }
  }

  drawTopBar(ctx, w) {
    const barH = TOP_BAR_HEIGHT;
    ctx.fillStyle = '#fdfbf7';
    ctx.fillRect(0, 0, w, barH);
    ctx.strokeStyle = COLORS.onSurface;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, barH);
    ctx.lineTo(w, barH);
    ctx.stroke();

    this.backButton.x = 12;
    this.backButton.y = (barH - 28) / 2;
    this.backButton.w = 28;
    this.backButton.h = 28;

    ctx.fillStyle = COLORS.onSurface;
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('←', this.backButton.x + 14, this.backButton.y + 14);

    const title = this.activeTab === 'score' ? '最高分' : '最高关卡';
    ctx.fillStyle = '#FFB347';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, w / 2, barH / 2);
  }

  drawHeroSection(ctx, w) {
    const topY = TOP_BAR_HEIGHT + 10;
    const heroW = w - 24;
    const heroH = HERO_HEIGHT - 20;
    const heroX = 12;

    ctx.save();
    ctx.translate(heroX + heroW / 2, topY + heroH / 2);
    ctx.rotate(-1 * Math.PI / 180);
    ctx.translate(-heroW / 2, -heroH / 2);

    ctx.fillStyle = COLORS.surfaceContainerHigh;
    ctx.fillRect(4, 4, heroW, heroH);
    ctx.fillRect(0, 0, heroW, heroH);
    ctx.strokeStyle = COLORS.onSurface;
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, heroW, heroH);
    ctx.restore();

    const centerY = topY + heroH / 2;
    ctx.fillStyle = COLORS.onSurfaceVariant;
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('当前榜首', w / 2, centerY - 55);

    const topPlayer = this.getTopPlayer();

    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, centerY - 22, 25, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = COLORS.secondaryContainer;
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.onSurface;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const avatarUrl = topPlayer ? topPlayer.avatarUrl : null;
    this.drawAvatar(ctx, w / 2, centerY - 22, 25, avatarUrl);

    const name = topPlayer ? topPlayer.nickname : '---';
    ctx.fillStyle = COLORS.onSurface;
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, w / 2, centerY + 18);

    if (topPlayer) {
      const val = this.activeTab === 'score' ? this.formatScore(topPlayer.highScore) : `Lv.${topPlayer.level}`;
      ctx.fillStyle = COLORS.primary;
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(val, w / 2, centerY + 58);
    }
  }

  getTopPlayer() {
    if (this.listData.length > 0) {
      return this.listData[0];
    }
    return null;
  }

  formatScore(score) {
    if (score >= 1000) {
      return score.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    return score.toString();
  }

  drawTabs(ctx, w) {
    const tabsY = TOP_BAR_HEIGHT + HERO_HEIGHT;
    const tabW = w / 2;

    this.tabButtons[0].x = 0;
    this.tabButtons[0].y = tabsY;
    this.tabButtons[0].w = tabW;
    this.tabButtons[0].h = TAB_HEIGHT;
    this.tabButtons[1].x = tabW;
    this.tabButtons[1].y = tabsY;
    this.tabButtons[1].w = tabW;
    this.tabButtons[1].h = TAB_HEIGHT;

    for (let i = 0; i < this.tabButtons.length; i++) {
      const tab = this.tabButtons[i];
      const isActive = tab.id === this.activeTab;

      ctx.fillStyle = isActive ? COLORS.surfaceContainerHigh : COLORS.surface;
      ctx.fillRect(tab.x, tab.y, tab.w, tab.h);

      ctx.fillStyle = isActive ? COLORS.primary : COLORS.onSurfaceVariant;
      ctx.font = isActive ? 'bold 16px Arial' : '14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tab.text, tab.x + tab.w / 2, tab.y + tab.h / 2);

      if (isActive) {
        ctx.fillStyle = COLORS.primary;
        ctx.fillRect(tab.x + tab.w * 0.2, tab.y + tab.h - 3, tab.w * 0.6, 3);
      }
    }

    ctx.strokeStyle = COLORS.outlineVariant;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, tabsY + TAB_HEIGHT);
    ctx.lineTo(w, tabsY + TAB_HEIGHT);
    ctx.stroke();
  }

  drawList(ctx, w) {
    if (this.isLoading) {
      this.drawLoading(ctx, w);
      return;
    }

    const listArea = this.getListArea();
    const listH = listArea.bottom - listArea.top;
    const visibleTop = this.scrollOffset;
    const visibleBottom = this.scrollOffset + listH;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, listArea.top, w, listH);
    ctx.clip();

    for (let i = 0; i < this.listData.length; i++) {
      const itemY = listArea.top + i * (ITEM_HEIGHT + ITEM_GAP) - this.scrollOffset;
      if (itemY + ITEM_HEIGHT < listArea.top || itemY > listArea.bottom) continue;

      this.drawListItem(ctx, w, this.listData[i], i, itemY);
    }

    ctx.restore();

    this.checkLoadMore();

    if (this.isLoadingMore && this.listData.length > 0) {
      ctx.fillStyle = COLORS.onSurfaceVariant;
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('加载中...', w / 2, listArea.bottom - 16);
    }

    if (!this.hasMore && this.listData.length > 0) {
      ctx.fillStyle = COLORS.onSurfaceVariant;
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lastVisibleY = listArea.top + this.listData.length * (ITEM_HEIGHT + ITEM_GAP) - this.scrollOffset;
      if (lastVisibleY < listArea.bottom) {
        ctx.fillText('已加载全部榜单', w / 2, lastVisibleY + 20);
      }
    }
  }

  drawLoading(ctx, w) {
    const listArea = this.getListArea();
    ctx.fillStyle = COLORS.onSurfaceVariant;
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('加载中...', w / 2, (listArea.top + listArea.bottom) / 2);
  }

  drawListItem(ctx, w, item, index, y) {
    const marginX = 12;
    const itemW = w - marginX * 2;

    ctx.save();
    ctx.translate(marginX + itemW / 2, y + ITEM_HEIGHT / 2);
    const rotation = (index % 2 === 0 ? 0.5 : -0.8) * Math.PI / 180;
    ctx.rotate(rotation);
    ctx.translate(-itemW / 2, -ITEM_HEIGHT / 2);

    ctx.fillStyle = COLORS.surfaceContainerLow;
    ctx.fillRect(4, 4, itemW, ITEM_HEIGHT);
    ctx.fillRect(0, 0, itemW, ITEM_HEIGHT);
    ctx.strokeStyle = COLORS.onSurface;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, itemW, ITEM_HEIGHT);
    ctx.restore();

    const rank = item._rank || (index + 1);
    ctx.fillStyle = COLORS.outline;
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`#${rank}`, marginX + 12, y + ITEM_HEIGHT / 2);

    const avatarX = marginX + 48;
    const avatarSize = 36;
    const avatarR = avatarSize / 2;
    const avatarY = y + (ITEM_HEIGHT - avatarSize) / 2;
    const avatarCx = avatarX + avatarR;
    const avatarCy = avatarY + avatarR;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = COLORS.tertiaryContainer;
    ctx.strokeStyle = COLORS.onSurface;
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const textX = avatarX + avatarSize + 10;
    ctx.fillStyle = COLORS.onSurface;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const displayName = item.nickname && item.nickname.length > 10 ? item.nickname.slice(0, 10) + '...' : item.nickname || '---';
    ctx.fillText(displayName, textX, y + ITEM_HEIGHT / 2 - 8);

    ctx.fillStyle = COLORS.onSurfaceVariant;
    ctx.font = '11px Arial';
    ctx.fillText('Rank ' + rank, textX, y + ITEM_HEIGHT / 2 + 12);

    const val = this.activeTab === 'score' ? item.highScore : `Lv.${item.level}`;
    const displayVal = this.activeTab === 'score' ? this.formatScore(item.highScore) : val;
    ctx.fillStyle = COLORS.secondary;
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayVal, marginX + itemW - 12, y + ITEM_HEIGHT / 2);
  }

  drawBottomPlayer(ctx, w, h) {
    const py = h - BOTTOM_PLAYER_HEIGHT - BOTTOM_NAV_HEIGHT;
    const marginX = 12;
    const pw = w - marginX * 2;

    ctx.save();
    ctx.translate(marginX + pw / 2, py + BOTTOM_PLAYER_HEIGHT / 2);
    ctx.rotate(-0.5 * Math.PI / 180);
    ctx.translate(-pw / 2, -BOTTOM_PLAYER_HEIGHT / 2);

    ctx.fillStyle = COLORS.surfaceContainerHigh;
    ctx.fillRect(4, 4, pw, BOTTOM_PLAYER_HEIGHT);
    ctx.fillRect(0, 0, pw, BOTTOM_PLAYER_HEIGHT);
    ctx.strokeStyle = COLORS.primary;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, pw, BOTTOM_PLAYER_HEIGHT);
    ctx.restore();

    // 分享按钮（头像左侧）
    const shareSize = 36;
    const shareX = marginX + 6;
    const shareY = py + (BOTTOM_PLAYER_HEIGHT - shareSize) / 2;
    this.shareBtn = { x: shareX, y: shareY, w: shareSize, h: shareSize };
    ctx.save();
    ctx.beginPath();
    ctx.arc(shareX + shareSize / 2, shareY + shareSize / 2, shareSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = COLORS.primary;
    ctx.fill();
    if (this._shareImgLoaded && this._shareImg) {
      const s = 22;
      ctx.drawImage(this._shareImg, shareX + (shareSize - s) / 2, shareY + (shareSize - s) / 2, s, s);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('↗', shareX + shareSize / 2, shareY + shareSize / 2 + 1);
    }
    ctx.restore();

    const avatarX = marginX + 50;
    const avatarSize = 36;
    const avatarR = avatarSize / 2;
    const avatarY = py + (BOTTOM_PLAYER_HEIGHT - avatarSize) / 2;
    const avatarCx = avatarX + avatarR;
    const avatarCy = avatarY + avatarR;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = COLORS.outlineVariant;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    const myAvatarUrl = this.playerData ? this.playerData.avatarUrl : null;
    this.drawAvatar(ctx, avatarCx, avatarCy, avatarR, myAvatarUrl);

    const textX = avatarX + avatarSize + 10;
    const nick = this.playerData ? this.playerData.nickname : '我';
    ctx.fillStyle = COLORS.onSurface;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(nick, textX, py + BOTTOM_PLAYER_HEIGHT / 2 - 6);

    ctx.fillStyle = COLORS.onSurfaceVariant;
    ctx.font = '10px Arial';
    ctx.fillText('我的排名', textX, py + BOTTOM_PLAYER_HEIGHT / 2 + 12);

    const myScore = this.playerData ? (this.activeTab === 'score' ? this.playerData.highScore : this.playerData.level) : 0;
    const myRank = this.findMyRank();
    ctx.fillStyle = COLORS.primary;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(myRank ? `#${myRank}` : '未上榜', marginX + pw - 12, py + BOTTOM_PLAYER_HEIGHT / 2 - 8);

    ctx.fillStyle = COLORS.secondary;
    ctx.font = 'bold 16px Arial';
    ctx.fillText(this.activeTab === 'score' ? this.formatScore(myScore) : `Lv.${myScore}`, marginX + pw - 12, py + BOTTOM_PLAYER_HEIGHT / 2 + 12);
  }

  renderSettingsDialog() {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    const hit = {};

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, w, h);

    const dw = Math.min(330, w * 0.85);
    const contentW = dw - 48;
    const dh = 300;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2 - 20;
    hit.dialog = { x: dx, y: dy, w: dw, h: dh };

    ctx.save();
    ctx.translate(dx + dw / 2, dy + dh / 2);
    ctx.rotate(-1 * Math.PI / 180);
    ctx.translate(-(dx + dw / 2), -(dy + dh / 2));
    ctx.fillStyle = '#fffcf5';
    ctx.strokeStyle = '#322f22';
    ctx.lineWidth = 4;
    drawRoundedRect(ctx, dx, dy, dw, dh, 20);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const cx = w / 2;
    ctx.fillStyle = '#322f22';
    ctx.font = 'bold 26px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('设置', cx, dy + 32);

    const closeSize = 32;
    const closeX = dx + dw - closeSize - 10;
    const closeY = dy + 8;
    hit.close = { x: closeX, y: closeY, w: closeSize, h: closeSize };

    ctx.save();
    ctx.fillStyle = '#f95630';
    ctx.beginPath();
    ctx.arc(closeX + closeSize / 2, closeY + closeSize / 2, closeSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✕', closeX + closeSize / 2, closeY + closeSize / 2);
    ctx.restore();

    const sectionX = dx + 24;
    const toggleW = 44;
    const toggleH = 24;

    const drawToggle = (tx, ty, on, onColor) => {
      ctx.fillStyle = on ? onColor : '#b2ad9c';
      drawRoundedRect(ctx, tx, ty, toggleW, toggleH, toggleH / 2);
      ctx.fill();
      const knobX = on ? tx + toggleW - 12 - 2 : tx + 2;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(knobX + 10, ty + toggleH / 2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#322f22';
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    const drawSlider = (sx, sy, sw, val, color) => {
      const barH = 6;
      const thumbR = 10;
      ctx.fillStyle = '#eae2cb';
      drawRoundedRect(ctx, sx, sy + 10 - barH / 2, sw, barH, barH / 2);
      ctx.fill();
      ctx.fillStyle = color;
      const fillW = sw * val;
      if (fillW > barH) {
        drawRoundedRect(ctx, sx, sy + 10 - barH / 2, fillW, barH, barH / 2);
        ctx.fill();
      }
      ctx.fillStyle = color;
      const thumbX = sx + sw * val;
      ctx.beginPath();
      ctx.arc(thumbX, sy + 10, thumbR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#322f22';
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    let sectionY = dy + 62;

    ctx.fillStyle = '#5f5b4d';
    ctx.font = 'bold 15px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('♫ 音乐', sectionX, sectionY + 12);

    const musicToggleX = sectionX + contentW - toggleW;
    hit.musicToggle = { x: musicToggleX, y: sectionY, w: toggleW, h: 24 };
    drawToggle(musicToggleX, sectionY, this.settings.musicOn, '#993d46');

    sectionY += 46;
    hit.musicSlider = { x: sectionX, y: sectionY, w: contentW, h: 20 };
    drawSlider(sectionX, sectionY, contentW, this.settings.musicVolume, '#993d46');

    sectionY += 40;

    ctx.fillStyle = '#5f5b4d';
    ctx.font = 'bold 15px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔊 音效', sectionX, sectionY + 12);

    const sfxToggleX = sectionX + contentW - toggleW;
    hit.sfxToggle = { x: sfxToggleX, y: sectionY, w: toggleW, h: 24 };
    drawToggle(sfxToggleX, sectionY, this.settings.sfxOn, '#296654');

    sectionY += 46;
    hit.sfxSlider = { x: sectionX, y: sectionY, w: contentW, h: 20 };
    drawSlider(sectionX, sectionY, contentW, this.settings.sfxVolume, '#296654');

    sectionY += 48;

    const btnW = 180;
    const btnH = 40;
    const btnX = (w - btnW) / 2;
    const btnY = sectionY;
    hit.backBtn = { x: btnX, y: btnY, w: btnW, h: btnH };
    ctx.save();
    ctx.translate(btnX + btnW / 2, btnY + btnH / 2);
    ctx.rotate(-1 * Math.PI / 180);
    ctx.translate(-(btnX + btnW / 2), -(btnY + btnH / 2));
    ctx.fillStyle = '#322f22';
    drawRoundedRect(ctx, btnX + 3, btnY + 3, btnW, btnH, btnH / 2);
    ctx.fill();
    ctx.fillStyle = '#fdd1b4';
    ctx.strokeStyle = '#322f22';
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, btnX, btnY, btnW, btnH, btnH / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#322f22';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BACK', btnX + btnW / 2, btnY + btnH / 2);
    ctx.restore();

    ctx.restore();
    this._settingsHitAreas = hit;
  }

  handleSettingsTouch(x, y) {
    const hit = this._settingsHitAreas;

    if (hit.close && x >= hit.close.x && x <= hit.close.x + hit.close.w &&
      y >= hit.close.y && y <= hit.close.y + hit.close.h) {
      this.showingSettings = false;
      this._settingsHitAreas = {};
      return true;
    }

    if (hit.backBtn && x >= hit.backBtn.x && x <= hit.backBtn.x + hit.backBtn.w &&
      y >= hit.backBtn.y && y <= hit.backBtn.y + hit.backBtn.h) {
      this.showingSettings = false;
      this._settingsHitAreas = {};
      return true;
    }

    if (hit.dialog && (x < hit.dialog.x || x > hit.dialog.x + hit.dialog.w ||
      y < hit.dialog.y || y > hit.dialog.y + hit.dialog.h)) {
      this.showingSettings = false;
      this._settingsHitAreas = {};
      return true;
    }

    if (hit.musicToggle && x >= hit.musicToggle.x && x <= hit.musicToggle.x + hit.musicToggle.w &&
      y >= hit.musicToggle.y && y <= hit.musicToggle.y + hit.musicToggle.h) {
      this.settings.musicOn = !this.settings.musicOn;
      if (this.cover && this.cover.bgm) {
        if (this.settings.musicOn && this.cover.bgm.paused) {
          this.cover.bgm.play();
        } else if (!this.settings.musicOn) {
          this.cover.bgm.pause();
        }
      }
      if (this.musicManager) {
        this.musicManager.setOn(this.settings.musicOn);
      }
      this.saveSettings();
      return true;
    }

    if (hit.musicSlider && x >= hit.musicSlider.x && x <= hit.musicSlider.x + hit.musicSlider.w &&
      y >= hit.musicSlider.y && y <= hit.musicSlider.y + hit.musicSlider.h) {
      const vol = Math.max(0, Math.min(1, (x - hit.musicSlider.x) / hit.musicSlider.w));
      this.settings.musicVolume = vol;
      if (this.cover && this.cover.bgm) {
        this.cover.bgm.volume = vol;
      }
      if (this.musicManager) {
        this.musicManager.setVolume(vol);
      }
      this.saveSettings();
      return true;
    }

    if (hit.sfxToggle && x >= hit.sfxToggle.x && x <= hit.sfxToggle.x + hit.sfxToggle.w &&
      y >= hit.sfxToggle.y && y <= hit.sfxToggle.y + hit.sfxToggle.h) {
      this.settings.sfxOn = !this.settings.sfxOn;
      this.saveSettings();
      return true;
    }

    if (hit.sfxSlider && x >= hit.sfxSlider.x && x <= hit.sfxSlider.x + hit.sfxSlider.w &&
      y >= hit.sfxSlider.y && y <= hit.sfxSlider.y + hit.sfxSlider.h) {
      const vol = Math.max(0, Math.min(1, (x - hit.sfxSlider.x) / hit.sfxSlider.w));
      this.settings.sfxVolume = vol;
      this.saveSettings();
      return true;
    }

    return true;
  }

  findMyItem() {
    if (!this.playerData || !this.playerData._openid) return null;
    for (const item of this.listData) {
      if (item._openid === this.playerData._openid) {
        return item;
      }
    }
    return null;
  }

  findMyRank() {
    if (!this.playerData || !this.playerData._openid) return null;
    for (const item of this.listData) {
      if (item._openid === this.playerData._openid) {
        return item._rank || (this.listData.indexOf(item) + 1);
      }
    }
    return null;
  }

  drawBottomNav(ctx, w, h) {
    const navY = h - BOTTOM_NAV_HEIGHT;
    ctx.fillStyle = '#fdfbf7';
    ctx.strokeStyle = COLORS.onSurface;
    ctx.lineWidth = 4;
    ctx.fillRect(0, navY, w, BOTTOM_NAV_HEIGHT);
    ctx.strokeRect(0, navY, w, BOTTOM_NAV_HEIGHT);

    const items = [
      { icon: '🎮', text: '来一局' },
      { icon: '🏆', text: '排行' },
      { icon: '⚙', text: '设置' },
    ];

    const itemW = w / items.length;
    for (let i = 0; i < items.length; i++) {
      const cx = i * itemW + itemW / 2;

      if (i === 1) {
        ctx.save();
        ctx.fillStyle = '#FFB347';
        ctx.translate(cx, navY + BOTTOM_NAV_HEIGHT / 2);
        ctx.rotate(-2 * Math.PI / 180);
        const s = 50;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.strokeStyle = COLORS.onSurface;
        ctx.lineWidth = 3;
        ctx.strokeRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      }

      ctx.fillStyle = i === 1 ? '#ffffff' : COLORS.onSurface;
      ctx.font = '22px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(items[i].icon, cx, navY + BOTTOM_NAV_HEIGHT / 2 - 6);

      ctx.font = 'bold 9px Arial';
      ctx.fillText(items[i].text, cx, navY + BOTTOM_NAV_HEIGHT / 2 + 16);
    }
  }
}
