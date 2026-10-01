// App.jsx —— 情感教练 v3（微信风 / 暗门伪装 / 关系仪表盘 / 破冰 / Soul / 连续对话）
import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator,
  Alert, Dimensions, Image, StatusBar, Platform, PanResponder,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import Settings from './src/components/Settings';
import {
  loadSettings, saveSettings, loadGirls, saveGirls, newGirl,
  loadCopied, subscribeCopied, recordCopy,
} from './src/lib/storage';
import {
  buildSystem, buildUser, parseReplies, parseDashboard, parseProfile, historyBlock, parseHealth,
  ASSISTANT_SYSTEM, ASSISTANT_VISION_PROMPT, parseAssistant,
} from './src/lib/prompt';
import { generate, ensureLocal, isLocalReady } from './src/lib/llm';
import { analyzeImage, recognizeImage, MOMENT_EXTRACT_PROMPT } from './src/lib/ocr';
import Icon from './src/components/Icon';

const TABS = [
  { key: 'messages', label: '消息', icon: 'message' },
  { key: 'icebreak', label: '破冰', icon: 'ice' },
  { key: 'soul', label: 'Soul', icon: 'soul' },
  { key: 'assistant', label: '助手', icon: 'assistant' },
];
const { width: SW, height: SH } = Dimensions.get('window');
const TOP = Platform.OS === 'ios' ? 64 : ((StatusBar.currentHeight || 0) + 16); // 状态栏/灵动岛安全区（避开灵动岛并留余量）

