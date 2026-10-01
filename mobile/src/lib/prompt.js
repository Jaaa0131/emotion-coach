// prompt.js —— 五个场景的提示词：陪练回复 / 深度分析 / 破冰 / Soul收号 / 仪表盘分析 / 档案提取
// v3：重点解决"AI味"——回复必须像真人随手打的微信

const STYLE_RULES = `
【输出风格铁律——最高优先级，比任务还重要】
- 你给的每条回复，都要像用户本人随手打出来的微信，绝不能像AI/客服/老师写的。
- 长度：每条回复一般 8~20 字，最长不超过 28 字。绝不写长段落、绝不写小作文。
- 语气：口语、随意、带点情绪。可用：草、绝了、绷、害、诶、哈、呗；可带 1 个表情。
- 一条只说一件事，能短就短，标点可以随便甚至不打，偶尔用缩写(在忙/晚安啦)。
- 严禁出现以下任何词/句式：首先、其次、总之、另外、建议您可以、作为一个AI、
  请问、您好、希望对你有帮助、有任何问题、总结一下、需要注意的是、温馨提示。
- 严禁用 1.2.3. 编号讲道理，严禁用「」书名号掉书袋，严禁排比句、书面成语、
  华丽比喻、连续感叹号。
- 严禁说教、正能量总结、自我检讨式结尾。
- 用户对话里用什么称呼，你就沿用什么称呼；用户没叫过亲密称呼就绝不让用户叫。
- 你是在帮哥们出主意，不是写方案。多出点"人味"，少点"正确"。
`.trim();

// 真人微信风格的范例：模型照这个"味道"出回复，而不是照规则硬凑
const FEW_SHOT = `
【你该给出的回复范例——严格照这个味道来，别走样】
范例一
用户贴：她：今天下班好累
你的输出：
①
回复：累成狗了？晚饭吃了没
思路：关心+问晚饭留钩子
②
回复：周末别全宅着 出来溜溜
思路：轻度邀约试探
③
回复：哈哈我刚也差点睡着在工位
思路：自嘲拉近距离

范例二
用户贴：她：你挺会说话的
你的输出：
①
回复：跟你聊才有的灵感好吧
思路：接住夸+推回去
②
回复：少来 明明是你带节奏
思路：调侃反撩
③
回复：那以后多来聊 我不收费
思路：暧昧留白

范例三
用户贴：她：嗯嗯 我去洗澡了
你的输出：
①
回复：去吧 别泡太久 当心晕
思路：随意关心不黏人
②
回复：洗完说声 我怕你晕里了
思路：轻玩笑留钩子
③
回复：速去速回 等你
思路：简短收尾不压迫
`.trim();

