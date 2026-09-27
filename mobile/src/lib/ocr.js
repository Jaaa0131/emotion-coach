// ocr.js —— 截图识别：调用智谱视觉模型(glm-4v-flash，免费)把聊天截图读成文字
import * as FileSystem from 'expo-file-system';

export async function recognizeImage(uri, settings) {
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  const dataUrl = 'data:image/jpeg;base64,' + b64;
  const body = {
    model: settings.visionModel || 'glm-4v-flash',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              '这是一段微信聊天截图。请只提取对话内容，按"女生：…"和"我：…"两行交替输出，' +
              '忽略表情包、时间和头像。如果看不清就如实说。',
          },
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
