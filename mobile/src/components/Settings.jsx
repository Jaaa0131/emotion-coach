// Settings.jsx —— 半屏弹窗式设置（微信分组 cell 风 / 线条图标 / 点弹窗外即关 / 点选即自动保存）
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Dimensions } from 'react-native';
import Icon from './Icon';

const { height: SHEET_MAX } = Dimensions.get('window');

const CLOUD_MODELS = [
  { id: 'glm-4-flash', name: 'glm-4-flash', note: '免费 · 速度快 · 效果一般' },
  { id: 'glm-4-air', name: 'glm-4-air', note: '约0.5元/百万字 · 效果明显更好（推荐）' },
  { id: 'glm-4-plus', name: 'glm-4-plus', note: '较贵 · 效果最好' },
];

const C = { green: '#07C160', line: '#F0F0F0', gray: '#999' };

function fmtDate(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// 通用分组 cell：图标 + 名称 + 当前值 + 箭头
function Cell({ icon, label, value, onPress, last }) {
  return (
    <TouchableOpacity style={[styles.cell, last && styles.cellLast]} onPress={onPress} activeOpacity={0.6}>
      {icon ? <Icon name={icon} size={20} color="#333" strokeWidth={1.6} /> : null}
      <Text style={styles.cellLabel}>{label}</Text>
      {value ? <Text style={styles.cellValue} numberOfLines={1}>{value}</Text> : null}
      <Icon name="chevron" size={16} color="#C8C8C8" strokeWidth={1.6} />
    </TouchableOpacity>
  );
}

// 开关行
function SwitchCell({ icon, label, on, onToggle }) {
  return (
    <TouchableOpacity style={styles.cell} onPress={onToggle} activeOpacity={0.6}>
      {icon ? <Icon name={icon} size={20} color="#333" strokeWidth={1.6} /> : null}
      <Text style={styles.cellLabel}>{label}</Text>
      <View style={[styles.switchTrack, on && styles.switchTrackOn]}>
        <View style={[styles.switchKnob, on && styles.switchKnobOn]} />
      </View>
    </TouchableOpacity>
  );
}

function Group({ children, title }) {
  return (
    <View style={styles.group}>
      {title ? <Text style={styles.groupTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export default function Settings({ settings, onSave, onClose }) {
  const [s, setS] = useState(settings);
  const [page, setPage] = useState('main');

  // 任何改动立即写盘（不用再点保存）
  const set = (k, v) => { const n = { ...s, [k]: v }; setS(n); onSave(n); };

  const nextResign = s.resignDate + 7 * 24 * 3600 * 1000;
  const tl = s.unlock?.tl ?? 2;
  const br = s.unlock?.br ?? 3;

  const head = (title) => (
    <View style={styles.sheetHead}>
      <TouchableOpacity style={styles.backBtn} onPress={() => setPage('main')}>
        <Icon name="back" size={20} color="#333" strokeWidth={1.8} />
      </TouchableOpacity>
      <Text style={styles.sheetTitle}>{title}</Text>
      <TouchableOpacity onPress={onClose}><Text style={styles.done}>完成</Text></TouchableOpacity>
    </View>
  );

  const body = () => {
    if (page === 'key') {
      return (
        <>
          {head('API Key')}
          <ScrollView style={styles.sheetBody}>
            <Group title="智谱 API Key（免费，open.bigmodel.cn 申请）">
              <View style={styles.inputBox}>
                <TextInput style={styles.input} value={s.apiKey} secureTextEntry
                  placeholder="粘贴 Key" placeholderTextColor="#bbb" onChangeText={(t) => set('apiKey', t)} />
              </View>
            </Group>
            <Text style={styles.note}>填了才能用云端模型；本地模型开启后不需要 Key。</Text>
          </ScrollView>
        </>
      );
    }

    if (page === 'cloud') {
      return (
        <>
          {head('云端模型')}
          <ScrollView style={styles.sheetBody}>
            <Group title="点一下即切换并自动保存">
              {CLOUD_MODELS.map((m, i) => (
                <TouchableOpacity key={m.id} style={[styles.cell, i === CLOUD_MODELS.length - 1 && styles.cellLast]}
                  onPress={() => set('cloudModel', m.id)} activeOpacity={0.6}>
                  <Icon name="cloud" size={20} color={s.cloudModel === m.id ? C.green : '#333'} strokeWidth={1.6} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cellLabel, s.cloudModel === m.id && styles.cellLabelOn]}>{m.name}</Text>
                    <Text style={styles.cellSub}>{m.note}</Text>
                  </View>
                  {s.cloudModel === m.id ? <Icon name="check" size={18} color={C.green} strokeWidth={2} /> : null}
                </TouchableOpacity>
              ))}
            </Group>
          </ScrollView>
        </>
      );
    }

    if (page === 'vision') {
      return (
        <>
          {head('视觉模型')}
          <ScrollView style={styles.sheetBody}>
            <Group title="截图识别用的模型">
              <View style={styles.inputBox}>
                <TextInput style={styles.input} value={s.visionModel}
                  placeholder="glm-4v-flash" placeholderTextColor="#bbb" onChangeText={(t) => set('visionModel', t)} />
              </View>
            </Group>
            <Text style={styles.note}>一般保持默认即可。</Text>
          </ScrollView>
        </>
      );
    }

    if (page === 'local') {
      return (
        <>
          {head('本地模型')}
          <ScrollView style={styles.sheetBody}>
            <Group>
              <SwitchCell icon="phone" label="使用本地微调模型" on={!!s.useLocal} onToggle={() => set('useLocal', !s.useLocal)} />
              <Cell icon="copy" label="模型文件名" value={s.modelFile} onPress={() => {}} last />
            </Group>
            <Group title="或填写下载地址（可留空）">
              <View style={styles.inputBox}>
                <TextInput style={styles.input} value={s.modelUrl}
                  placeholder="https://.../coach-qwen3b-q8_0.gguf" placeholderTextColor="#bbb"
                  onChangeText={(t) => set('modelUrl', t)} autoCapitalize="none" />
              </View>
            </Group>
            <Group title="本地模型状态">
              <View style={styles.statusBox}>
                <Text style={styles.note}>
                  在电脑上用 Apple 设备 / Finder 的「文件共享」把 coach-qwen3b-q8_0.gguf（约 3.4GB）拖入本 App 后，开启上方开关即可完全离线使用。{'\n'}若开启后发消息闪退，多半是内存不足，可关掉开关改走云端。
                </Text>
              </View>
            </Group>
            <Text style={styles.note}>
              开启后完全离线、不花一分钱。首次发消息会加载模型，卡 10~60 秒属正常。
            </Text>
          </ScrollView>
        </>
      );
    }

    if (page === 'disguise') {
      return (
        <>
          {head('暗门 / 伪装')}
          <ScrollView style={styles.sheetBody}>
            <Group>
              <SwitchCell icon="shield" label="开启伪装锁" on={!!s.disguiseOn} onToggle={() => set('disguiseOn', !s.disguiseOn)} />
              <Cell icon="eyeoff" label="解锁方式" value={`左上${tl}次 → 右下${br}次`} onPress={() => setPage('unlock')} last />
            </Group>
            <Text style={styles.note}>
              开启后：桌面显示 SnapBridge 崩溃报错页，看不到任何内容，按设定手势才进真正的 App。{'\n'}
              关闭后：点图标直接进 App。
            </Text>
          </ScrollView>
        </>
      );
    }

    if (page === 'unlock') {
      return (
        <>
          {head('解锁方式')}
          <ScrollView style={styles.sheetBody}>
            <Group>
              <StepRow label="左上区域点击次数" value={tl}
                onMinus={() => { const n = Math.max(0, tl - 1); if (n + br === 0) return; set('unlock', { tl: n, br }); }}
                onPlus={() => set('unlock', { tl: Math.min(9, tl + 1), br })} />
              <StepRow label="右下区域点击次数" value={br} last
                onMinus={() => { const n = Math.max(0, br - 1); if (tl + n === 0) return; set('unlock', { tl, br: n }); }}
                onPlus={() => set('unlock', { tl, br: Math.min(9, br + 1) })} />
            </Group>
            <Text style={styles.note}>
              规则：先点左上 {tl} 次，再点右下 {br} 次。顺序错、点到其它任何地方都会清零重来，绝不会误开。
            </Text>
          </ScrollView>
        </>
      );
    }

    if (page === 'resign') {
      return (
        <>
          {head('7 天重签')}
          <ScrollView style={styles.sheetBody}>
            <Group>
              <Cell icon="clock" label="下次重签" value={fmtDate(nextResign)} onPress={() => {}} last />
            </Group>
            <Group>
              <TouchableOpacity style={styles.cellLast2} onPress={() => { set('resignDate', Date.now()); Alert.alert('已记录', '重签日期已更新为今天'); }}>
                <Text style={styles.actionText}>我已重签（记录为今天）</Text>
              </TouchableOpacity>
            </Group>
            <Text style={styles.note}>
              免费自签每 7 天失效，到期前 1 天「我」页齿轮上会显示红点。重签方法：连电脑用 Sideloadly 覆盖安装一次。
            </Text>
          </ScrollView>
        </>
      );
    }

    if (page === 'help') {
      return (
        <>
          {head('帮助')}
          <ScrollView style={styles.sheetBody}>
            <Text style={styles.note}>
              · 消息页：输入框写「她说了什么」→ 点【出回复】，左边白气泡是她的话、右边绿气泡是你该发的，点【复制】直接粘到微信。{'\n\n'}
              · 破冰页：传她朋友圈截图 → 出画像 + 可复制开场白。{'\n\n'}
              · Soul 页：贴对话 → 判断热度 + 收号时机 + 可复制话术。{'\n\n'}
              · 助手页：问展示面/形象问题，可发图。{'\n\n'}
              · 所有数据只存在你手机里，不上传任何服务器。
            </Text>
          </ScrollView>
        </>
      );
    }

    // ===== 主列表 =====
    return (
      <>
        <View style={styles.sheetHead}>
          <View style={{ width: 40 }} />
          <Text style={styles.sheetTitle}>设置</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.done}>完成</Text></TouchableOpacity>
        </View>
        <ScrollView style={styles.sheetBody}>
          <Group>
            <Cell icon="key" label="API Key" value={s.apiKey ? '已填写' : '未填写'} onPress={() => setPage('key')} />
            <Cell icon="cloud" label="云端模型" value={s.cloudModel} onPress={() => setPage('cloud')} />
            <Cell icon="eye" label="视觉模型" value={s.visionModel || '默认'} onPress={() => setPage('vision')} />
            <Cell icon="phone" label="本地模型" value={s.useLocal ? '已开启 · 离线' : '关（走云端）'} onPress={() => setPage('local')} last />
          </Group>
          <Group>
            <Cell icon="shield" label="暗门 / 伪装" value={s.disguiseOn ? '开' : '关'} onPress={() => setPage('disguise')} />
            <Cell icon="clock" label="7 天重签" value={fmtDate(nextResign)} onPress={() => setPage('resign')} last />
          </Group>
          <Group>
            <Cell icon="help" label="帮助" value="" onPress={() => setPage('help')} last />
          </Group>
          <Text style={styles.footNote}>情感教练 · 数据全部存本机</Text>
        </ScrollView>
      </>
    );
  };

  return (
    <View style={styles.wrap}>
      {/* 点弹窗外任意位置即关闭 */}
      <TouchableOpacity style={styles.mask} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>{body()}</View>
    </View>
  );
}

function StepRow({ label, value, onMinus, onPlus, last }) {
  return (
    <View style={[styles.cell, last && styles.cellLast]}>
      <Text style={styles.cellLabel}>{label}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity style={styles.stepBtn} onPress={onMinus}>
          <Text style={styles.stepBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepVal}>{value}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={onPlus}>
          <Text style={styles.stepBtnText}>＋</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', zIndex: 50 },
  mask: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#EDEDED', borderTopLeftRadius: 18, borderTopRightRadius:18, maxHeight: SHEET_MAX * 0.76, paddingBottom: 16 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#DCDCDC' },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#191919' },
  backBtn: { width: 40, height: 32, alignItems: 'flex-start', justifyContent: 'center' },
  done: { fontSize: 16, color: '#07C160', fontWeight: '600', minWidth: 40, textAlign: 'right' },
  sheetBody: { paddingHorizontal: 12, paddingTop: 12 },

  group: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, paddingHorizontal: 12, overflow: 'hidden' },
  groupTitle: { fontSize: 12, color: '#999', paddingTop: 12, paddingBottom: 6 },
  cell: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line, gap: 10 },
  cellLast: { borderBottomWidth: 0 },
  cellLabel: { flex: 1, fontSize: 16, color: '#191919' },
  cellLabelOn: { color: C.green, fontWeight: '700' },
  cellSub: { fontSize: 12, color: '#999', marginTop: 2 },
  cellValue: { fontSize: 13, color: '#999', maxWidth: 130 },
  cellLast2: { paddingVertical: 14, alignItems: 'center' },
  actionText: { fontSize: 16, color: '#07C160', fontWeight: '600' },

  switchTrack: { width: 46, height: 28, borderRadius: 14, backgroundColor: '#E0E0E0', justifyContent: 'center', paddingHorizontal: 2 },
  switchTrackOn: { backgroundColor: C.green },
  switchKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignSelf: 'flex-start' },
  switchKnobOn: { alignSelf: 'flex-end' },

  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E8F8EE', alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { color: C.green, fontSize: 20, fontWeight: '700', lineHeight: 24 },
  stepVal: { fontSize: 16, fontWeight: '700', color: '#222', marginHorizontal: 14, minWidth: 18, textAlign: 'center' },

  inputBox: { paddingVertical: 10 },
  input: { borderWidth: 1, borderColor: '#E2E2EF', borderRadius: 10, padding: 10, fontSize: 16, color: '#222', backgroundColor: '#FAFAFF' },
  statusBox: { paddingVertical: 10 },
  note: { fontSize: 13, color: '#888', lineHeight: 21, paddingHorizontal: 4 },
  noteOk: { color: C.green, fontWeight: '600' },
  footNote: { textAlign: 'center', fontSize: 12, color: '#AAA', paddingVertical: 8 },
});
