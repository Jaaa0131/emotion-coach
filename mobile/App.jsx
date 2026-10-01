// App.jsx —— 情感教练 v4
// 微信风抬头 / 底部 Tab（选中图标实心填充变绿）/ 消息页左右对话分区（左她右我，可连发多条、不设上限）
// 四页常驻挂载（切 Tab 内容不丢）/ 设置改半屏弹窗 / 字号放大 + 输入框 iOS 塌陷修复
import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator,
  Alert, Dimensions, Image, StatusBar, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import Settings from './src/components/Settings';
import {
  loadSettings, saveSettings, loadGirls, saveGirls, newGirl,
  loadCopied, subscribeCopied, recordCopy, loadAssistant, saveAssistant,
} from './src/lib/storage';
import {
  buildSystem, buildUser, parseReplies, parseDashboard, parseProfile, parseHealth,
  ASSISTANT_SYSTEM, ASSISTANT_VISION_PROMPT, parseAssistant, parseScriptGroups, splitScriptText,
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
const TOP = Platform.OS === 'ios' ? 64 : ((StatusBar.currentHeight || 0) + 16);

export default function App() {
  const [settings, setSettings] = useState(null);
  const [girls, setGirls] = useState([]);
  const [selId, setSelId] = useState(null);
  const [tab, setTab] = useState('messages');
  const [unlocked, setUnlocked] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [nameModal, setNameModal] = useState(null); // {mode:'add'|'rename', id?, name?}

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
      if (!ok) Alert.alert('本地模型未就绪', '已改用云端；去设置里确认模型文件已拷入');
    }
    return await generate(sys, user, { ...settings, useLocal: settings.useLocal && isLocalReady() });
  };

  const addGirl = () => setNameModal({ mode: 'add' });
  const renameGirl = (g) => setNameModal({ mode: 'rename', id: g.id, name: g.name });
  const deleteGirl = (g) => {
    Alert.alert('删除', '确定删除「' + g.name + '」及她的所有记录？', [
      { text: '取消' },
      {
        text: '删除', style: 'destructive', onPress: () => {
          const next = girls.filter((x) => x.id !== g.id);
          persist(next);
          setSelId(next[0]?.id || null);
        },
      },
    ]);
  };

  const onSaveSettings = (s) => { setSettings(s); saveSettings(s); };

  const nextResign = settings.resignDate + 7 * 86400000;
  const daysLeft = (nextResign - Date.now()) / 86400000;
  const redDot = daysLeft <= 1;

  const girlBar = (showAdd = true) => (
    <GirlTabs girls={girls} selId={selId} onSelect={setSelId}
      onAdd={addGirl} onRename={renameGirl} onDelete={deleteGirl} />
  );

  return (
    <View style={styles.root}>
      {settings.disguiseOn && !unlocked && <LockScreen onUnlock={() => setUnlocked(true)} cfg={settings.unlock} />}

      {/* 四个页面常驻挂载，非当前页 display:none —— 切 Tab 不再卸载，生成的内容不会丢 */}
      <View style={{ flex: 1 }}>
        <View style={[styles.page, tab === 'messages' ? styles.pageOn : styles.pageOff]}>
          <MessagesPage
            girl={girl} settings={settings} runLLM={runLLM} updateGirl={updateGirl} logMsg={logMsg}
            girlBar={girlBar(true)} redDot={redDot} onOpenSettings={() => setShowSettings(true)}
            onOpenImport={() => setShowImport(true)} />
        </View>

        <View style={[styles.page, tab === 'icebreak' ? styles.pageOn : styles.pageOff]}>
          <View style={styles.pageWrap}>
            <PageHeader title="破冰" right={<GearButton onPress={() => setShowSettings(true)} redDot={redDot} />} />
            {girlBar(true)}
            <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
              {!girl && <Text style={styles.hint}>先在上方选一个女生，结果会保存到她名下</Text>}
              <IceBreak girl={girl} settings={settings} runLLM={runLLM}
                onSave={(out) => girl && logMsg(girl.id, 'note', '【破冰】' + out)} />
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>

        <View style={[styles.page, tab === 'soul' ? styles.pageOn : styles.pageOff]}>
          <View style={styles.pageWrap}>
            <PageHeader title="Soul" right={<GearButton onPress={() => setShowSettings(true)} redDot={redDot} />} />
            {girlBar(true)}
            <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
              {!girl && <Text style={styles.hint}>先在上方选一个女生，结果会保存到她名下</Text>}
              <SoulView girl={girl} settings={settings} runLLM={runLLM}
                onSave={(out) => girl && logMsg(girl.id, 'note', '【Soul/收号】' + out)} />
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>

        <View style={[styles.page, tab === 'assistant' ? styles.pageOn : styles.pageOff]}>
          <AssistantScreen settings={settings} redDot={redDot} onOpenSettings={() => setShowSettings(true)} />
        </View>
      </View>

      <View style={styles.tabbar}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <TouchableOpacity key={t.key} style={styles.tabItem} onPress={() => setTab(t.key)} activeOpacity={0.7}>
              <Icon name={t.icon} size={26} color={on ? C.green : '#999'} filled={on} strokeWidth={1.5} />
              <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {showSettings && (
        <Settings settings={settings} onSave={onSaveSettings} onClose={() => setShowSettings(false)} />
      )}
      {showImport && (
        <ImportModal girl={girl} onClose={() => setShowImport(false)}
          onImport={(h) => { if (girl) updateGirl(girl.id, { history: [...girl.history, ...h] }); setShowImport(false); }} />
      )}
      {nameModal && (
        <NameModal modal={nameModal} onClose={() => setNameModal(null)}
          onConfirm={(name) => {
            if (nameModal.mode === 'add') { const g = newGirl(name); persist([...girls, g]); setSelId(g.id); }
            else updateGirl(nameModal.id, { name });
            setNameModal(null);
          }} />
      )}
    </View>
  );
}