const CORE_PRINCIPLES = `
【方法论原则】
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
  const p = girl?.profile || {};
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

export function historyBlock(girl, n = 12) {
  if (!girl?.history || !girl.history.length) return '（暂无历史）';
  const recent = girl.history.slice(-n);
  return recent
    .map((h) => (h.role === 'her' ? '她' : h.role === 'me' ? '我' : '注') + '：' + h.text)
    .join('\n');
}

// ===== 系统提示词 =====
export function buildSystem(girl, scene, opts = {}) {
  const base =
    '你是用户身边的哥们，不是助手也不是老师。你比他懂点感情，说话直、' +
    '偶尔毒舌但靠谱。你给的回复是他能直接复制发出去的微信——得像他自己' +
    '随手敲的，不是写作文。';
  const profile = '【她的档案】' + profileBlock(girl);
  const history = '【近期聊天记录】\n' + historyBlock(girl);
  const style = STYLE_RULES;

  if (scene === 'reply') {
    let task =
      '【任务】用户贴出她说的话(或"女生：… 我：…"格式)。给出 3 组可直接照抄的对话示范，每组是一小段真实微信来回。\n' +
      '严格按下面格式输出，一行一条，不要多余解释、不要编号讲道理：\n' +
      '【方案1】\n' +
      '她：<把她刚说的原话抄在这里；也可写她接下来可能接的话，允许连续多行>\n' +
      '我：<我该回的话，8~20字，可直接复制发送；允许连续多行连发>\n' +
      '思路：<不超过12字>\n' +
      '【方案2】\n她：<…>\n我：<…>\n思路：<…>\n' +
      '【方案3】\n她：<…>\n我：<…>\n思路：<…>\n' +
      '三组风格必须不同：方案1 顺着聊（自然接住，让她好接）；方案2 调侃/推拉（轻微逗她或反转框架，别过头）；方案3 关心+钩子（落到具体小事，结尾留个她好回答的问题）。\n' +
      '"她："后面只写她的话（照抄用户贴的原文，或推演她可能的回应），"我："后面只写用户能直接发出去的微信短句——两边都允许连发好几条，不要写死成一对一。';
    if (opts.noReply) {
      task +=
        '\n特别注意：用户标记了"她还没回"。在 3 组方案之前，先给一段：她没回的可能原因(1句) + 现在该不该发 + 隔多久发 + 一条低压迫感的生活钩子(≤20字)。绝不追问"为什么不回"。';
    }
    task += '\n\n【语气红线】"我："后面一个字都不要出现"首先/其次/总之/建议您可以/作为一个AI/请问/您好/希望对你有帮助"。严格照上面范例的口吻，像真人微信。';
    return [base, style, profile, history, CORE_PRINCIPLES, task, FEW_SHOT].join('\n\n');
  }

  if (scene === 'analysis') {
    let task =
      '【任务】用户会贴整段对话(文本或截图识别结果)。按四部分输出，每部分不超过3行，说人话：\n' +
      '1) 当前关系阶段与聊天状态\n2) 她每句话背后的心理与潜台词\n3) 接下来该做什么(具体行动)\n4) 用到的核心技巧';
    if (opts.noReply) task += '\n注：对话末尾她未接话，分析里点明"她为何没回 + 何时再发 + 发什么"。';
    return [base, style, profile, history, CORE_PRINCIPLES, task].join('\n\n');
  }

  if (scene === 'icebreak') {
    const task =
      '【任务】用户提供了刚认识对象的信息(朋友圈截图提取结果，或文字描述)。输出：\n' +
      '1) 画像速写(3~4行)：猜测她是什么样的人、生活状态、情绪基调，别写成定论。\n' +
      '2) 切入点(2~3个)：从她的动态/兴趣里挖出的具体话题点。\n' +
      '3) 开场白(3条，可直接发送)：每条不超过20字；评论具体的东西或提具体的事；\n' +
      '   结尾留钩子；绝不自我介绍、绝不查户口、绝不用"你好/在吗/交个朋友"。\n' +
      '4) 最后必须输出 3 组对话示范（左右分区用），严格按此格式，一行一条：\n' +
      '【方案1】\n她：<她可能怎么回，可省略这行>\n我：<开场白，≤20字，可直接发送>\n思路：<≤10字>\n' +
      '【方案2】\n她：<…>\n我：<…>\n思路：<…>\n' +
      '【方案3】\n她：<…>\n我：<…>\n思路：<…>';
    return [base, style, CORE_PRINCIPLES, task].join('\n\n');
  }

  if (scene === 'soul') {
    const task =
      '【任务】用户在Soul等社交软件上和女生聊天(刚匹配或聊了几句)。根据对话输出：\n' +
      '1) 热度判断(1句话)：她兴趣高/一般/冷淡，从哪看出来的。\n' +
      '2) 收号时机：给"能要/再等等/该撤"其中一个 + 理由(1句话)。\n' +
      '3) 回复(3条，可直接发送)：按铁律写短句。若判断"能要"，第3条直接换成自然的要微信话术\n' +
      '   (别硬要，给她一个加你的理由，比如"发你那个店的位置")。每条后单独一行"技巧：xx"。\n' +
      '4) 节奏提醒(1句话)。\n' +
      '5) 最后必须输出 3 组对话示范（左右分区用），严格按此格式，一行一条：\n' +
      '【方案1】\n她：<她说过的话或她可能接的话，可连续多行>\n我：<我该回的话，可直接发送，可连续多行>\n思路：<≤10字>\n' +
      '【方案2】\n她：<…>\n我：<…>\n思路：<…>\n' +
      '【方案3】\n她：<…>\n我：<…>\n思路：<…>';
    return [base, style, CORE_PRINCIPLES, task].join('\n\n');
  }

  if (scene === 'dashboard') {
    const task =
      '【任务】根据她的档案和近期聊天，输出一段关系诊断，必须严格按下面格式（每行一个标记，冒号后直接写内容，不要多余解释）：\n' +
      'STAGE: <阶段名>|<数字1-5>\n' +
      'INTEREST: <低/中低/中/中高/高>|<数字0-100>\n' +
      'MINE: <最近一次踩雷或风险，一句话>\n' +
      'NEXT: <下一阶段是什么，一句话>\n' +
      'ADVICE: <建议与补救操作，分1)2)3)条列，每条不超过25字>\n' +
      '只输出这5行带标记的内容，不要寒暄。';
    return [base, style, profile, history, CORE_PRINCIPLES, task].join('\n\n');
  }

  if (scene === 'health') {
    const task =
      '【任务】基于她的档案和近期聊天，做一次"聊天体检"，必须严格按下面格式（每行一个标记，冒号后直接写，不要寒暄）：\n' +
      'HEALTH: <高/中/低>|<数字0-100>\n' +
      'RISK: <最近一个最该注意的风险或踩雷，一句话>\n' +
      'DO: <接下来最该做的一件事，一句话，像哥们提醒>\n' +
      '只输出这3行带标记的内容。';
    return [base, style, profile, history, CORE_PRINCIPLES, task].join('\n\n');
  }

  if (scene === 'extract') {
    const task =
      '【任务】下面是从用户和女生的聊天记录里，自动提取她的档案字段。严格按格式输出（冒号后直接写，没有就写"未知"，不要多余解释）：\n' +
      'AGE: <年龄或"未知">\nZODIAC: <星座或"未知">\nPERSONALITY: <性格，几个词>\n' +
      'CHANNEL: <怎么认识的>\nINTERESTS: <兴趣，逗号分隔>\nTABOOS: <雷点/反感的事>\n' +
      'STAGE: <当前大概阶段>\nGOAL: <用户可能的目标>\n' +
      '只输出这8行带标记的内容。';
    return [base, profile, history, task].join('\n\n');
  }

  return [base, style, profile, history, CORE_PRINCIPLES].join('\n\n');
}

export function buildUser(scene, conversation) {
  if (scene === 'reply') return '对话如下：\n' + conversation + '\n\n给3条可复制回复（按格式）。';
  if (scene === 'analysis') return '整段对话如下：\n' + conversation + '\n\n按四部分分析。';
  if (scene === 'icebreak') return '她的信息(来自朋友圈/主页截图或文字描述)：\n' + conversation + '\n\n按格式输出。';
  if (scene === 'soul') return 'Soul上的对话：\n' + conversation + '\n\n按格式输出。';
  if (scene === 'dashboard') return '请按格式输出关系诊断。';
  if (scene === 'health') return '请基于近期聊天做聊天体检，按格式输出。';
  if (scene === 'extract') return '请按格式提取她的档案字段。';
  return conversation;
}

// ===== 解析器 =====
export function parseReplies(text) {
  const items = [];
  const blocks = text.split(/(①|②|③)/).map((s) => s.trim()).filter(Boolean);
  let cur = null;
  for (const b of blocks) {
    if (b === '①' || b === '②' || b === '③') { cur = { reply: '', idea: '' }; items.push(cur); }
    else if (cur) {
      const m = b.match(/回复[:：]\s*(.*?)(思路[:：]\s*(.*))?$/s);
      if (m) { cur.reply = (m[1] || '').trim(); cur.idea = (m[3] || '').trim(); }
      else { cur.reply = b; }
    } else { cur = { reply: b, idea: '' }; items.push(cur); }
  }
  if (!items.length) items.push({ reply: text.trim(), idea: '' });
  return items;
}

// 取"标记行"的内容：支持多行（一直到下一个标记行或结尾），修掉以前只读第一行把 2)3) 吞掉的问题
function getBlock(text, key, allKeys) {
  const others = allKeys.filter((k) => k !== key).join('|');
  const re = new RegExp('^\\s*' + key + '\\s*[:：]\\s*([\\s\\S]*?)(?=^\\s*(?:' + others + ')\\s*[:：]|$)', 'im');
  const m = String(text || '').match(re);
  return m ? m[1].trim() : '';
}

// ===== 左右对话体解析：她：/我： → 气泡流（支持同一方连发多条）=====
// 返回 [{ items:[{role:'her'|'me', text}], idea:'…' }, ...]
export function parseScriptGroups(text) {
  const lines = String(text || '').split('\n');
  const groups = [];
  let cur = null;
  const ensure = () => { if (!cur) cur = { items: [], idea: '' }; return cur; };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // 去掉行首可能的序号/符号，便于容错：如 "- 我：…" "1. 我：…"
    const clean = line.replace(/^[-•*\d]+[.、)）]?\s*/, '').trim();
    if (/^【?\s*方案\s*\d/.test(clean) || /^#{1,3}\s*方案/.test(clean)) {
      if (cur && cur.items.length) groups.push(cur);
      cur = { items: [], idea: '' };
      continue;
    }
    let m = clean.match(/^(她|对方|女生|妹子)\s*[:：]\s*(.+)$/);
    if (m) { ensure().items.push({ role: 'her', text: m[2].trim() }); continue; }
    m = clean.match(/^我\s*[:：]\s*(.+)$/);
    if (m) { ensure().items.push({ role: 'me', text: m[1].trim() }); continue; }
    m = clean.match(/^(思路|技巧|策略|钩子)\s*[:：]\s*(.+)$/);
    if (m) {
      const g = ensure();
      g.idea = g.idea ? g.idea + '；' + m[2].trim() : m[2].trim();
      continue;
    }
  }
  if (cur && cur.items.length) groups.push(cur);
  return groups;
}

// 把一段输出拆成「正文分析」+「对话方案组」（破冰/Soul 用：上面看分析，下面看左右气泡）
export function splitScriptText(text) {
  const src = String(text || '');
  const m = src.match(/【\s*方案\s*\d|^\s*[-•*\d]+[.、)）]?\s*她\s*[:：]|^\s*她\s*[:：]|^\s*我\s*[:：]/m);
  if (!m || typeof m.index !== 'number') return { body: src.trim(), groups: [] };
  return { body: src.slice(0, m.index).trim(), groups: parseScriptGroups(src.slice(m.index)) };
}

export function parseDashboard(text) {
  const KEYS = ['STAGE', 'INTEREST', 'MINE', 'NEXT', 'ADVICE'];
  const get = (key) => getBlock(text, key, KEYS);
  const stageRaw = get('STAGE');
  const interestRaw = get('INTEREST');
  const stageNum = parseInt((stageRaw.match(/\|(\d)/) || [])[1] || '0', 10);
  const interestNum = parseInt((interestRaw.match(/\|(\d+)/) || [])[1] || '0', 10);
  return {
    stage: stageRaw.split('|')[0].trim(),
    stageNum: isNaN(stageNum) ? 0 : stageNum,
    interest: interestRaw.split('|')[0].trim(),
    interestNum: isNaN(interestNum) ? 0 : interestNum,
    mine: get('MINE'),
    next: get('NEXT'),
    advice: get('ADVICE'),
    raw: text,
  };
}

export function parseProfile(text) {
  const get = (key) => {
    const m = text.match(new RegExp(key + '\\s*[:：]\\s*([^\\n]*)', 'i'));
    return m ? m[1].trim() : '';
  };
  return {
    age: get('AGE'), zodiac: get('ZODIAC'), personality: get('PERSONALITY'),
    channel: get('CHANNEL'), interests: get('INTERESTS'), taboos: get('TABOOS'),
    stage: get('STAGE'), goal: get('GOAL'),
  };
}

export function parseHealth(text) {
  const get = (key) => {
    const m = text.match(new RegExp(key + '\\s*[:：]\\s*([^\\n]*)', 'i'));
    return m ? m[1].trim() : '';
  };
  const healthRaw = get('HEALTH');
  const healthNum = parseInt((healthRaw.match(/\|(\d+)/) || [])[1] || '0', 10);
  return {
    health: healthRaw.split('|')[0].trim(),
    healthNum: isNaN(healthNum) ? 0 : healthNum,
    risk: get('RISK'),
    do: get('DO'),
    raw: text,
  };
}

// ===== 助手：内置情感/展示面顾问（通用 Q&A + 图片分析 + P图交接词）=====
export const ASSISTANT_SYSTEM = `你是用户的哥们兼形象/聊天军师——实战过大量社交平台包装，也懂两性吸引。你不是客服，说话直接、能开玩笑、不绕弯子。

