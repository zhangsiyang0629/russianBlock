try {
  if (typeof requirePlugin !== 'undefined') {
    const createMiniGameCommon = requirePlugin('MiniGameCommon', {
      enableRequireHostModule: true,
      customEnv: {
        wx,
      },
    }).default;
    const miniGameCommon = createMiniGameCommon();
    if (typeof miniGameCommon === 'undefined' || typeof miniGameCommon.canIUse === 'undefined') {
      console.error('miniGameCommon create error');
    } else {
      GameGlobal.miniGameCommon = miniGameCommon;
    }
  }
} catch (e) {
  console.error(e);
}
