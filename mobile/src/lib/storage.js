// storage.js —— 本地持久化：女生档案 + 聊天历史 + 全局设置
import AsyncStorage from '@react-native-async-storage/async-storage';

const GIRLS_KEY = 'ec_girls';
const SETTINGS_KEY = 'ec_settings';

export const DEFAULT_SETTINGS = {
  useLocal: false,          // 是否用本地微调模型（文件共享拷入 或 联网下载）
  modelUrl: '',             // 本地 GGUF 下载地址（可留空；用 Finder 文件共享拷入时无需填）
  modelFile: 'coach-qwen3b-q8_0.gguf', // 文件共享拷入时，App 文档目录里的模型文件名
  apiBase: 'https://open.bigmodel.cn/api/paas/v4', // 智谱兼容 OpenAI 接口
  apiKey: '',               // 智谱 API Key（免费）
  cloudModel: 'glm-4-air',  // 默认用 air，比 flash 聪明
  visionModel: 'glm-4v-flash',
  disguiseOn: true,         // 暗门/伪装开关（默认开，桌面显示 SnapBridge）
  resignDate: 0,            // 上次重签时间（用于 7 天红点提醒）
  unlock: {                 // 暗门解锁方式（严格顺序，任何乱按都不解锁）
    tl: 2,                  // 左上区域点击次数
    br: 3,                  // 右下区域点击次数
  },
};

export async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    let s = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    if (!s.resignDate) {
      s.resignDate = Date.now();
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    }
    return s;
  } catch {
    return { ...DEFAULT_SETTINGS, resignDate: Date.now() };
  }
}

export async function saveSettings(s) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export async function loadGirls() {
  try {
    const raw = await AsyncStorage.getItem(GIRLS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveGirls(girls) {
  await AsyncStorage.setItem(GIRLS_KEY, JSON.stringify(girls));
}

// ===== 助手页聊天记录（切换 Tab / 重启都不丢）=====
const ASSISTANT_KEY = 'ec_assistant';
export async function loadAssistant() {
  try {
    const raw = await AsyncStorage.getItem(ASSISTANT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export async function saveAssistant(msgs) {
  try { await AsyncStorage.setItem(ASSISTANT_KEY, JSON.stringify(msgs)); } catch { /* ignore */ }
}

// ===== 已复制记录（回顾模块）=====
const COPIED_KEY = 'ec_copied';
let copiedListeners = [];
export function subscribeCopied(cb) {
  copiedListeners.push(cb);
  return () => { copiedListeners = copiedListeners.filter((x) => x !== cb); };
}
export async function recordCopy(text, source) {
  if (!text || !text.trim()) return;
  try {
    const raw = await AsyncStorage.getItem(COPIED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({ text: text.trim(), source: source || '', ts: Date.now() });
    const capped = list.slice(0, 60);
    await AsyncStorage.setItem(COPIED_KEY, JSON.stringify(capped));
    copiedListeners.forEach((cb) => cb(capped));
  } catch { /* ignore */ }
}
export async function loadCopied() {
  try {
    const raw = await AsyncStorage.getItem(COPIED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function newGirl(name) {
  return {
    id: 'g_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    name: name || '新女生',
    profile: {
      age: '', zodiac: '', personality: '', channel: '', meetTime: '',
      interests: '', taboos: '', stage: '', goal: '',
    },
    history: [],          // {role:'her'|'me'|'note', text, ts}
    dashboard: null,      // 缓存的分析结果
    dashboardTs: 0,
    imports: '',          // 历史聊天原文
  };
}