// ===== 微信式抬头：浅灰底 + 居中标题 + 底部细分割线 =====
function PageHeader({ title, left, right }) {
  return (
    <View style={styles.hdr}>
      <View style={styles.hdrSide}>{left}</View>
      <Text style={styles.hdrTitle} numberOfLines={1}>{title}</Text>
      <View style={[styles.hdrSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

function GearButton({ onPress, redDot }) {
  return (
    <TouchableOpacity style={styles.gearBtn} onPress={onPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Icon name="gear" size={22} color="#333" strokeWidth={1.6} />
      {redDot ? <View style={styles.gearDot} /> : null}
    </TouchableOpacity>
  );
}

// ===== 暗门锁定页：伪装成崩溃报错，左上点 N 次 → 右下点 M 次（严格顺序，乱按不解锁）=====
function LockScreen({ onUnlock, cfg }) {
  const tl = (cfg && cfg.tl) || 2;
  const br = (cfg && cfg.br) || 3;
  const expected = useMemo(() => [...Array(tl).fill('TL'), ...Array(br).fill('BR')], [tl, br]);
  const [idx, setIdx] = useState(0);

  const tap = (zone) => {
    if (zone === expected[idx]) {
      const n = idx + 1;
      if (n >= expected.length) onUnlock();
      else setIdx(n);
    } else setIdx(0);
  };

  const tlDone = Math.min(idx, tl);
  const brDone = Math.max(0, idx - tl);

  return (
    <View style={styles.lockRoot}>
      <View style={styles.crashCard} pointerEvents="none">
        <Text style={styles.crashTitle}>SnapBridge 已停止运行</Text>
        <Text style={styles.crashText}>很抱歉，应用发生错误并已关闭。{'\n'}请稍后重试。</Text>
        <View style={styles.crashBtn}><Text style={styles.crashBtnText}>关闭</Text></View>
      </View>
      <TouchableOpacity style={styles.gestureLayer} activeOpacity={1}
        onPress={(e) => {
          const { locationX, locationY } = e.nativeEvent;
          let zone = 'OTHER';
          if (locationX < SW * 0.4 && locationY < SH * 0.4) zone = 'TL';
          else if (locationX > SW * 0.6 && locationY > SH * 0.6) zone = 'BR';
          tap(zone);
        }}>
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

// ===== 消息页：状态摘要条 + 左右对话流 + 底部输入条 =====
function MessagesPage({ girl, settings, runLLM, updateGirl, logMsg, girlBar, redDot, onOpenSettings, onOpenImport }) {
  const [showDetail, setShowDetail] = useState(false);
  const [text, setText] = useState('');
  const [noReply, setNoReply] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const scrollRef = useRef(null);
  const d = girl?.dashboard;
  const lit = d?.stageNum || 0;

  // 切换女生时清空上一人的建议话术（切 Tab 不清，因为页面常驻挂载）
  useEffect(() => { setGroups([]); }, [girl?.id]);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (res.canceled) return;
    setLoading(true);
    try { setText(await recognizeImage(res.assets[0].uri, settings)); }
    catch (e) { Alert.alert('识别失败', '可手动输入：' + e.message); }
    finally { setLoading(false); }
  };

  const gen = async () => {
    if (!text.trim()) return;
    if (!girl) { Alert.alert('先添加一个女生', '点上方「+ 添加」'); return; }
    setLoading(true);
    try {
      const out = await runLLM({ conversation: text, noReply, g: girl, scene: 'reply' });
      const gs = parseScriptGroups(out);
      setGroups(gs.length
        ? gs
        : parseReplies(out).map((r) => ({ items: [{ role: 'me', text: r.reply }], idea: r.idea || '' })));
      if (!noReply) logMsg(girl.id, 'her', text);
      setText('');
      setTimeout(() => scrollRef.current && scrollRef.current.scrollToEnd({ animated: true }), 120);
    } catch (e) { Alert.alert('生成失败', e.message); }
    finally { setLoading(false); }
  };

  const logHer = () => { if (girl && text.trim()) { logMsg(girl.id, 'her', text); setText(''); } };
  const logMe = () => { if (girl && text.trim()) { logMsg(girl.id, 'me', text); setText(''); } };

  const history = girl?.history || [];

  return (
    <View style={styles.pageWrap}>
      <PageHeader title={girl ? girl.name : '消息'} right={<GearButton onPress={onOpenSettings} redDot={redDot} />} />
      {girlBar}

      {/* 状态摘要条（点「详情 ›」展开仪表盘 + 档案） */}
      <TouchableOpacity style={styles.statusBar} onPress={() => setShowDetail(!showDetail)} activeOpacity={0.7}>
        <View style={styles.dots}>
          {[1, 2, 3, 4, 5].map((i) => <View key={i} style={[styles.dotC, i <= lit && styles.dotCOn]} />)}
        </View>
        <Text style={styles.statusText} numberOfLines={1}>
          {`${d?.stage || '未分析'}${d?.interest ? ' · 兴趣' + d.interest : ''}${d?.mine ? ' · ⚠ ' + d.mine : ''}`}
        </Text>
        <Text style={styles.detailLink}>{showDetail ? '收起 ⌄' : '详情 ›'}</Text>
      </TouchableOpacity>

      {showDetail && (
        <ScrollView style={{ maxHeight: SH * 0.5 }} keyboardShouldPersistTaps="handled">
          <Dashboard girl={girl} runLLM={runLLM} updateGirl={updateGirl} />
          <ChatHealth girl={girl} runLLM={runLLM} />
          <ProfileCard girl={girl}
            onChange={(p) => girl && updateGirl(girl.id, { profile: p })}
            onExtract={async () => {
              if (!girl) return;
              if (!girl.history.length) { Alert.alert('暂无聊天', '先在下面输入框记几条对话，或导入历史聊天'); return; }
              const out = await runLLM({ scene: 'extract', g: girl });
              const p = parseProfile(out);
              const merged = { ...girl.profile };
              Object.keys(p).forEach((k) => { if (p[k] && p[k] !== '未知') merged[k] = p[k]; });
              updateGirl(girl.id, { profile: merged });
              Alert.alert('已提取', '已从聊天填充档案，去档案卡核对补充');
            }} />
          <TouchableOpacity style={styles.importBtn} onPress={onOpenImport}>
            <Text style={styles.importBtnText}>导入历史聊天（存入「{girl ? girl.name : '—'}」）</Text>
          </TouchableOpacity>
          <ReviewModule />
        </ScrollView>
      )}

      {/* 对话流：左=她（白），右=我（绿）；不设上限，可滑动 */}
      <ScrollView style={styles.chatScroll} ref={scrollRef} keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => groups.length && scrollRef.current && scrollRef.current.scrollToEnd({ animated: true })}>
        {!girl && <Text style={styles.hint}>还没有档案，点上方「+ 添加」开始</Text>}
        {history.map((h, i) => (
          <View key={i} style={[styles.bubble, h.role === 'me' ? styles.bubbleMe : h.role === 'her' ? styles.bubbleHer : styles.bubbleNote]}>
            <Text style={[styles.bubbleText, h.role === 'me' && styles.bubbleTextMe]}>{h.text}</Text>
          </View>
        ))}
        {groups.length ? <View style={styles.scriptDivider}><Text style={styles.scriptDividerText}>建议话术（点复制可直接发）</Text></View> : null}
        {groups.map((g, i) => <ScriptGroup key={i} group={g} index={i} />)}
        {loading ? (
          <View style={styles.loadingRow}><ActivityIndicator color="#999" /><Text style={styles.loadingText}>生成中…</Text></View>
        ) : null}
        <View style={{ height: 12 }} />
      </ScrollView>

      {/* 底部输入条（微信同款：常驻 + 大字号） */}
      <View style={styles.inputBar}>
        <View style={styles.inputBarTop}>
          <TouchableOpacity onPress={() => setNoReply(!noReply)} style={styles.noReplyChip}>
            <Text style={[styles.noReplyText, noReply && styles.noReplyTextOn]}>她还没回 {noReply ? '✓' : ''}</Text>
          </TouchableOpacity>
          {text.trim() ? (
            <TouchableOpacity onPress={logHer} style={styles.noReplyChip}>
              <Text style={styles.noReplyText}>记为「她说的」</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={pick}>
            <Icon name="camera" size={22} color="#555" strokeWidth={1.6} />
          </TouchableOpacity>
          <TextInput
            style={styles.chatInput}
            value={text}
            onChangeText={setText}
            multiline
            placeholder="她说了什么…（可截图识别）"
            placeholderTextColor="#bbb"
          />
          <TouchableOpacity style={styles.smallBtn} onPress={logMe}>
            <Text style={styles.smallBtnText}>我回的</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sendBtn} onPress={gen} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>出回复</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ===== 左右对话方案块：左=她（白气泡），右=我（绿气泡），每条可复制 =====
function ScriptGroup({ group, index }) {
  const items = group.items || [];
  if (!items.length) return null;
  return (
    <View style={styles.scriptGroup}>
      <Text style={styles.scriptTag}>方案 {index + 1}</Text>
      {items.map((it, i) => {
        const mine = it.role === 'me';
        return (
          <View key={i} style={[styles.bubble, mine ? styles.bubbleMe : styles.bubbleHer]}>
            <Text style={[styles.bubbleText, mine && styles.bubbleTextMe]}>{it.text}</Text>
            <TouchableOpacity style={styles.bubbleCopy}
              onPress={() => Clipboard.setStringAsync(it.text).then(() => { recordCopy(it.text, mine ? '我的话' : '她的话'); Alert.alert('已复制', mine ? '粘到微信就能发' : '已复制她的话'); })}>
              <Text style={[styles.bubbleCopyText, mine && styles.bubbleCopyTextOn]}>复制</Text>
            </TouchableOpacity>
          </View>
        );
      })}
      {group.idea ? <Text style={styles.scriptIdea}>思路：{group.idea}</Text> : null}
    </View>
  );
}

// ===== 关系仪表盘 =====
function Dashboard({ girl, runLLM, updateGirl }) {
  const [showNext, setShowNext] = useState(false);
  const [showAdvice, setShowAdvice] = useState(false);
  const [loading, setLoading] = useState(false);
  const d = girl?.dashboard;
  const lit = d?.stageNum || 0;

  const refresh = async () => {
    if (!girl) return;
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
        <Text style={styles.foldLbl}>▸ 建议 · 补救操作（点开可复制）</Text>
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
  const p = girl?.profile || {};
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
            <Text style={styles.extractBtnText}>{busy ? '提取中…' : '从聊天记录自动提取'}</Text>
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

// ===== 破冰页 =====
function IceBreak({ girl, settings, runLLM, onSave }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState('');
  const [groups, setGroups] = useState([]);
  const [body, setBody] = useState('');

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
    try {
      const r = await runLLM({ scene: 'icebreak', conversation: text });
      setOut(r);
      const sp = splitScriptText(r);
      setBody(sp.body);
      setGroups(sp.groups);
    } catch (e) { Alert.alert('失败', e.message); }
    finally { setLoading(false); }
  };
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>破冰 · 刚认识怎么开场</Text>
      <Text style={styles.tip}>传她的朋友圈/主页截图，或直接打字描述。左边是她的画像/反应，右边是你能直接发的开场白。</Text>
      <TextInput style={styles.input} multiline placeholder="点下方「朋友圈截图」自动提取，或粘贴/输入她的信息…"
        placeholderTextColor="#aaa" value={text} onChangeText={setText} />
      <View style={styles.bar}>
        <TouchableOpacity style={styles.btnGhost} onPress={pick}><Text style={styles.btnGhostText}>朋友圈截图</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btnPrimary} onPress={go} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>出方案</Text>}
        </TouchableOpacity>
      </View>
      <View style={styles.subHeadRow}>
        <Icon name="topic" size={18} color={C.green} strokeWidth={1.6} />
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
          {body ? <Text style={styles.outText}>{body}</Text> : null}
          {groups.length ? <View style={styles.scriptDivider}><Text style={styles.scriptDividerText}>可复制话术（右绿=你发）</Text></View> : null}
          {groups.map((g, i) => <ScriptGroup key={i} group={g} index={i} />)}
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
  const [groups, setGroups] = useState([]);
  const [body, setBody] = useState('');

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
      setOut(r);
      const sp = splitScriptText(r);
      setBody(sp.body);
      setGroups(sp.groups);
    } catch (e) { Alert.alert('失败', e.message); }
    finally { setLoading(false); }
  };
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Soul · 收号教练</Text>
      <Text style={styles.tip}>贴 Soul/探探 对话，AI 判断热度、该不该收号；左边是她的信号，右边是你该回的（含收号话术）。</Text>
      <TextInput style={styles.input} multiline placeholder={'粘贴对话：\n她：…\n我：…\n（也可截图）'} placeholderTextColor="#aaa" value={text} onChangeText={setText} />
      <View style={styles.bar}>
        <TouchableOpacity style={styles.btnGhost} onPress={pick}><Text style={styles.btnGhostText}>聊天截图</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btnPrimary} onPress={go} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>分析</Text>}
        </TouchableOpacity>
      </View>
      <View style={styles.subHeadRow}>
        <Icon name="template" size={18} color={C.green} strokeWidth={1.6} />
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
      {out ? (
        <View style={styles.outBox}>
          {body ? <Text style={styles.outText}>{body}</Text> : null}
          {groups.length ? <View style={styles.scriptDivider}><Text style={styles.scriptDividerText}>可复制话术（右绿=你发）</Text></View> : null}
          {groups.map((g, i) => <ScriptGroup key={i} group={g} index={i} />)}
          <View style={styles.bar}>
            <TouchableOpacity style={styles.copyAllBtn} onPress={() => Clipboard.setStringAsync(out).then(() => { recordCopy(out, 'Soul'); Alert.alert('已复制'); })}>
              <Text style={styles.copyAllText}>复制全部</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} disabled={!girl} onPress={() => { onSave(out); Alert.alert('已保存', '存入「' + girl.name + '」'); }}>
              <Text style={styles.saveBtnText}>保存到 {girl ? girl.name : '—'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
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
        <Icon name="review" size={18} color={C.green} strokeWidth={1.6} />
        <Text style={styles.cardTitle}>回顾 · 已复制的话</Text>
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

// ===== 聊天体检 =====
function ChatHealth({ girl, runLLM }) {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null);
  const run = async () => {
    if (!girl?.history?.length) { Alert.alert('暂无聊天', '先在输入框记几条对话，或导入历史聊天'); return; }
    setLoading(true);
    try { setRes(parseHealth(await runLLM({ scene: 'health', g: girl }))); }
    catch (e) { Alert.alert('体检失败', e.message); }
    finally { setLoading(false); }
  };
  const color = !res ? '#888' : res.health === '高' ? '#07C160' : res.health === '中' ? '#FF9F0A' : '#FA5151';
  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardHead} onPress={run} disabled={loading} activeOpacity={0.7}>
        <Icon name="tip" size={18} color={C.green} strokeWidth={1.6} />
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

// ===== 助手：内置情感/展示面顾问 =====
const ASSIST_GREET = [
  {
    role: 'ai',
    text:
      '我是你的情感 / 展示面顾问。\n' +
      '可以问我：展示面怎么搭、现在展示面有什么问题、什么时候该发展示面、该塑造什么形象。\n' +
      '也能发照片让我分析（涉及修图时，我会给你可直接粘到其他图像 AI 的「P图交接词」）。',
  },
];

function AssistantScreen({ settings, redDot, onOpenSettings }) {
  const [msgs, setMsgs] = useState(ASSIST_GREET);
  const [text, setText] = useState('');
  const [img, setImg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const scroll = useRef(null);

  useEffect(() => {
    (async () => {
      const saved = await loadAssistant();
      if (saved && saved.length) setMsgs(saved);
      setReady(true);
    })();
  }, []);
  useEffect(() => { if (ready) saveAssistant(msgs); }, [msgs, ready]);

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
        out = await generate(ASSISTANT_SYSTEM, q,
          { ...settings, useLocal: settings.useLocal && isLocalReady() }, { maxTokens: 1200 });
      }
      setMsgs((m) => [...m, { role: 'ai', text: out }]);
    } catch (e) { Alert.alert('出错', e.message); }
    finally { setLoading(false); }
  };

  return (
    <View style={styles.pageWrap}>
      <PageHeader title="助手" right={<GearButton onPress={onOpenSettings} redDot={redDot} />} />
      <ScrollView style={styles.content} ref={scroll} keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current && scroll.current.scrollToEnd({ animated: true })}>
        {msgs.map((m, i) => {
          if (m.role === 'user') {
            return (
              <View key={i} style={styles.assRowUser}>
                {m.image ? <Image source={{ uri: m.image }} style={styles.assUserImg} /> : null}
                <View style={[styles.bubble, styles.bubbleMe]}>
                  <Text style={[styles.bubbleText, styles.bubbleTextMe]}>{m.text}</Text>
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
                    <Text style={styles.handoffTitle}>P图交接词（粘到其他图像 AI）</Text>
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
            <View style={[styles.bubble, styles.bubbleHer]}><ActivityIndicator color="#999" /></View>
          </View>
        ) : null}
        <View style={{ height: 10 }} />
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
            <Icon name="camera" size={20} color="#555" strokeWidth={1.6} />
          </TouchableOpacity>
          {/* iOS 多行输入框塌陷修复：显式 minHeight + 顶对齐 + 17px 黑字 */}
          <TextInput
            style={styles.assistText}
            value={text}
            placeholder="问点什么，或附一张照片…"
            placeholderTextColor="#bbb"
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

const C = {
  cardBg: '#fff', green: '#07C160', gray: '#999', line: '#F0F0F0', bg: '#EDEDED',
};
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingTop: TOP },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  page: { flex: 1 },
  pageOn: { display: 'flex' },
  pageOff: { display: 'none' },
  pageWrap: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1 },
  hint: { color: '#888', fontSize: 15, padding: 12 },

  // 微信式抬头
  hdr: { height: 44, backgroundColor: C.bg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#DCDCDC' },
  hdrSide: { width: 60, flexDirection: 'row', alignItems: 'center' },
  hdrTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#191919' },
  gearBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  gearDot: { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FA5151' },

  card: { backgroundColor: C.cardBg, borderRadius: 12, margin: 10, padding: 12 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#191919', flexShrink: 1 },
  refresh: { fontSize: 13, color: '#576B95' },
  aiTag: { borderWidth: 1, borderColor: C.green, borderRadius: 9, paddingVertical: 2, paddingHorizontal: 6 },
  aiTagText: { fontSize: 11, color: C.green },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  rowLbl: { fontSize: 14, color: '#999', width: 54 },
  rowVal: { fontSize: 14, color: '#191919', marginLeft: 8 },
  dots: { flexDirection: 'row' },
  dotC: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5E5E5', marginRight: 6 },
  dotCOn: { backgroundColor: C.green },
  barBg: { width: 100, height: 8, borderRadius: 4, backgroundColor: '#EFEFEF', marginLeft: 8 },
  barFg: { height: 8, borderRadius: 4, backgroundColor: C.green },
  foldRow: { marginTop: 10, paddingVertical: 4 },
  foldLbl: { fontSize: 15, color: '#191919' },
  foldBody: { fontSize: 15, color: '#444', lineHeight: 23, marginTop: 4 },
  pfRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  pfLbl: { fontSize: 13, color: '#999', width: 70 },
  pfInput: { flex: 1, borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 8, fontSize: 15, color: '#222', backgroundColor: '#fafafa' },
  extractBtn: { backgroundColor: '#E8F8EE', borderRadius: 8, padding: 10, marginTop: 8, alignItems: 'center' },
  extractBtnText: { color: C.green, fontSize: 14, fontWeight: '600' },

  // 状态摘要条
  statusBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#E8E8E8' },
  statusText: { flex: 1, fontSize: 13, color: '#555', marginLeft: 10 },
  detailLink: { fontSize: 13, color: '#576B95' },

  // 对话流
  chatScroll: { flex: 1, paddingHorizontal: 10, paddingTop: 8 },
  bubble: { maxWidth: '80%', borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12, marginVertical: 4 },
  bubbleHer: { backgroundColor: '#fff', alignSelf: 'flex-start', borderTopLeftRadius: 4 },
  bubbleMe: { backgroundColor: C.green, alignSelf: 'flex-end', borderTopRightRadius: 4 },
  bubbleNote: { backgroundColor: '#FCE9C8', alignSelf: 'center', maxWidth: '92%' },
  bubbleText: { fontSize: 17, color: '#222', lineHeight: 24 },
  bubbleTextMe: { color: '#fff' },
  bubbleCopy: { marginTop: 5, alignSelf: 'flex-end' },
  bubbleCopyText: { fontSize: 12, color: '#07C160' },
  bubbleCopyTextOn: { color: '#EAF9F0' },
  scriptDivider: { marginTop: 10, marginBottom: 2, paddingVertical: 4 },
  scriptDividerText: { fontSize: 12, color: '#999', textAlign: 'center' },
  scriptGroup: { backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 12, padding: 8, marginVertical: 4, alignSelf: 'stretch' },
  scriptTag: { fontSize: 12, color: '#888', marginBottom: 2, marginLeft: 2 },
  scriptIdea: { fontSize: 13, color: '#576B95', marginTop: 4, marginLeft: 2 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginVertical: 8 },
  loadingText: { fontSize: 13, color: '#999', marginLeft: 6 },

  // 底部输入条
  inputBar: { backgroundColor: '#F7F7F7', borderTopWidth: 1, borderTopColor: '#E0E0E0', paddingHorizontal: 10, paddingTop: 6, paddingBottom: 10 },
  inputBarTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  noReplyChip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#EDEDED', marginRight: 8 },
  noReplyText: { fontSize: 12, color: '#888' },
  noReplyTextOn: { color: C.green, fontWeight: '700' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end' },
  iconBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  chatInput: {
    flex: 1, minHeight: 44, maxHeight: 110, fontSize: 17, color: '#000',
    backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10,
    textAlignVertical: 'top',
  },
  smallBtn: { marginLeft: 8, backgroundColor: '#EDEDED', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 12 },
  smallBtnText: { fontSize: 14, color: '#555' },
  sendBtn: { marginLeft: 8, backgroundColor: C.green, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, minWidth: 68, alignItems: 'center' },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  input: { borderWidth: 1, borderColor: '#e2e2ef', borderRadius: 10, minHeight: 70, padding: 10, fontSize: 16, color: '#222', backgroundColor: '#fafafa', textAlignVertical: 'top' },
  bar: { flexDirection: 'row', marginTop: 8, alignItems: 'center', flexWrap: 'wrap' },
  btnGhost: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F0F0F0', marginRight: 8 },
  btnGhostText: { fontSize: 14, color: '#555' },
  btnPrimary: { marginLeft: 'auto', backgroundColor: C.green, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 18 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  copyBtn: { marginTop: 6, backgroundColor: C.green, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  copyText: { color: '#fff', fontSize: 13 },
  adviceLine: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F6F6F6', borderRadius: 8, padding: 8, marginTop: 6 },
  adviceText: { flex: 1, fontSize: 15, color: '#222', lineHeight: 22 },
  importBtn: { margin: 10, marginTop: 4, backgroundColor: '#E8F8EE', borderRadius: 10, padding: 12, alignItems: 'center' },
  importBtnText: { color: C.green, fontSize: 14, fontWeight: '600' },
  tip: { fontSize: 14, color: '#888', lineHeight: 21, marginBottom: 8 },
  outBox: { marginTop: 10, backgroundColor: '#F6F6F6', borderRadius: 10, padding: 10 },
  outText: { fontSize: 16, color: '#222', lineHeight: 24 },
  copyAllBtn: { marginTop: 8, backgroundColor: C.green, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  copyAllText: { color: '#fff', fontSize: 14 },
  saveBtn: { marginTop: 8, marginLeft: 8, backgroundColor: '#576B95', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  saveBtnText: { color: '#fff', fontSize: 14 },
  healthVal: { fontSize: 16, fontWeight: '700', color: '#191919', marginBottom: 4 },
  healthLine: { fontSize: 14, color: '#444', lineHeight: 22, marginTop: 2 },

  chips: { maxHeight: 50, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: C.bg },
  chip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 16, backgroundColor: '#fff', marginRight: 8, borderWidth: 1, borderColor: '#E0E0E0' },
  chipOn: { backgroundColor: C.green, borderColor: C.green },
  chipText: { color: '#444', fontSize: 15 },
  chipTextOn: { color: '#fff', fontWeight: '700' },
  chipAdd: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: C.green },
  chipAddText: { color: C.green, fontSize: 14 },

  tabbar: { flexDirection: 'row', backgroundColor: '#FBFAFA', borderTopWidth: 1, borderTopColor: '#DCDCDC', paddingBottom: 18, paddingTop: 6 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 10, color: '#999', marginTop: 2, lineHeight: 13 },
  tabLabelOn: { color: C.green, fontWeight: '700' },

  modal: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#EDEDED', padding: 14, zIndex: 20, paddingTop: 40 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#191919' },
  modalClose: { fontSize: 20, color: '#888' },

  // 助手页
  assRowUser: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-start', paddingHorizontal: 10, marginVertical: 6 },
  assRowAi: { flexDirection: 'row', justifyContent: 'flex-start', paddingHorizontal: 10, marginVertical: 6 },
  assUserImg: { width: 70, height: 70, borderRadius: 8, marginRight: 8 },
  assistInput: { backgroundColor: '#F7F7F7', borderTopWidth: 1, borderTopColor: '#E0E0E0', paddingHorizontal: 10, paddingVertical: 8 },
  imgPrev: { position: 'relative', alignSelf: 'flex-end', marginBottom: 6 },
  imgPrevImg: { width: 80, height: 80, borderRadius: 8 },
  imgPrevX: { position: 'absolute', top: -6, right: -6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  imgPrevXText: { color: '#fff', fontSize: 12 },
  assistRow: { flexDirection: 'row', alignItems: 'flex-end' },
  assistCam: { width: 42, height: 44, borderRadius: 10, backgroundColor: '#EDEDED', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  assistText: {
    flex: 1, minHeight: 44, maxHeight: 110, fontSize: 17, color: '#000',
    backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10,
    textAlignVertical: 'top',
  },
  assistSend: { marginLeft: 8, backgroundColor: C.green, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18 },
  handoffBox: { marginTop: 8, backgroundColor: '#FFF8E6', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#F3E2B0' },
  handoffTitle: { fontSize: 13, fontWeight: '700', color: '#B8860B', marginBottom: 4 },
  handoffCn: { fontSize: 14, color: '#5A4B00', lineHeight: 21 },
  handoffEn: { fontSize: 13, color: '#8A7A2E', marginTop: 4, lineHeight: 19 },
  copyAllInline: { marginTop: 6, alignSelf: 'flex-end' },
  copyAllInlineText: { fontSize: 12, color: '#576B95' },

  // 锁定页
  lockRoot: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F2F2F2', zIndex: 30 },
  crashCard: { position: 'absolute', top: '38%', left: 30, right: 30, backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
  crashTitle: { fontSize: 18, fontWeight: '700', color: '#191919', marginBottom: 10 },
  crashText: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 23 },
  crashBtn: { marginTop: 18, backgroundColor: '#07C160', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 30 },
  crashBtnText: { color: '#fff', fontSize: 15 },
  gestureLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  zoneHint: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  zoneHintText: { fontSize: 13, color: '#bbb', fontWeight: '700' },
  hintSmall: { position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', fontSize: 13, color: '#999' },

  subHead: { fontSize: 15, fontWeight: '700', color: '#191919', marginTop: 14, marginBottom: 8 },
  subHeadRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 8, gap: 6 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  topicChip: { backgroundColor: '#F2F2F2', borderRadius: 16, paddingVertical: 9, paddingHorizontal: 14, marginRight: 8, marginBottom: 8 },
  topicChipText: { fontSize: 15, color: '#444' },
  tipCard: { backgroundColor: '#FFF8E6', borderRadius: 10, padding: 12, marginTop: 6, borderWidth: 1, borderColor: '#F3E2B0' },
  tipCardText: { fontSize: 14, color: '#8A6D00', lineHeight: 21 },
  reviewItem: { backgroundColor: '#F6F6F6', borderRadius: 8, padding: 10, marginTop: 8 },
  reviewText: { fontSize: 15, color: '#222', lineHeight: 22 },
  reviewTime: { fontSize: 12, color: '#999', marginTop: 4 },
});
