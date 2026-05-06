export const EVENT_CONFUSION = 1001;

const registry = new Map();

export function registerEvent(eventId, handler) {
  registry.set(eventId, handler);
}

export function getEventHandler(eventId) {
  return registry.get(eventId);
}

const LEVEL_EVENT_CONFIGS = {
  6: { eventIds: [EVENT_CONFUSION], triggerBlocks: [5, 8, 10], triggerProbability: 100 },
};

export function getLevelEventConfig(level) {
  return LEVEL_EVENT_CONFIGS[level] || { eventIds: [], triggerBlocks: [], triggerProbability: 0 };
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
    console.log("this.currentInterval=", this.currentInterval)
  }

  pickNextInterval() {
    const blocks = this.config.triggerBlocks;
    this.currentInterval = blocks.length > 0 ? blocks[Math.floor(Math.random() * blocks.length)] : Infinity;
  }

  onBlockLanded() {
    this.blockCount++;
    console.log("onBlockLanded:", this.currentInterval, this.blockCount)
    if (this.blockCount < this.currentInterval) return null;

    this.blockCount = 0;
    this.pickNextInterval();

    if (Math.random() * 100 >= this.config.triggerProbability) return null;

    let ids = this.config.eventIds;
    if (ids.length === 0) return null;
    if (ids[0] === -1) ids = [...registry.keys()];
    return ids[Math.floor(Math.random() * ids.length)];
  }
}
