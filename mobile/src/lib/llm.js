// llm.js —— 统一推理：优先本地微调模型(llama.rn)，否则走云端(智谱免费)
import { initLlama } from 'llama.rn';
import * as FileSystem from 'expo-file-system';

let ctx = null;
let localReady = false;

export function isLocalReady() {
  return localReady;
}

// 加载本地 GGUF：优先读 App 文档目录（文件共享拷入），否则联网下载
export async function ensureLocal(settings) {
  if (localReady) return true;
  if (!settings.useLocal) return false;
  const modelFile = settings.modelFile || 'coach-qwen3b-q8_0.gguf';
  try {
    // 方式A：用电脑 Finder 把 GGUF 拖进 App 的“文件共享”目录（即 App 文档目录）
    const docDir = FileSystem.documentDirectory || '';
    const localUri = docDir + modelFile;
    let localExists = false;
    try { localExists = (await FileSystem.getInfoAsync(localUri)).exists; } catch {}
    if (localExists) {
      const localPath = docDir.replace(/^file:\/\//, '') + modelFile; // llama.rn 需要真实路径而非 file:// URI
      ctx = await initLlama({ model: localPath, n_ctx: 1024, n_gpu_layers: 99, use_mlock: false });
      localReady = true;
      return true;
    }
    // 方式B：联网下载
    if (settings.modelUrl) {
      const { downloadModel } = require('llama.rn');
      const path = await downloadModel(settings.modelUrl);
      ctx = await initLlama({ model: path, n_ctx: 1024, n_gpu_layers: 99, use_mlock: false });
      localReady = true;
      return true;
    }
    console.warn('本地模型未就绪：App 文档目录没有 ' + modelFile + '，且未填下载地址');
    localReady = false;
    return false;
  } catch (e) {
    console.warn('本地模型加载失败，回退云端：', e);
    localReady = false;
    return false;
  }
}

function qwenPrompt(system, user) {
  return (
    '<|im_start|>system\n' + system + '<|im_end|>\n' +
    '<|im_start|>user\n' + user + '<|im_end|>\n' +
    '<|im_start|>assistant\n'
  );
}

// 生成文本（全量返回）
export async function generate(system, user, settings, opts = {}) {
  if (settings.useLocal && localReady) {
    const prompt = qwenPrompt(system, user);
    const res = await ctx.completion({
      prompt,
      n_predict: opts.maxTokens || 600,
      temperature: 0.8,
      top_p: 0.9,
      stop: ['<|im_end|>'],
    });
    return res.text || '';
  }
  // 云端兜底（智谱 OpenAI 兼容）
  const body = {
    model: settings.cloudModel || 'glm-4-flash',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.8,
    top_p: 0.9,
  };
  const resp = await fetch(settings.apiBase + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (settings.apiKey || ''),
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error('云端调用失败：' + resp.status);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function unloadLocal() {
  if (ctx) {
    await ctx.release();
    ctx = null;
  }
  localReady = false;
}
