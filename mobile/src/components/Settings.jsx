// Settings.jsx —— 设置：API Key / 云端模型 / 本地模型 / 暗门伪装 / 7天重签
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';

const CLOUD_MODELS = [
  { id: 'glm-4-flash', name: 'glm-4-flash', note: '免费 · 速度快 · 效果一般' },
  { id: 'glm-4-air', name: 'glm-4-air', note: '约0.5元/百万字 · 效果明显更好（推荐）' },
  { id: 'glm-4-plus', name: 'glm-4-plus', note: '较贵 · 效果最好' },
];

function fmtDate(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function Settings({ settings, onSave, onClose }) {
  const [s, setS] = useState(settings);
  const set = (k, v) => setS({ ...s, [k]: v });

  const nextResign = s.resignDate + 7 * 24 * 3600 * 1000;

  return (
    <View style={styles.mask}>
      <View style={styles.panel}>
        <Text style={styles.title}>设置</Text>
        <ScrollView>
          <Text style={styles.label}>智谱 API Key（免费，open.bigmodel.cn 申请）</Text>
          <TextInput style={styles.input} value={s.apiKey} secureTextEntry
            placeholder="粘贴 Key" placeholderTextColor="#aaa" onChangeText={(t) => set('apiKey', t)} />

          <Text style={styles.label}>云端模型（点一下切换，越贵越聪明）</Text>
          {CLOUD_MODELS.map((m) => (
            <TouchableOpacity key={m.id} style={[styles.modelRow, s.cloudModel === m.id && styles.modelRowOn]}
              onPress={() => set('cloudModel', m.id)}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modelName, s.cloudModel === m.id && styles.modelNameOn]}>{m.name}</Text>
                <Text style={styles.modelNote}>{m.note}</Text>
              </View>
              {s.cloudModel === m.id && <Text style={styles.check}>✓</Text>}
            </TouchableOpacity>
          ))}

          <Text style={styles.label}>视觉模型（截图识别用）</Text>
          <TextInput style={styles.input} value={s.visionModel}
            placeholder="glm-4v-flash" onChangeText={(t) => set('visionModel', t)} />

          <Text style={styles.label}>本地模型（微调后开启，纯离线）</Text>
          <TouchableOpacity style={styles.switchRow} onPress={() => set('useLocal', !s.useLocal)}>
            <Text style={styles.label}>使用本地微调模型</Text>
            <Text style={[styles.switch, s.useLocal && styles.switchOn]}>{s.useLocal ? '开' : '关'}</Text>
          </TouchableOpacity>
          <TextInput style={styles.input} value={s.modelUrl}
            placeholder="https://.../coach-qwen3b-q8_0.gguf（可留空）" onChangeText={(t) => set('modelUrl', t)} />
          <Text style={styles.note}>把 coach-qwen3b-q8_0.gguf 用电脑 Finder（或 iTunes）拖进 App 的“文件共享”后，开启上方开关即可纯本地离线使用；不想拷文件也可填下载地址。</Text>

          <Text style={styles.label}>暗门 / 伪装（关闭方式）</Text>
          <TouchableOpacity style={styles.switchRow} onPress={() => set('disguiseOn', !s.disguiseOn)}>
            <Text style={styles.label}>开启伪装锁（桌面显示 SnapBridge 报错页）</Text>
            <Text style={[styles.switch, s.disguiseOn && styles.switchOn]}>{s.disguiseOn ? '开' : '关'}</Text>
          </TouchableOpacity>
          <Text style={styles.note}>关闭后：点图标直接进 App，不再有报错伪装页。开启后：桌面图标名=SnapBridge，点开先显示崩溃报错页，需按下方方式解锁。</Text>

          <Text style={styles.label}>解锁方式（更改方式）</Text>
          <View style={styles.stepperRow}>
            <Text style={styles.label}>左上区域点击次数</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => { const tl = s.unlock?.tl ?? 2, br = s.unlock?.br ?? 3, n = Math.max(0, tl - 1); if (n + br === 0) return; set('unlock', { tl: n, br }); }}>
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepVal}>{s.unlock?.tl ?? 2}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => { const tl = s.unlock?.tl ?? 2, br = s.unlock?.br ?? 3; set('unlock', { tl: Math.min(9, tl + 1), br }); }}>
                <Text style={styles.stepBtnText}>＋</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.stepperRow}>
            <Text style={styles.label}>右下区域点击次数</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => { const tl = s.unlock?.tl ?? 2, br = s.unlock?.br ?? 3, n = Math.max(0, br - 1); if (tl + n === 0) return; set('unlock', { tl, br: n }); }}>
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepVal}>{s.unlock?.br ?? 3}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => { const tl = s.unlock?.tl ?? 2, br = s.unlock?.br ?? 3; set('unlock', { tl, br: Math.min(9, br + 1) }); }}>
                <Text style={styles.stepBtnText}>＋</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.note}>解锁规则：先点左上区域 {s.unlock?.tl ?? 2} 次，再点右下区域 {s.unlock?.br ?? 3} 次，顺序错或点其它任何地方都会清零重来，绝不会误开。</Text>

          <Text style={styles.label}>7 天重签</Text>
          <View style={styles.switchRow}>
            <Text style={styles.label}>下次重签：{fmtDate(nextResign)}</Text>
            <TouchableOpacity style={styles.miniBtn} onPress={() => { set('resignDate', Date.now()); Alert.alert('已记录', '重签日期已更新为今天'); }}>
              <Text style={styles.miniBtnText}>我已重签</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.note}>
            觉得回复不够聪明就切 glm-4-air（智谱充值几块钱能用很久）。本地模型就绪后在上面开关启用。
          </Text>

          <View style={styles.bar}>
            <TouchableOpacity style={styles.btnGhost} onPress={onClose}>
              <Text style={styles.btnGhostText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => onSave(s)}>
              <Text style={styles.btnText}>保存</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mask: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 16, zIndex: 10 },
  panel: { backgroundColor: '#fff', borderRadius: 16, padding: 16, maxHeight: '88%' },
  title: { fontSize: 18, fontWeight: '800', color: '#191919', marginBottom: 12 },
  label: { fontSize: 13, color: '#555', marginTop: 10, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#e2e2ef', borderRadius: 10, padding: 10, fontSize: 15, color: '#222', backgroundColor: '#fafaff' },
  modelRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e2ef', borderRadius: 10, padding: 12, marginTop: 6, backgroundColor: '#fafaff' },
  modelRowOn: { borderColor: '#07C160', backgroundColor: '#E8F8EE' },
  modelName: { fontSize: 15, fontWeight: '700', color: '#222' },
  modelNameOn: { color: '#07C160' },
  modelNote: { fontSize: 12, color: '#888', marginTop: 2 },
  check: { color: '#07C160', fontSize: 18, fontWeight: '800', marginLeft: 8 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F2F2F2', borderRadius: 10, padding: 12, marginTop: 10 },
  switch: { fontSize: 15, color: '#999', fontWeight: '700' },
  switchOn: { color: '#07C160' },
  stepperRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F2F2F2', borderRadius: 10, padding: 12, marginTop: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E8F8EE', alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { color: '#07C160', fontSize: 20, fontWeight: '700', lineHeight: 24 },
  stepVal: { fontSize: 16, fontWeight: '700', color: '#222', marginHorizontal: 14, minWidth: 18, textAlign: 'center' },
  miniBtn: { backgroundColor: '#E8F8EE', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  miniBtnText: { color: '#07C160', fontSize: 13, fontWeight: '600' },
  note: { fontSize: 12, color: '#888', marginTop: 8, lineHeight: 18 },
  bar: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  btnGhost: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#eee', marginRight: 10 },
  btnGhostText: { color: '#333' },
  btnPrimary: { backgroundColor: '#07C160', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  btnText: { color: '#fff', fontWeight: '700' },
});
