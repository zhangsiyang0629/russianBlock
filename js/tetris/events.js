export const EVENT_CONFUSION = 1001;
export const EVENT_INK = 1002;
export const EVENT_BOOM = 1003;

const registry = new Map();

export function registerEvent(eventId, handler) {
  registry.set(eventId, handler);
}

export function getEventHandler(eventId) {
  return registry.get(eventId);
}

const LEVEL_EVENT_CONFIGS = {
  1: { eventIds: [], triggerBlocks: [], triggerProbability: 0 },
  2: { eventIds: [], triggerBlocks: [], triggerProbability: 0 },
  3: { eventIds: [], triggerBlocks: [], triggerProbability: 0 },
  4: { eventIds: [], triggerBlocks: [], triggerProbability: 0 },
  5: { eventIds: [], triggerBlocks: [], triggerProbability: 0 },
  6: { eventIds: [EVENT_CONFUSION], triggerBlocks: [5, 8, 10], triggerProbability: 100 },
  7: { eventIds: [EVENT_INK], triggerBlocks: [5, 8, 10], triggerProbability: 100 },
  8: { eventIds: [EVENT_BOOM], triggerBlocks: [8, 12, 15], triggerProbability: 100 },
};

export function getLevelEventConfig(level) {
  const config = LEVEL_EVENT_CONFIGS[level];
  if (!config) return { eventIds: [-1], triggerBlocks: [5, 8, 10], triggerProbability: 50 };
  return config;
}

export class EventScheduler {
  constructor(level) {
    this.blockCount = 0;
    this.currentInterval = 0;
    this.config = getLevelEventConfig(level);
    this.pickNextInterval();
  }

  reset(level) {
    this.blockCount = 0;
    this.config = getLevelEventConfig(level);
    this.pickNextInterval();
  }

  pickNextInterval() {
    const blocks = this.config.triggerBlocks;
    this.currentInterval = blocks.length > 0 ? blocks[Math.floor(Math.random() * blocks.length)] : Infinity;
  }

  onBlockLanded() {
    this.blockCount++;
    console.log("this.blockCount:", this.blockCount, "this.currentInterval:", this.currentInterval)
    if (this.blockCount < this.currentInterval) return null;

    this.blockCount = 0;
    this.pickNextInterval();

    console.log("this.config.triggerProbability:", this.config.triggerProbability)
    if (Math.random() * 100 >= this.config.triggerProbability) return null;

    let ids = this.config.eventIds;
    if (ids.length === 0) return null;
    if (ids[0] === -1) ids = [...registry.keys()];
    return ids[Math.floor(Math.random() * ids.length)];
  }
}
