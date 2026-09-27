// storage.js —— 本地持久化：女生档案 + 聊天历史 + 全局设置
import AsyncStorage from '@react-native-async-storage/async-storage';

const GIRLS_KEY = 'ec_girls';
const SETTINGS_KEY = 'ec_settings';

export const DEFAULT_SETTINGS = {
  useLocal: false,          // 是否用本地微调模型（需先下载）
  modelUrl: '',             // 本地 GGUF 模型下载地址（你托管的可公网访问 URL）
  apiBase: 'https://open.bigmodel.cn/api/paas/v4', // 智谱兼容 OpenAI 接口
  apiKey: '',               // 智谱 API Key（免费）
  cloudModel: 'glm-4-flash',
  visionModel: 'glm-4v-flash',
};

export async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
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

export function newGirl(name) {
  return {
    id: 'g_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    name: name || '新女生',
    profile: {
      age: '', zodiac: '', personality: '', channel: '', meetTime: '',
      interests: '', taboos: '', stage: '', goal: '',
    },
    history: [], // {role:'her'|'me'|'note', text, ts}
  };
}
