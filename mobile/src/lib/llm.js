// llm.js —— 统一推理：优先本地微调模型(llama.rn)，否则走云端(智谱免费)
import { initLlama } from 'llama.rn';

let ctx = null;
let localReady = false;

export function isLocalReady() {
  return localReady;
}

// 下载并加载本地 GGUF（首次，需 WiFi）
export async function ensureLocal(settings) {
  if (localReady) return true;
  if (!settings.useLocal || !settings.modelUrl) return false;
  try {
    const { downloadModel } = require('llama.rn');
    const path = await downloadModel(settings.modelUrl);
    ctx = await initLlama({
      model: path,
      n_ctx: 2048,
      n_gpu_layers: 99,
      use_mlock: true,
    });
    localReady = true;
    return true;
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
