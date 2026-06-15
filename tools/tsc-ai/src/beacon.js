const INTERVALS = [1000, 5000, 30000, 300000, 1800000, 3600000];
const INTERVAL_NAMES = ['1s', '5s', '30s', '5min', '30min', '1hr'];
const JITTER_LEVELS = [0, 0.1, 0.25, 0.5, 0.75, 1.0];

const INTERVAL_KEYS = INTERVAL_NAMES;
const JITTER_KEYS = JITTER_LEVELS.map(j => `${Math.round(j * 100)}%`);

const ACTIONS = [];
for (const iv of INTERVAL_NAMES) {
  for (const jv of JITTER_KEYS) {
    ACTIONS.push(`${iv}:${jv}`);
  }
}

function createInitialQTable() {
  return {};
}

function hashState(envType, networkType, hoursOp) {
  const hourBucket = hoursOp < 1 ? 'fresh' : hoursOp < 6 ? 'short' : hoursOp < 24 ? 'medium' : 'long';
  return `${envType}|${networkType}|${hourBucket}`;
}

class BeaconController {
  constructor() {
    this.qTable = {};
    this.alpha = 0.1;
    this.gamma = 0.9;
    this.epsilon = 0.2;
    this.currentState = null;
    this.currentAction = null;
    this.interval = 30000;
    this.jitter = 0.25;
    this.hoursOfOperation = 0;
    this.lastBeaconTime = 0;
    this.totalBeacons = 0;
    this.successfulBeacons = 0;
    this.failedBeacons = 0;
  }

  getState() {
    const envType = process.platform;
    const networkType = this.networkType || 'NAT';
    const hours = this.hoursOfOperation;
    return hashState(envType, networkType, hours);
  }

  updateNetworkType(type) {
    this.networkType = type;
  }

  getQ(state) {
    if (!this.qTable[state]) {
      this.qTable[state] = {};
      for (const action of ACTIONS) {
        this.qTable[state][action] = 1.0;
      }
    }
    return this.qTable[state];
  }

  selectAction(state) {
    const q = this.getQ(state);
    if (Math.random() < this.epsilon) {
      const keys = Object.keys(q);
      return keys[Math.floor(Math.random() * keys.length)];
    }
    let bestAction = null;
    let bestValue = -Infinity;
    for (const [action, value] of Object.entries(q)) {
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }
    return bestAction;
  }

  parseAction(action) {
    const parts = action.split(':');
    const intervalName = parts[0];
    const jitterKey = parts[1];
    const intervalIdx = INTERVAL_NAMES.indexOf(intervalName);
    const interval = INTERVALS[intervalIdx] || 30000;
    const jitterVal = parseInt(jitterKey, 10) / 100;
    return { interval, jitter: jitterVal };
  }

  nextBeacon() {
    const state = this.getState();
    this.currentState = state;
    const action = this.selectAction(state);
    this.currentAction = action;
    const parsed = this.parseAction(action);
    this.interval = parsed.interval;
    this.jitter = parsed.jitter;

    const jitterAmount = this.interval * this.jitter * (Math.random() * 2 - 1);
    const actualInterval = Math.max(1000, this.interval + jitterAmount);
    this.lastBeaconTime = Date.now() + actualInterval;

    return {
      interval: this.interval,
      jitter: this.jitter,
      actualInterval: Math.round(actualInterval),
      timestamp: new Date(this.lastBeaconTime).toISOString(),
      state,
      action,
    };
  }

  reportResult(success) {
    this.totalBeacons++;
    if (success) {
      this.successfulBeacons++;
    } else {
      this.failedBeacons++;
    }

    const state = this.currentState;
    const action = this.currentAction;
    if (!state || !action) return;

    const q = this.getQ(state);
    const currentQ = q[action] || 1.0;

    const nextState = this.getState();
    const nextQ = this.getQ(nextState);
    const maxNext = Math.max(...Object.values(nextQ));

    let reward;
    if (success) {
      reward = 10 + (this.successfulBeacons / Math.max(1, this.totalBeacons)) * 5;
      this.hoursOfOperation += 0.016;
    } else {
      reward = -20 - (this.failedBeacons / Math.max(1, this.totalBeacons)) * 10;
      this.hoursOfOperation = Math.max(0, this.hoursOfOperation - 0.1);
    }

    const newQ = currentQ + this.alpha * (reward + this.gamma * maxNext - currentQ);
    q[action] = Math.round(newQ * 1000) / 1000;

    if (!success) {
      this.epsilon = Math.min(0.5, this.epsilon + 0.05);
    } else {
      this.epsilon = Math.max(0.01, this.epsilon - 0.01);
    }
  }

  getStats() {
    return {
      totalBeacons: this.totalBeacons,
      successful: this.successfulBeacons,
      failed: this.failedBeacons,
      successRate: this.totalBeacons > 0 ? Math.round(this.successfulBeacons / this.totalBeacons * 10000) / 100 : 0,
      currentInterval: this.interval,
      currentJitter: this.jitter,
      epsilon: Math.round(this.epsilon * 1000) / 1000,
      hoursOfOperation: Math.round(this.hoursOfOperation * 100) / 100,
    };
  }
}

function runTrainingSimulation(episodes = 50) {
  const controller = new BeaconController();
  const results = [];

  for (let ep = 0; ep < episodes; ep++) {
    const envs = ['win32', 'linux', 'darwin'];
    const nets = ['NAT', 'Direct', 'Proxy'];
    const env = envs[Math.floor(Math.random() * envs.length)];
    const net = nets[Math.floor(Math.random() * nets.length)];

    Object.defineProperty(process, 'platform', { get: () => env });

    const beaconsInEpisode = 5 + Math.floor(Math.random() * 10);

    for (let b = 0; b < beaconsInEpisode; b++) {
      const beacon = controller.nextBeacon();
      const success = Math.random() < 0.7;
      controller.reportResult(success);
    }

    results.push({
      episode: ep + 1,
      env,
      network: net,
      stats: { ...controller.getStats() },
    });
  }

  return {
    finalStats: controller.getStats(),
    qTableSize: Object.keys(controller.qTable).length,
    episodes: results,
  };
}

module.exports = { BeaconController, runTrainingSimulation };