export default function App() {
  const [settings, setSettings] = useState(null);
  const [girls, setGirls] = useState([]);
  const [selId, setSelId] = useState(null);
  const [tab, setTab] = useState('messages');
  const [unlocked, setUnlocked] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [nameModal, setNameModal] = useState(null); // {mode:'add'|'rename', id?}
  const [chatGirl, setChatGirl] = useState(null);
  const [localStatus, setLocalStatus] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 左边缘右滑拉出「我」抽屉（轻点放行，仅拦截横向滑动）
  const edgePan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (e, g) => Math.abs(g.dx) > 12,
    onPanResponderMove: (e, g) => { if (g.dx > 40) setDrawerOpen(true); },
  })).current;

  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      const g = await loadGirls();
      setSettings(s);
      setGirls(g);
      setSelId(g[0]?.id || null);
    })();
  }, []);

  if (!settings) return <View style={styles.loading}><Text>加载中…</Text></View>;

  const girl = girls.find((g) => g.id === selId) || null;

  const persist = (next) => { setGirls(next); saveGirls(next); };
  const updateGirl = (id, patch) => persist(girls.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const logMsg = (id, role, text) => {
    if (!text || !text.trim()) return;
    const history = [...(girls.find((g) => g.id === id)?.history || []), { role, text: text.trim(), ts: Date.now() }];
    updateGirl(id, { history });
  };

  const runLLM = async ({ scene, conversation, noReply, g }) => {
    const target = g || girl;
    const sys = buildSystem(target, scene, { noReply });
    const user = buildUser(scene, conversation || '');
    if (settings.useLocal) {
      const ok = await ensureLocal(settings);
      setLocalStatus(ok ? '本地模型运行中' : '本地加载失败，已用云端');
    }
    return await generate(sys, user, { ...settings, useLocal: settings.useLocal && isLocalReady() });
  };

  const addGirl = () => setNameModal({ mode: 'add' });
  const renameGirl = (g) => setNameModal({ mode: 'rename', id: g.id, name: g.name });
  const deleteGirl = (g) => {
    Alert.alert('删除', '确定删除「' + g.name + '」及她的所有记录？', [
      { text: '取消' },
      { text: '删除', style: 'destructive', onPress: () => {
        const next = girls.filter((x) => x.id !== g.id);
        persist(next);
        setSelId(next[0]?.id || null);
      } },
    ]);
  };

  const onSaveSettings = (s) => { setSettings(s); saveSettings(s); setShowSettings(false); };

  const nextResign = settings.resignDate + 7 * 86400000;
  const daysLeft = (nextResign - Date.now()) / 86400000;
  const redDot = daysLeft <= 1;

  const showGirlTabs = ['messages', 'icebreak', 'soul'].includes(tab);

  return (
    <View style={styles.root}>
      {settings.disguiseOn && !unlocked && <LockScreen onUnlock={() => setUnlocked(true)} cfg={settings.unlock} />}

      {showGirlTabs && (
        <GirlTabs girls={girls} selId={selId} onSelect={setSelId}
          onAdd={addGirl} onRename={renameGirl} onDelete={deleteGirl} />
      )}

      {tab === 'messages' && (
        girl ? (
          <ScrollView style={styles.content}>
            <Dashboard girl={girl} runLLM={runLLM} updateGirl={updateGirl} />
            <ChatHealth girl={girl} runLLM={runLLM} />
            <ProfileCard girl={girl} onChange={(p) => updateGirl(girl.id, { profile: p })}
              onExtract={async () => {
                if (!girl.history.length) { Alert.alert('暂无聊天', '先在快速回复里粘贴一些对话，或导入历史聊天'); return; }
                const out = await runLLM({ scene: 'extract', g: girl });
                const p = parseProfile(out);
                const merged = { ...girl.profile };
                Object.keys(p).forEach((k) => { if (p[k] && p[k] !== '未知') merged[k] = p[k]; });
                updateGirl(girl.id, { profile: merged });
                Alert.alert('已提取', '已从聊天填充档案，去档案卡核对补充');
              }} />
            <QuickReply girl={girl} settings={settings} runLLM={runLLM}
              onLogHer={(t) => logMsg(girl.id, 'her', t)}
              onOpenChat={() => setChatGirl(girl.id)} />
            <TouchableOpacity style={styles.importBtn} onPress={() => setShowImport(true)}>
              <Text style={styles.importBtnText}>📥 导入历史聊天（存入「{girl.name}」）</Text>
            </TouchableOpacity>
            <ReviewModule />
            <View style={{ height: 24 }} />
          </ScrollView>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>还没有档案，点上方「+ 添加女生」开始</Text>
          </View>
        )
      )}

      {tab === 'icebreak' && (
        <ScrollView style={styles.content}>
          {!girl && <Text style={styles.hint}>先在上方选一个女生，结果会保存到她名下</Text>}
          <IceBreak girl={girl} settings={settings} runLLM={runLLM}
            onSave={(out) => girl && logMsg(girl.id, 'note', '【破冰】' + out)} />
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {tab === 'soul' && (
        <ScrollView style={styles.content}>
          {!girl && <Text style={styles.hint}>先在上方选一个女生，结果会保存到她名下</Text>}
          <SoulView girl={girl} settings={settings} runLLM={runLLM}
            onSave={(out) => girl && logMsg(girl.id, 'note', '【Soul/收号】' + out)} />
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {tab === 'assistant' && (
        <AssistantScreen settings={settings} />
      )}

      <View style={styles.tabbar}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} style={styles.tabItem} onPress={() => setTab(t.key)}>
            <Icon name={t.icon} size={26} color={tab === t.key ? C.green : '#999'} />
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelOn]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 左边缘抓手（右滑拉出「我」；红点=需重签） */}
      <View style={styles.edgeGrabber} {...edgePan.panHandlers}>
        {redDot && <View style={styles.edgeDot} />}
      </View>

      {/* 「我」抽屉（从屏幕左边缘右滑进入） */}
      {drawerOpen && (
        <View style={styles.drawerMask}
          onStartShouldSetResponder={() => true}
          onResponderRelease={() => setDrawerOpen(false)}>
          <View style={styles.drawerPanel} onStartShouldSetResponder={() => true}>
            <MePage settings={settings} onOpenSettings={() => setShowSettings(true)} nextResign={nextResign} />
            <TouchableOpacity style={styles.drawerClose} onPress={() => setDrawerOpen(false)}>
              <Text style={styles.drawerCloseText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showSettings && <Settings settings={settings} onSave={onSaveSettings} onClose={() => setShowSettings(false)} />}
      {showImport && <ImportModal girl={girl} onClose={() => setShowImport(false)} onImport={(h) => { if (girl) updateGirl(girl.id, { history: [...girl.history, ...h] }); setShowImport(false); }} />}
      {nameModal && <NameModal modal={nameModal} onClose={() => setNameModal(null)}
        onConfirm={(name) => {
          if (nameModal.mode === 'add') { const g = newGirl(name); persist([...girls, g]); setSelId(g.id); }
          else updateGirl(nameModal.id, { name });
          setNameModal(null);
        }} />}
      {chatGirl && <ChatView girl={girls.find((g) => g.id === chatGirl)} settings={settings} runLLM={runLLM}
        onLog={(role, t) => logMsg(chatGirl, role, t)} onClose={() => setChatGirl(null)} />}
    </View>
  );
}

// ===== 暗门锁定页：伪装成崩溃报错，左上点 N 次 → 右下点 M 次（严格顺序，乱按不解锁）=====
function LockScreen({ onUnlock, cfg }) {
  const tl = (cfg && cfg.tl) || 2;
  const br = (cfg && cfg.br) || 3;
  const expected = useMemo(() => [...Array(tl).fill('TL'), ...Array(br).fill('BR')], [tl, br]);
  const [idx, setIdx] = useState(0); // 当前已正确匹配的步数

  const tap = (zone) => {
    if (zone === expected[idx]) {
      const n = idx + 1;
      if (n >= expected.length) onUnlock();
      else setIdx(n);
    } else {
      setIdx(0); // 任何错序、错区、乱按都清零重来
    }
  };

  const tlDone = Math.min(idx, tl);
  const brDone = Math.max(0, idx - tl);

  return (
    <View style={styles.lockRoot}>
      {/* 崩溃报错卡（纯展示，不可点） */}
      <View style={styles.crashCard} pointerEvents="none">
        <Text style={styles.crashTitle}>SnapBridge 已停止运行</Text>
        <Text style={styles.crashText}>很抱歉，应用发生错误并已关闭。{'\n'}请稍后重试。</Text>
        <View style={styles.crashBtn}>
          <Text style={styles.crashBtnText}>关闭</Text>
        </View>
      </View>

      {/* 全部屏幕捕获点按；左上/右下/其它区分别判定 */}
      <TouchableOpacity style={styles.gestureLayer} activeOpacity={1}
        onPress={(e) => {
          const { locationX, locationY } = e.nativeEvent;
          let zone = 'OTHER';
          if (locationX < SW * 0.4 && locationY < SH * 0.4) zone = 'TL';
          else if (locationX > SW * 0.6 && locationY > SH * 0.6) zone = 'BR';
          tap(zone);
        }}>
        {/* 左上/右下视觉提示区 */}
        <View style={[styles.zoneHint, { top: 30, left: 30 }]}>
          <Text style={styles.zoneHintText}>左上 {tlDone}/{tl}</Text>
        </View>
        <View style={[styles.zoneHint, { bottom: 30, right: 30 }]}>
          <Text style={styles.zoneHintText}>右下 {brDone}/{br}</Text>
        </View>
        {idx > 0 && idx < expected.length &&
          <Text style={styles.hintSmall}>
            {idx <= tl ? `继续点左上（${tlDone}/${tl}）` : `现在点右下（${brDone}/${br}）`}
          </Text>}
      </TouchableOpacity>
    </View>
  );
}

// ===== 女生切换条 =====
function GirlTabs({ girls, selId, onSelect, onAdd, onRename, onDelete }) {
  return (
    <ScrollView horizontal style={styles.chips} showsHorizontalScrollIndicator={false}>
      {girls.map((g) => (
        <TouchableOpacity key={g.id} style={[styles.chip, g.id === selId && styles.chipOn]}
          onPress={() => onSelect(g.id)}
          onLongPress={() => Alert.alert('操作「' + g.name + '」', '', [
            { text: '改名', onPress: () => onRename(g) },
            { text: '删除', style: 'destructive', onPress: () => onDelete(g) },
            { text: '取消' },
          ])}>
          <Text style={[styles.chipText, g.id === selId && styles.chipTextOn]}>{g.name}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.chipAdd} onPress={onAdd}>
        <Text style={styles.chipAddText}>+ 添加</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ===== 关系仪表盘（折叠）=====
function Dashboard({ girl, runLLM, updateGirl }) {
  const [showNext, setShowNext] = useState(false);
  const [showAdvice, setShowAdvice] = useState(false);
  const [loading, setLoading] = useState(false);
  const d = girl.dashboard;
  const lit = d?.stageNum || 0;

  const refresh = async () => {
    setLoading(true);
    try {
      const out = await runLLM({ scene: 'dashboard', g: girl });
      const parsed = parseDashboard(out);
      if (!parsed.stage && !parsed.mine && !parsed.advice) parsed.raw = out;
      updateGirl(girl.id, { dashboard: parsed, dashboardTs: Date.now() });
    } catch (e) { Alert.alert('分析失败', e.message); }
    finally { setLoading(false); }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>关系仪表盘</Text>
        <TouchableOpacity onPress={refresh}>
          <Text style={styles.refresh}>{loading ? '分析中…' : '刷新 ⟳'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLbl}>阶段</Text>
        <View style={styles.dots}>
          {[1, 2, 3, 4, 5].map((i) => <View key={i} style={[styles.dotC, i <= lit && styles.dotCOn]} />)}
        </View>
        <Text style={styles.rowVal}>{d?.stage || '未分析'}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLbl}>兴趣度</Text>
        <View style={styles.barBg}><View style={[styles.barFg, { width: (d?.interestNum || 0) + '%' }]} /></View>
        <Text style={styles.rowVal}>{d?.interest || '—'}</Text>
      </View>

      {d?.mine ? (
        <View style={styles.row}>
          <Text style={styles.rowLbl}>踩雷</Text>
          <Text style={[styles.rowVal, { color: '#FA5151', flex: 1 }]}>{d.mine}</Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.foldRow} onPress={() => setShowNext(!showNext)}>
        <Text style={styles.foldLbl}>▸ 下一阶段{!showNext ? '（' + (d?.next || '点刷新分析') + '）' : ''}</Text>
      </TouchableOpacity>
      {showNext && d?.next ? <Text style={styles.foldBody}>{d.next}</Text> : null}

      <TouchableOpacity style={styles.foldRow} onPress={() => setShowAdvice(!showAdvice)}>
        <Text style={styles.foldLbl}>▸ 建议 · 补救话术（点开可复制）</Text>
      </TouchableOpacity>
      {showAdvice && d?.advice ? (
        <View>
          {String(d.advice).split('\n').filter((s) => s.trim()).map((line, i) => (
            <View key={i} style={styles.adviceLine}>
              <Text style={styles.adviceText}>{line.trim()}</Text>
              <TouchableOpacity style={styles.copyBtn}
                onPress={() => Clipboard.setStringAsync(line.trim()).then(() => { recordCopy(line.trim(), '仪表盘'); Alert.alert('已复制'); })}>
                <Text style={styles.copyText}>复制</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ===== 基础档案（折叠 + 编辑）=====
function ProfileCard({ girl, onChange, onExtract }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const p = girl.profile;
  const fields = [
    ['age', '年龄'], ['zodiac', '星座'], ['personality', '性格'], ['channel', '认识渠道'],
    ['meetTime', '认识时间'], ['interests', '兴趣'], ['taboos', '雷点/禁忌'], ['stage', '当前阶段'], ['goal', '目标'],
  ];
  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardHead} onPress={() => setOpen(!open)}>
        <Text style={styles.cardTitle}>▸ 基础档案</Text>
        <View style={styles.aiTag}><Text style={styles.aiTagText}>AI 自动识别</Text></View>
      </TouchableOpacity>
      {open && (
        <View>
          <TouchableOpacity style={styles.extractBtn} disabled={busy} onPress={async () => { setBusy(true); try { await onExtract(); } finally { setBusy(false); } }}>
            <Text style={styles.extractBtnText}>{busy ? '提取中…' : '⚡ 从聊天记录自动提取'}</Text>
          </TouchableOpacity>
          {fields.map(([k, lbl]) => (
            <View key={k} style={styles.pfRow}>
              <Text style={styles.pfLbl}>{lbl}</Text>
              <TextInput style={styles.pfInput} value={p[k]} placeholder="—" placeholderTextColor="#ccc"
                onChangeText={(t) => onChange({ ...p, [k]: t })} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ===== 快速回复（可展开思路 + 连续对话入口）=====
function QuickReply({ girl, settings, runLLM, onLogHer, onOpenChat }) {
  const [text, setText] = useState('');
  const [noReply, setNoReply] = useState(false);
  const [loading, setLoading] = useState(false);
  const [replies, setReplies] = useState([]);
  const [openIdx, setOpenIdx] = useState(-1);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (res.canceled) return;
    setLoading(true);
    try { setText(await recognizeImage(res.assets[0].uri, settings)); }
    catch (e) { Alert.alert('识别失败', '可手动输入：' + e.message); }
    finally { setLoading(false); }
  };

  const go = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const out = await runLLM({ conversation: text, noReply, g: girl, scene: 'reply' });
      setReplies(parseReplies(out));
      onLogHer(text);
    } catch (e) { Alert.alert('生成失败', e.message); }
    finally { setLoading(false); }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>快速回复</Text>
      <TextInput style={styles.input} multiline placeholder="粘贴她的话，或 女生：… 我：… 格式；也可截图"
        placeholderTextColor="#aaa" value={text} onChangeText={setText} />
      <View style={styles.bar}>
        <TouchableOpacity style={styles.btnGhost} onPress={pick}><Text style={styles.btnGhostText}>📷 截图</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btnGhost} onPress={() => setNoReply(!noReply)}>
          <Text style={[styles.btnGhostText, noReply && styles.on]}>她未回 {noReply ? '✓' : ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btnGhost, { marginRight: 0 }]} onPress={() => onOpenChat()}>
          <Text style={[styles.btnGhostText, { color: '#07C160' }]}>💬 接着聊</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnPrimary} onPress={go} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>出回复</Text>}
        </TouchableOpacity>
      </View>
      {replies.map((r, i) => (
        <View key={i} style={styles.reply}>
          <Text style={styles.replyText}>{r.reply}</Text>
          <TouchableOpacity style={styles.copyBtn} onPress={() => Clipboard.setStringAsync(r.reply).then(() => { recordCopy(r.reply, '回复'); Alert.alert('已复制'); })}>
            <Text style={styles.copyText}>复制</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ideaToggle} onPress={() => setOpenIdx(openIdx === i ? -1 : i)}>
            <Text style={styles.ideaToggleText}>{openIdx === i ? '收起思路' : '模型思路'}</Text>
          </TouchableOpacity>
          {openIdx === i && r.idea ? <Text style={styles.ideaBody}>策略：{r.idea}</Text> : null}
        </View>
      ))}
    </View>
  );
}

// ===== 连续对话视窗 =====
function ChatView({ girl, settings, runLLM, onLog, onClose }) {
  const [conv, setConv] = useState(girl.history.slice(-10));
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [tips, setTips] = useState([]);

  const push = (role, t) => {
    const item = { role, text: t, ts: Date.now() };
    setConv((c) => [...c, item]);
    onLog(role, t);
  };

  const she = async () => {
    if (!text.trim()) return;
    push('her', text);
    setText('');
    setLoading(true);
    try {
      const out = await runLLM({ conversation: conv.map((c) => (c.role === 'her' ? '她：' : c.role === 'me' ? '我：' : '注：') + c.text).join('\n') + '\n她：' + text, g: girl, scene: 'reply' });
      setTips(parseReplies(out));
    } catch (e) { Alert.alert('失败', e.message); }
    finally { setLoading(false); }
  };
  const me = () => { if (!text.trim()) return; push('me', text); setText(''); setTips([]); };

  return (
    <View style={styles.modal}>
      <View style={styles.modalHead}>
        <Text style={styles.modalTitle}>接着聊 · {girl.name}</Text>
        <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
      </View>
      <ScrollView style={styles.chatBox}>
        {conv.map((c, i) => (
          <View key={i} style={[styles.bubble, c.role === 'me' ? styles.bubbleMe : c.role === 'her' ? styles.bubbleHer : styles.bubbleNote]}>
            <Text style={styles.bubbleText}>{c.text}</Text>
          </View>
        ))}
        {tips.map((t, i) => (
          <TouchableOpacity key={i} style={styles.tipBubble} onPress={() => Clipboard.setStringAsync(t.reply).then(() => { recordCopy(t.reply, '接着聊'); Alert.alert('已复制'); })}>
            <Text style={styles.tipText}>💡 {t.reply}</Text>
            {t.idea ? <Text style={styles.tipIdea}>策略：{t.idea}</Text> : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.chatInputRow}>
        <TextInput style={styles.chatInput} value={text} placeholder="她说的话 / 我回的话" placeholderTextColor="#aaa" onChangeText={setText} />
        <TouchableOpacity style={styles.chatBtnHer} onPress={she}><Text style={styles.chatBtnText}>她说的→分析</Text></TouchableOpacity>
        <TouchableOpacity style={styles.chatBtnMe} onPress={me}><Text style={styles.chatBtnText}>我回的</Text></TouchableOpacity>
      </View>
    </View>
  );
}

// ===== 破冰页 =====
function IceBreak({ girl, settings, runLLM, onSave }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState('');
  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (res.canceled) return;
    setLoading(true);
    try { setText(await analyzeImage(res.assets[0].uri, settings, MOMENT_EXTRACT_PROMPT)); }
    catch (e) { Alert.alert('识别失败', e.message); }
    finally { setLoading(false); }
  };
  const go = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try { const r = await runLLM({ scene: 'icebreak', conversation: text }); setOut(r); }
    catch (e) { Alert.alert('失败', e.message); }
    finally { setLoading(false); }
  };
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>破冰 · 刚认识怎么开场</Text>
      <Text style={styles.tip}>传她的朋友圈/主页截图，或直接打字描述。AI 给画像 + 切入点 + 3 条开场白。</Text>
      <TextInput style={styles.input} multiline placeholder="点下方「朋友圈截图」自动提取，或粘贴/输入她的信息…"
        placeholderTextColor="#aaa" value={text} onChangeText={setText} />
      <View style={styles.bar}>
        <TouchableOpacity style={styles.btnGhost} onPress={pick}><Text style={styles.btnGhostText}>📷 朋友圈截图</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btnPrimary} onPress={go} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>出方案</Text>}
        </TouchableOpacity>
      </View>
      <View style={styles.subHeadRow}>
        <Icon name="topic" size={18} color={C.green} />
        <Text style={styles.subHead}>破冰话题库（点一下塞进输入框）</Text>
      </View>
      <View style={styles.chipsWrap}>
        {['旅行', '美食', '宠物', '电影', '健身', '音乐'].map((t) => (
          <TouchableOpacity key={t} style={styles.topicChip} onPress={() => setText((prev) => (prev ? prev + ' ' + t : t))}>
            <Text style={styles.topicChipText}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.tipCard}>
        <Text style={styles.tipCardText}>小贴士：别一上来查户口，从她的兴趣自然切入；开场白≤20字，留个钩子让她接话。</Text>
      </View>
      {out ? (
        <View style={styles.outBox}>
          <Text style={styles.outText}>{out}</Text>
          <View style={styles.bar}>
            <TouchableOpacity style={styles.copyAllBtn} onPress={() => Clipboard.setStringAsync(out).then(() => { recordCopy(out, '破冰'); Alert.alert('已复制'); })}>
              <Text style={styles.copyAllText}>复制全部</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} disabled={!girl} onPress={() => { onSave(out); Alert.alert('已保存', '结果存入「' + girl.name + '」'); }}>
              <Text style={styles.saveBtnText}>保存到 {girl ? girl.name : '—'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ===== Soul / 收号教练页 =====
function SoulView({ girl, settings, runLLM, onSave }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState('');
  const [replies, setReplies] = useState([]);
  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (res.canceled) return;
    setLoading(true);
    try {
      setText(await analyzeImage(res.assets[0].uri, settings,
        '这是社交软件聊天截图。请只提取对话内容，按"她：…"和"我：…"交替输出，忽略头像昵称时间。看不清就如实说。'));
    } catch (e) { Alert.alert('识别失败', e.message); }
    finally { setLoading(false); }
  };
  const go = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const r = await runLLM({ scene: 'soul', conversation: text });
      setOut(r); setReplies(parseReplies(r));
    } catch (e) { Alert.alert('失败', e.message); }
    finally { setLoading(false); }
  };
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Soul · 收号教练</Text>
      <Text style={styles.tip}>贴 Soul/探探 对话，AI 判断热度、该不该收号，并给 3 条回复（含收号话术）。</Text>
      <TextInput style={styles.input} multiline placeholder={'粘贴对话：\n她：…\n我：…\n（也可截图）'} placeholderTextColor="#aaa" value={text} onChangeText={setText} />
      <View style={styles.bar}>
        <TouchableOpacity style={styles.btnGhost} onPress={pick}><Text style={styles.btnGhostText}>📷 聊天截图</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btnPrimary} onPress={go} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>分析</Text>}
        </TouchableOpacity>
      </View>
      <View style={styles.subHeadRow}>
        <Icon name="template" size={18} color={C.green} />
        <Text style={styles.subHead}>收号话术模板库（点一下塞进输入框）</Text>
      </View>
      <View style={styles.chipsWrap}>
        {['周末出来喝杯咖啡？', '晚上一起吃个夜宵？', '有空散个步聊聊？'].map((t) => (
          <TouchableOpacity key={t} style={styles.topicChip} onPress={() => setText((prev) => (prev ? prev + '\n' + t : t))}>
            <Text style={styles.topicChipText}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.tipCard}>
        <Text style={styles.tipCardText}>时机提示：她回得快、主动抛梗、深夜还在聊 → 趁热收号；冷战/敷衍时先别收。</Text>
      </View>
      {replies.length ? replies.map((r, i) => (
        <View key={i} style={styles.reply}>
          <Text style={styles.replyText}>{r.reply}</Text>
          <TouchableOpacity style={styles.copyBtn} onPress={() => Clipboard.setStringAsync(r.reply).then(() => { recordCopy(r.reply, '回复'); Alert.alert('已复制'); })}>
            <Text style={styles.copyText}>复制</Text>
          </TouchableOpacity>
        </View>
      )) : out ? <Text style={styles.outText}>{out}</Text> : null}
      {out ? (
        <TouchableOpacity style={styles.saveBtn} disabled={!girl} onPress={() => { onSave(out); Alert.alert('已保存', '存入「' + girl.name + '」'); }}>
          <Text style={styles.saveBtnText}>保存到 {girl ? girl.name : '—'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ===== 我（设置入口）=====
function MePage({ settings, onOpenSettings, nextResign }) {
  const d = new Date(nextResign);
  return (
    <View style={styles.card}>
      <View style={styles.meHead}>
        <View style={styles.avatar}><Text style={styles.avatarText}>情</Text></View>
        <View>
          <Text style={styles.meName}>情感教练</Text>
          <Text style={styles.meSub}>云端模式 · {settings.cloudModel}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.meRow} onPress={onOpenSettings}>
        <Text style={styles.meRowLbl}>⚙ 设置（Key / 模型 / 暗门 / 重签）</Text>
        <Text style={styles.meRowArrow}>›</Text>
      </TouchableOpacity>
      <View style={styles.meRow}>
        <Text style={styles.meRowLbl}>下次重签</Text>
        <Text style={styles.meRowVal}>{d.getMonth() + 1}月{d.getDate()}日</Text>
      </View>
      <Text style={styles.meNote}>· 数据全部存本机，不联网上传{'\n'}· 每 7 天需重签一次（连电脑 Sideloadly 覆盖装）{'\n'}· 本地专属模型就绪后在设置开启</Text>
    </View>
  );
}

// ===== 回顾：已复制的聊天记录 =====
function ReviewModule() {
  const [list, setList] = useState([]);
  useEffect(() => {
    loadCopied().then(setList);
    return subscribeCopied(setList);
  }, []);
  if (!list.length) return null;
  const fmt = (ts) => {
    const d = new Date(ts);
    const p = (n) => (n < 10 ? '0' + n : '' + n);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Icon name="review" size={18} color={C.green} />
        <Text style={styles.cardTitle}>回顾 · 已复制的聊天</Text>
        <Text style={styles.refresh}>最近 {list.length}</Text>
      </View>
      {list.slice(0, 12).map((it, i) => (
        <View key={i} style={styles.reviewItem}>
          <Text style={styles.reviewText} numberOfLines={3}>{it.text}</Text>
          <Text style={styles.reviewTime}>{fmt(it.ts)}{it.source ? ' · ' + it.source : ''}</Text>
        </View>
      ))}
    </View>
  );
}

// ===== 聊天体检：基于近期聊天给健康度/风险/行动 =====
function ChatHealth({ girl, runLLM }) {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null);
  const run = async () => {
    if (!girl?.history?.length) { Alert.alert('暂无聊天', '先在快速回复里粘贴一些对话，或导入历史聊天'); return; }
    setLoading(true);
    try {
      const out = await runLLM({ scene: 'health', g: girl });
      setRes(parseHealth(out));
    } catch (e) { Alert.alert('体检失败', e.message); }
    finally { setLoading(false); }
  };
  const color = !res ? '#888' : res.health === '高' ? '#07C160' : res.health === '中' ? '#FF9F0A' : '#FA5151';
  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardHead} onPress={run} disabled={loading} activeOpacity={0.7}>
        <Icon name="tip" size={18} color={C.green} />
        <Text style={styles.cardTitle}>聊天体检</Text>
        <Text style={styles.refresh}>{loading ? '体检中…' : (res ? '↻ 重测' : '点我体检')}</Text>
      </TouchableOpacity>
      {res && (
        <View style={{ marginTop: 4 }}>
          <Text style={[styles.healthVal, { color }]}>健康度：{res.health}（{res.healthNum}）</Text>
          {res.risk ? <Text style={styles.healthLine}>⚠️ 近期风险：{res.risk}</Text> : null}
          {res.do ? <Text style={styles.healthLine}>✅ 该做的一件事：{res.do}</Text> : null}
        </View>
      )}
    </View>
  );
}

// ===== 导入历史聊天 =====
function ImportModal({ girl, onClose, onImport }) {
  const [text, setText] = useState('');
  const doParse = () => {
    const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
    const h = [];
    for (const line of lines) {
      const m = line.match(/^(她|女生|对方|妹|姐|妹子|女生说|她:)\s*[:：]?\s*(.*)$/);
      const me = line.match(/^(我|本人|我:)\s*[:：]?\s*(.*)$/);
      if (m) h.push({ role: 'her', text: m[2], ts: Date.now() });
      else if (me) h.push({ role: 'me', text: me[2], ts: Date.now() });
      else if (line.includes('：') || line.includes(':')) {
        const idx = line.indexOf(line.includes('：') ? '：' : ':');
        const who = line.slice(0, idx), what = line.slice(idx + 1);
        const role = /她|女生|对方|妹|姐/.test(who) ? 'her' : /我|本人/.test(who) ? 'me' : 'her';
        h.push({ role, text: what, ts: Date.now() });
      } else h.push({ role: 'her', text: line, ts: Date.now() });
    }
    if (!h.length) { Alert.alert('没解析到', '按"她：…"和"我：…"分行粘贴'); return; }
    onImport(h);
  };
  return (
    <View style={styles.modal}>
      <View style={styles.modalHead}>
        <Text style={styles.modalTitle}>导入历史聊天 → {girl ? girl.name : '未选女生'}</Text>
        <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
      </View>
      <Text style={styles.tip}>按行粘贴，用「她：…」「我：…」区分。导入后自动进入她的记忆，用于仪表盘分析。</Text>
      <TextInput style={[styles.input, { flex: 1 }]} multiline placeholder={'她：今天好累\n我：怎么了，加班？\n她：对啊改方案'} placeholderTextColor="#aaa" value={text} onChangeText={setText} />
      <TouchableOpacity style={styles.btnPrimary} onPress={doParse}>
        <Text style={styles.btnText}>解析并导入</Text>
      </TouchableOpacity>
    </View>
  );
}

// ===== 改名 / 添加 =====
function NameModal({ modal, onClose, onConfirm }) {
  const [name, setName] = useState(modal.name || '');
  return (
    <View style={styles.modal}>
      <View style={styles.modalHead}>
        <Text style={styles.modalTitle}>{modal.mode === 'add' ? '添加女生' : '改名'}</Text>
        <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
      </View>
      <TextInput style={styles.input} autoFocus placeholder="名字，如 小A" placeholderTextColor="#aaa" value={name} onChangeText={setName} />
      <TouchableOpacity style={styles.btnPrimary} onPress={() => name.trim() && onConfirm(name.trim())}>
        <Text style={styles.btnText}>确定</Text>
      </TouchableOpacity>
    </View>
  );
}

// ===== 助手：内置情感/展示面顾问（通用 Q&A + 图片分析 + P图交接词）=====
function AssistantScreen({ settings }) {
  const [msgs, setMsgs] = useState([
    {
      role: 'ai',
      text:
        '我是你的情感 / 展示面顾问。\n' +
        '可以问我：展示面怎么搭、现在展示面有什么问题、什么时候该发展示面、该塑造什么形象。\n' +
        '也能发照片让我分析（涉及修图时，我会给你可直接粘到其他图像 AI 的「P图交接词」）。',
    },
  ]);
  const [text, setText] = useState('');
  const [img, setImg] = useState(null);
  const [loading, setLoading] = useState(false);
  const scroll = useRef(null);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!res.canceled) setImg(res.assets[0].uri);
  };

  const send = async () => {
    if (!text.trim() && !img) return;
    const q = text.trim();
    setMsgs((m) => [...m, { role: 'user', text: q || '（图片）', image: img || null }]);
    setText('');
    setImg(null);
    setLoading(true);
    try {
      let out;
      if (img) {
        const promptText = ASSISTANT_VISION_PROMPT + '\n\n用户附言：' + (q || '请分析这张照片（展示面 / 形象方向）');
        out = await analyzeImage(img, settings, promptText);
      } else {
        if (settings.useLocal) { await ensureLocal(settings); }
        out = await generate(
          ASSISTANT_SYSTEM,
          q,
          { ...settings, useLocal: settings.useLocal && isLocalReady() },
          { maxTokens: 1200 }
        );
      }
      setMsgs((m) => [...m, { role: 'ai', text: out }]);
    } catch (e) { Alert.alert('出错', e.message); }
    finally { setLoading(false); }
  };

  return (
    <View style={styles.contentWrap}>
      <ScrollView
        style={styles.content}
        ref={scroll}
        onContentSizeChange={() => scroll.current && scroll.current.scrollToEnd({ animated: true })}
      >
        {msgs.map((m, i) => {
          if (m.role === 'user') {
            return (
              <View key={i} style={styles.assRowUser}>
                {m.image ? <Image source={{ uri: m.image }} style={styles.assUserImg} /> : null}
                <View style={[styles.bubble, styles.bubbleMe]}>
                  <Text style={styles.bubbleText}>{m.text}</Text>
                </View>
              </View>
            );
          }
          const parsed = parseAssistant(m.text);
          return (
            <View key={i} style={styles.assRowAi}>
              <View style={[styles.bubble, styles.bubbleHer]}>
                <Text style={styles.bubbleText}>{parsed.body}</Text>
                {parsed.handoff ? (
                  <View style={styles.handoffBox}>
                    <Text style={styles.handoffTitle}>🖼 P图交接词（粘到其他图像 AI）</Text>
                    <Text style={styles.handoffCn}>{parsed.handoff.cn}</Text>
                    {parsed.handoff.en ? <Text style={styles.handoffEn}>EN：{parsed.handoff.en}</Text> : null}
                    <View style={styles.bar}>
                      <TouchableOpacity style={styles.copyBtn} onPress={() => Clipboard.setStringAsync(parsed.handoff.cn).then(() => Alert.alert('已复制', '中文提示词已复制'))}>
                        <Text style={styles.copyText}>复制中文</Text>
                      </TouchableOpacity>
                      {parsed.handoff.en ? (
                        <TouchableOpacity style={styles.copyBtn} onPress={() => Clipboard.setStringAsync(parsed.handoff.en).then(() => Alert.alert('已复制', '英文关键词已复制'))}>
                          <Text style={styles.copyText}>复制英文</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ) : null}
                <TouchableOpacity style={styles.copyAllInline} onPress={() => Clipboard.setStringAsync(m.text).then(() => Alert.alert('已复制'))}>
                  <Text style={styles.copyAllInlineText}>复制全部</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        {loading ? (
          <View style={styles.assRowAi}>
            <View style={[styles.bubble, styles.bubbleHer]}>
              <ActivityIndicator color="#999" />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.assistInput}>
        {img ? (
          <View style={styles.imgPrev}>
            <Image source={{ uri: img }} style={styles.imgPrevImg} />
            <TouchableOpacity style={styles.imgPrevX} onPress={() => setImg(null)}>
              <Text style={styles.imgPrevXText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={styles.assistRow}>
          <TouchableOpacity style={styles.assistCam} onPress={pick}>
            <Text style={styles.assistCamText}>📷</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.assistText}
            value={text}
            placeholder="问点什么，或附一张照片…"
            placeholderTextColor="#aaa"
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity style={styles.assistSend} onPress={send} disabled={loading}>
            <Text style={styles.btnText}>{loading ? '…' : '发送'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const C = {
  cardBg: '#fff', green: '#07C160', gray: '#999', line: '#F0F0F0', bg: '#EDEDED',
};
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingTop: TOP },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { color: '#888', fontSize: 16 },
  hint: { color: '#888', fontSize: 14, padding: 12 },
  card: { backgroundColor: C.cardBg, borderRadius: 12, margin: 10, padding: 12 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  healthVal: { fontSize: 15, fontWeight: '700', color: '#191919', marginBottom: 4 },
  healthLine: { fontSize: 13, color: '#444', lineHeight: 20, marginTop: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#191919' },
  refresh: { fontSize: 12, color: '#576B95' },
  aiTag: { borderWidth: 1, borderColor: C.green, borderRadius: 9, paddingVertical: 2, paddingHorizontal: 6 },
  aiTagText: { fontSize: 10, color: C.green },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  rowLbl: { fontSize: 13, color: '#999', width: 54 },
  rowVal: { fontSize: 12, color: '#191919', marginLeft: 8 },
  dots: { flexDirection: 'row' },
  dotC: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5E5E5', marginRight: 6 },
  dotCOn: { backgroundColor: C.green },
  barBg: { width: 100, height: 8, borderRadius: 4, backgroundColor: '#EFEFEF', marginLeft: 8 },
  barFg: { height: 8, borderRadius: 4, backgroundColor: C.green },
  foldRow: { marginTop: 10, paddingVertical: 4 },
  foldLbl: { fontSize: 14, color: '#191919' },
  foldBody: { fontSize: 14, color: '#444', lineHeight: 21, marginTop: 4 },
  pfRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  pfLbl: { fontSize: 12, color: '#999', width: 70 },
  pfInput: { flex: 1, borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 8, fontSize: 14, color: '#222', backgroundColor: '#fafafa' },
  extractBtn: { backgroundColor: '#E8F8EE', borderRadius: 8, padding: 10, marginTop: 8, alignItems: 'center' },
  extractBtnText: { color: C.green, fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#e2e2ef', borderRadius: 10, minHeight: 70, padding: 10, fontSize: 15, color: '#222', backgroundColor: '#fafafa', textAlignVertical: 'top' },
  bar: { flexDirection: 'row', marginTop: 8, alignItems: 'center', flexWrap: 'wrap' },
  btnGhost: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#F0F0F0', marginRight: 8 },
  btnGhostText: { fontSize: 13, color: '#555' },
  on: { color: C.green, fontWeight: '700' },
  btnPrimary: { marginLeft: 'auto', backgroundColor: C.green, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 },
  btnText: { color: '#fff', fontWeight: '700' },
  reply: { marginTop: 10, backgroundColor: '#F6F6F6', borderRadius: 10, padding: 10 },
  replyText: { fontSize: 15, color: '#222', lineHeight: 22 },
  copyBtn: { marginTop: 6, alignSelf: 'flex-end', backgroundColor: C.green, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 12 },
  copyText: { color: '#fff', fontSize: 13 },
  ideaToggle: { marginTop: 4, alignSelf: 'flex-start' },
  ideaToggleText: { fontSize: 11, color: '#576B95' },
  ideaBody: { fontSize: 12, color: '#666', marginTop: 2, fontStyle: 'italic' },
  importBtn: { margin: 10, marginTop: 4, backgroundColor: '#E8F8EE', borderRadius: 10, padding: 12, alignItems: 'center' },
  importBtnText: { color: C.green, fontSize: 13, fontWeight: '600' },
  tip: { fontSize: 13, color: '#888', lineHeight: 19, marginBottom: 8 },
  outBox: { marginTop: 10, backgroundColor: '#F6F6F6', borderRadius: 10, padding: 10 },
  outText: { fontSize: 15, color: '#222', lineHeight: 22 },
  copyAllBtn: { marginTop: 8, alignSelf: 'flex-end', backgroundColor: C.green, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14 },
  copyAllText: { color: '#fff', fontSize: 13 },
  saveBtn: { marginTop: 10, backgroundColor: '#576B95', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, alignSelf: 'flex-end' },
  saveBtnText: { color: '#fff', fontSize: 13 },
  chips: { maxHeight: 50, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: C.bg },
  chip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 16, backgroundColor: '#fff', marginRight: 8, borderWidth: 1, borderColor: '#E0E0E0' },
  chipOn: { backgroundColor: C.green, borderColor: C.green },
  chipText: { color: '#444', fontSize: 15 },
  chipTextOn: { color: '#fff', fontWeight: '700' },
  chipAdd: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: C.green },
  chipAddText: { color: C.green, fontSize: 14 },
  tabbar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E5E5', paddingBottom: 20, paddingTop: 8 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 4, position: 'relative' },
  tabIcon: { fontSize: 26, color: '#999' },
  tabIconOn: { color: C.green },
  tabLabel: { fontSize: 12, color: '#999', marginTop: 2 },
  tabLabelOn: { color: C.green, fontWeight: '700' },
  edgeGrabber: { position: 'absolute', top: TOP, left: 0, bottom: 0, width: 22, zIndex: 25 },
  edgeDot: { position: 'absolute', top: 80, left: 4, width: 9, height: 9, borderRadius: 5, backgroundColor: '#FA5151' },
  drawerMask: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 40 },
  drawerPanel: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 320, backgroundColor: C.bg, paddingTop: TOP + 8, paddingHorizontal: 14, paddingBottom: 20 },
  drawerClose: { marginTop: 16, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  drawerCloseText: { color: '#555', fontSize: 15 },
  meHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  meName: { fontSize: 17, fontWeight: '700', color: '#191919' },
  meSub: { fontSize: 12, color: '#999', marginTop: 2 },
  meRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.line },
  meRowLbl: { fontSize: 15, color: '#222' },
  meRowVal: { fontSize: 13, color: '#999' },
  meRowArrow: { fontSize: 18, color: '#ccc' },
  meNote: { marginTop: 12, fontSize: 12, color: '#888', lineHeight: 20 },
  modal: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#EDEDED', padding: 14, zIndex: 20, paddingTop: 40 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#191919' },
  modalClose: { fontSize: 20, color: '#888' },
  chatBox: { flex: 1, marginBottom: 10 },
  bubble: { maxWidth: '78%', borderRadius: 10, padding: 10, marginVertical: 4 },
  bubbleHer: { backgroundColor: '#fff', alignSelf: 'flex-start' },
  bubbleMe: { backgroundColor: C.green, alignSelf: 'flex-end' },
  bubbleNote: { backgroundColor: '#FCE9C8', alignSelf: 'center', maxWidth: '90%' },
  bubbleText: { fontSize: 14, color: '#222' },
  tipBubble: { backgroundColor: '#E8F8EE', borderRadius: 10, padding: 10, marginVertical: 4, alignSelf: 'flex-end', maxWidth: '85%' },
  tipText: { fontSize: 14, color: '#222' },
  tipIdea: { fontSize: 11, color: '#07C160', marginTop: 2 },
  chatInputRow: { flexDirection: 'row', alignItems: 'center' },
  chatInput: { flex: 1, borderWidth: 1, borderColor: '#e2e2ef', borderRadius: 10, padding: 10, fontSize: 14, backgroundColor: '#fafafa', marginRight: 6 },
  chatBtnHer: { backgroundColor: C.green, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 10, marginRight: 6 },
  chatBtnMe: { backgroundColor: '#576B95', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 10 },
  chatBtnText: { color: '#fff', fontSize: 12 },
  // 助手页
  contentWrap: { flex: 1 },
  assRowUser: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-start', paddingHorizontal: 10, marginVertical: 6 },
  assRowAi: { flexDirection: 'row', justifyContent: 'flex-start', paddingHorizontal: 10, marginVertical: 6 },
  assUserImg: { width: 70, height: 70, borderRadius: 8, marginRight: 8 },
  assistInput: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E5E5', paddingHorizontal: 10, paddingVertical: 8 },
  imgPrev: { position: 'relative', alignSelf: 'flex-end', marginBottom: 6 },
  imgPrevImg: { width: 80, height: 80, borderRadius: 8 },
  imgPrevX: { position: 'absolute', top: -6, right: -6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  imgPrevXText: { color: '#fff', fontSize: 12 },
  assistRow: { flexDirection: 'row', alignItems: 'flex-end' },
  assistCam: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  assistCamText: { fontSize: 18 },
  assistText: { flex: 1, borderWidth: 1, borderColor: '#E2E2EF', borderRadius: 10, padding: 10, fontSize: 15, color: '#222', backgroundColor: '#FAFAFA', maxHeight: 100, textAlignVertical: 'top' },
  assistSend: { marginLeft: 8, backgroundColor: C.green, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  handoffBox: { marginTop: 8, backgroundColor: '#FFF8E6', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#F3E2B0' },
  handoffTitle: { fontSize: 12, fontWeight: '700', color: '#B8860B', marginBottom: 4 },
  handoffCn: { fontSize: 13, color: '#5A4B00', lineHeight: 19 },
  handoffEn: { fontSize: 12, color: '#8A7A2E', marginTop: 4, lineHeight: 17 },
  copyAllInline: { marginTop: 6, alignSelf: 'flex-end' },
  copyAllInlineText: { fontSize: 11, color: '#576B95' },
  // 锁定页
  lockRoot: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F2F2F2', zIndex: 30 },
  crashCard: { position: 'absolute', top: '38%', left: 30, right: 30, backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
  crashTitle: { fontSize: 18, fontWeight: '700', color: '#191919', marginBottom: 10 },
  crashText: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 21 },
  crashBtn: { marginTop: 18, backgroundColor: '#07C160', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 30 },
  crashBtnText: { color: '#fff', fontSize: 14 },
  gestureLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  zoneHint: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  zoneHintText: { fontSize: 13, color: '#bbb', fontWeight: '700' },
  hintSmall: { position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', fontSize: 12, color: '#999' },
  // 通用小标题（填充图标）
  subHead: { fontSize: 14, fontWeight: '700', color: '#191919', marginTop: 14, marginBottom: 8 },
  subHeadRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 8, gap: 6 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  topicChip: { backgroundColor: '#F2F2F2', borderRadius: 16, paddingVertical: 9, paddingHorizontal: 14, marginRight: 8, marginBottom: 8 },
  topicChipText: { fontSize: 14, color: '#444' },
  tipCard: { backgroundColor: '#FFF8E6', borderRadius: 10, padding: 12, marginTop: 6, borderWidth: 1, borderColor: '#F3E2B0' },
  tipCardText: { fontSize: 13, color: '#8A6D00', lineHeight: 20 },
  // 仪表盘建议行（可复制）
  adviceLine: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F6F6F6', borderRadius: 8, padding: 8, marginTop: 6 },
  adviceText: { flex: 1, fontSize: 14, color: '#222', lineHeight: 20 },
  // 回顾模块
  reviewItem: { backgroundColor: '#F6F6F6', borderRadius: 8, padding: 10, marginTop: 8 },
  reviewText: { fontSize: 14, color: '#222', lineHeight: 20 },
  reviewTime: { fontSize: 11, color: '#999', marginTop: 4 },
});
