// prompt.js —— 根据女生档案/历史/模式，构建发给模型的提示词

// 内置精简原则（微调模型就绪后可由其权重替代，这里作为兜底/强化）
const CORE_PRINCIPLES = `
- 前期(认识1~3周)只建立舒适感与吸引力，别用亲密称呼、别跪舔、别急着表白。
- 关系转变窗口通常在认识25~40天，前期保持框架、轻松有趣。
- 推拉：给一点又收回一点，制造情绪波动，但不冷漠。
- 冷读：用"你看起来是那种…的人"类猜测打开话题，错了也不紧。
- 服从性测试：用小事试探她是否愿意为你付出/配合，判断兴趣。
- 关心要落具体(问"中午补不补觉"比"小懒虫"自然十倍)，给接话钩子。
- 被说"奇怪/油腻"时用自嘲化解比辩解更大方，拿回框架。
- 她已读不回/未接话：别追问"为什么不回"，隔几小时~半天再发一条低压迫感的生活钩子。
`.trim();

export function profileBlock(girl) {
  const p = girl.profile || {};
  const lines = [];
  if (p.age) lines.push(`年龄：${p.age}`);
  if (p.zodiac) lines.push(`星座：${p.zodiac}`);
  if (p.personality) lines.push(`性格：${p.personality}`);
  if (p.channel) lines.push(`认识渠道：${p.channel}`);
  if (p.meetTime) lines.push(`认识时间：${p.meetTime}`);
  if (p.interests) lines.push(`兴趣：${p.interests}`);
  if (p.taboos) lines.push(`雷点/禁忌：${p.taboos}`);
  if (p.stage) lines.push(`当前阶段：${p.stage}`);
  if (p.goal) lines.push(`目标：${p.goal}`);
  return lines.length ? lines.join('；') : '（尚未填写基础情况）';
}

export function historyBlock(girl, n = 8) {
  if (!girl.history || !girl.history.length) return '（暂无历史）';
  const recent = girl.history.slice(-n);
  return recent
    .map((h) => (h.role === 'her' ? '她' : h.role === 'me' ? '我' : '注') + '：' + h.text)
    .join('\n');
}

export function buildSystem(girl, mode, noReply) {
  const base =
    '你是用户的情感沟通教练，说话像真人朋友：直接、自然、不书面腔、不堆术语、不用"首先其次"。' +
    '基于下方【她的档案】与【近期聊天】，按【方法论原则】给出贴合用户课程体系的建议。';
  const profile = '【她的档案】' + profileBlock(girl);
  const history = '【近期聊天】\n' + historyBlock(girl);
  const principles = '【方法论原则】\n' + CORE_PRINCIPLES;

  if (mode === 'reply') {
    let task =
      '【任务】用户会贴女生的原话(或"女生：… 我：…"格式)。请直接给 3 条风格不同的、可立即复制发送的微信回复，' +
      '每条后附一行"技巧：…"说明用到的手法。风格示例：①自嘲化解 ②关心+钩子 ③推拉/反框架。';
    if (noReply) {
      task +=
        '特别注意：用户说"她还没回/已读不回"。请额外先给一栏"她没回的可能原因 + 现在该不该发 + 隔多久 + 一条低压迫感破冰消息(绝不追问为什么不回)"，再给 3 条备用回复。';
    }
    return [base, profile, history, principles, task].join('\n\n');
  }
  // analysis
  let task =
    '【任务】用户会贴整段对话(文本或截图识别结果)。请按四部分输出：\n' +
    '1) 当前关系阶段与聊天状态；\n' +
    '2) 她每句话背后的心理与潜台词；\n' +
    '3) 你接下来该做什么(下一步具体行动)；\n' +
    '4) 用到的核心技巧拆解。';
  if (noReply) task += '\n注：对话末尾她未接话，分析里要点明"她为何没回 + 何时再发 + 发什么"。';
  return [base, profile, history, principles, task].join('\n\n');
}

export function buildUser(mode, conversation) {
  if (mode === 'reply') {
    return '女生的原话/对话如下：\n' + conversation + '\n\n请给出 3 条可复制回复+技巧。';
  }
  return '整段对话如下：\n' + conversation + '\n\n请按四部分分析。';
}