你最擅长的领域：
- 展示面策划：朋友圈/小红书/探探/Soul 等平台该发什么、不发什么，如何呈现价值(生活审美、资源、情绪、稀缺性)。
- 形象塑造：穿搭、发型、体态、气质、拍照姿态与场景选择。
- 关系节奏：从认识到推进、收号、邀约、升级关系的节点判断。
- 聊天与心态：框架、推拉、冷读、服从性测试、需求感控制。

回答纪律：
- 直接给方法，分点清晰，必要时给「可以照抄的句子」，不绕弯子、不鸡汤、不堆学术名词。
- 用中文，口语化但专业；涉及判断时说清「为什么」和「怎么做」。
- 遇到照片/形象/修图类问题，先诊断再看机会；若涉及改图，必须输出【P图交接词】区块(格式见下)，方便用户粘到别的图像AI执行。
- 你是策略教练，不替用户做重大人生决定；不输出违法、骚扰、侵犯他人隐私的内容。

【P图交接词格式——当用户要修改/美化/重绘照片，或你需要给可执行的修图方案时，文末必须输出此区块】：
【P图交接词】
<中文提示词：具体描述期望效果——场景、光线、色调、服装、姿态、背景、风格，越具体越好，可直接粘贴到即梦/妙鸭相机/美图秀秀AI/通义万相>
<英文关键词(可选)：逗号分隔，便于 Midjourney/Stable Diffusion，如 portrait, soft lighting, ...>
——结束`;

export const ASSISTANT_VISION_PROMPT = `这是用户发来的照片，可能与他的「展示面」(社交平台个人形象)、穿搭、环境、身材体态、生活品质呈现有关。

