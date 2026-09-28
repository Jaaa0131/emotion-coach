// ocr.js —— 截图识别：调用智谱视觉模型把图片读成文字
// recognizeImage：聊天截图 -> 对话文本
// analyzeImage：任意截图(朋友圈/个人主页等) -> 按 promptText 提取
import * as FileSystem from 'expo-file-system';

async function visionCall(settings, promptText, dataUrl) {
  const body = {
    model: settings.visionModel || 'glm-4v-flash',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: promptText },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    temperature: 0.2,
  };
  const resp = await fetch(settings.apiBase + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (settings.apiKey || ''),
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error('视觉识别失败：' + resp.status);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function analyzeImage(uri, settings, promptText) {
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  const dataUrl = 'data:image/jpeg;base64,' + b64;
  return visionCall(settings, promptText, dataUrl);
}

export async function recognizeImage(uri, settings) {
  return analyzeImage(
    uri,
    settings,
    '这是一段微信聊天截图。请只提取对话内容，按"女生：…"和"我：…"两行交替输出，' +
      '忽略表情包、时间和头像。如果看不清就如实说。'
  );
}

// 朋友圈/个人主页截图专用提取
export const MOMENT_EXTRACT_PROMPT =
  '这是一张社交软件的个人主页或朋友圈截图。请尽可能详细地提取：\n' +
  '1. 昵称、签名、地区、年龄等资料信息\n' +
  '2. 可见的每条动态：文字内容 + 配图内容(用一句话描述图片)\n' +
  '3. 她的兴趣、生活方式、情绪状态的线索\n' +
  '按条列出，别解读，只提取事实。看不清的注明。';
