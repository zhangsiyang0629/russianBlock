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
  constructor(ctx, playerData, onBack) {
    this.ctx = ctx;
    this.canvas = ctx.canvas;
    this.playerData = playerData;
    this.onBack = onBack;

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
    this.myRankData = null;

    this.tabButtons = [
      { id: 'score', text: '分数榜', x: 0, y: 0, w: 0, h: TAB_HEIGHT },
      { id: 'level', text: '关卡榜', x: 0, y: 0, w: 0, h: TAB_HEIGHT },
    ];
    this.backButton = { x: 0, y: 0, w: 44, h: 44 };
  }

  async show(tab = 'score') {
    this.activeTab = tab;
    this.active = true;
    this.listData = [];
    this.currentSkip = 0;
    this.hasMore = true;
    this.isLoading = true;
    this.scrollOffset = 0;
    this.myRankData = null;

    await this.loadPage();
  }

  hide() {
    this.active = false;
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
      const orderField = type === 'score' ? 'highScore' : 'level';
      const res = await db.collection('rankings')
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
        level: Math.floor(Math.random() * 30) + 1,
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

    const listArea = this.getListArea();
    if (y >= listArea.top && y <= listArea.bottom) {
      const adjustedY = y - listArea.top + this.scrollOffset;
      const index = Math.floor(adjustedY / (ITEM_HEIGHT + ITEM_GAP));
      if (index >= 0 && index < this.listData.length) {
        return true;
      }
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
    this.myRankData = null;
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

    ctx.clearRect(0, 0, w, h);
    this.drawPaperBackground(ctx, w, h);
    this.drawTopBar(ctx, w);
    this.drawHeroSection(ctx, w);
    this.drawTabs(ctx, w);
    this.drawList(ctx, w);
    this.drawBottomPlayer(ctx, w, h);
    this.drawBottomNav(ctx, w, h);
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

    const title = this.activeTab === 'score' ? 'High Scores' : 'Top Levels';
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
    ctx.fillStyle = COLORS.secondaryContainer;
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.onSurface;
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLORS.onSurfaceVariant;
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👤', w / 2, centerY - 22);
    ctx.restore();

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
    const avatarY = y + (ITEM_HEIGHT - avatarSize) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.tertiaryContainer;
    ctx.strokeStyle = COLORS.onSurface;
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.onSurfaceVariant;
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👤', avatarX + avatarSize / 2, avatarY + avatarSize / 2);
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

  drawLoading(ctx, w) {
    const listArea = this.getListArea();
    ctx.fillStyle = COLORS.onSurfaceVariant;
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('加载中...', w / 2, (listArea.top + listArea.bottom) / 2);
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

    const avatarX = marginX + 50;
    const avatarSize = 36;
    const avatarY = py + (BOTTOM_PLAYER_HEIGHT - avatarSize) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.outlineVariant;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.surface;
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👤', avatarX + avatarSize / 2, avatarY + avatarSize / 2);
    ctx.restore();

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
      { icon: '🎮', text: 'Play' },
      { icon: '🏆', text: 'Scores' },
      { icon: '⚙', text: 'Settings' },
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