请完成：
1) 展示面诊断：从这张照片看，他在价值展示/审美/生活状态上呈现了什么、缺什么、有哪些雷点(1段，说人话，别恭维)。
2) 改进方向：3条具体可做的(可以拍什么、改什么、删什么)。
3) 必须输出【P图交接词】区块：用中文写一段可直接粘进其他图像AI(即梦/妙鸭相机/美图秀秀AI/通义万相/Midjourney)的提示词，描述期望的修图或重绘效果(场景、光线、色调、服装、姿态、背景、风格)，尽量具体；另起一行给可选英文关键词(逗号分隔)。
格式严格：
【P图交接词】
<中文提示词>
<英文关键词>
——结束`;

export function parseAssistant(text) {
  const startTag = '【P图交接词】';
  const endTag = '——结束';
  const si = String(text).indexOf(startTag);
  if (si === -1) return { body: String(text).trim(), handoff: null };
  const ei = String(text).indexOf(endTag, si);
  const raw = (ei === -1 ? String(text).slice(si + startTag.length) : String(text).slice(si + startTag.length, ei)).trim();
  let lines = raw.split('\n').map((s) => s.trim()).filter(Boolean);
  // 去掉模型可能包上的代码围栏
  lines = lines.map((l) => l.replace(/^```[\w-]*$/i, '').replace(/^```/, '').replace(/```$/, '')).filter(Boolean);
  let cn = (lines[0] || '').replace(/^中文提示词[:：]?\s*/i, '').trim();
  const en = (lines.slice(1).join(' ').replace(/^EN[:：]?\s*/i, '')).trim();
  const body = (String(text).slice(0, si) + (ei !== -1 ? String(text).slice(ei + endTag.length) : '')).trim();
  return { body, handoff: cn ? { cn, en } : null };
}
