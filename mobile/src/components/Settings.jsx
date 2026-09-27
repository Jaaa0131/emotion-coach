// Settings.jsx —— 设置：API Key / 本地模型开关 / 模型下载地址
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export default function Settings({ settings, onSave, onClose }) {
  const [s, setS] = useState(settings);

  const set = (k, v) => setS({ ...s, [k]: v });

  return (
    <View style={styles.mask}>
      <View style={styles.panel}>
        <Text style={styles.title}>设置</Text>
        <ScrollView>
          <Text style={styles.label}>智谱 API Key（免费，open.bigmodel.cn 申请）</Text>
          <TextInput style={styles.input} value={s.apiKey} secureTextEntry
            placeholder="粘贴 Key" placeholderTextColor="#aaa" onChangeText={(t) => set('apiKey', t)} />

          <Text style={styles.label}>云端模型（回复用）</Text>
          <TextInput style={styles.input} value={s.cloudModel}
            placeholder="glm-4-flash" onChangeText={(t) => set('cloudModel', t)} />

          <Text style={styles.label}>视觉模型（截图识别用）</Text>
          <TextInput style={styles.input} value={s.visionModel}
            placeholder="glm-4v-flash" onChangeText={(t) => set('visionModel', t)} />

          <Text style={styles.label}>本地模型（微调后开启，纯离线）</Text>
          <TouchableOpacity style={styles.switchRow} onPress={() => set('useLocal', !s.useLocal)}>
            <Text style={styles.label}>使用本地微调模型</Text>
            <Text style={[styles.switch, s.useLocal && styles.switchOn]}>{s.useLocal ? '开' : '关'}</Text>
          </TouchableOpacity>

          <Text style={styles.label}>本地 GGUF 下载地址（可公网访问的 URL）</Text>
          <TextInput style={styles.input} value={s.modelUrl}
            placeholder="https://.../coach-qwen3b-q4_k_m.gguf" onChangeText={(t) => set('modelUrl', t)} />

          <Text style={styles.note}>
            提示：填好 Key 即可用云端免费模型（需联网）。本地模型需先把微调好的 GGUF 传到可公网访问的地方，
            填上面地址并在「快速回复」首次运行时下载（约1.5~2GB，请用 WiFi）。
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
  panel: { backgroundColor: '#fff', borderRadius: 16, padding: 16, maxHeight: '85%' },
  title: { fontSize: 18, fontWeight: '800', color: '#1b1b2f', marginBottom: 12 },
  label: { fontSize: 13, color: '#555', marginTop: 10, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#e2e2ef', borderRadius: 10, padding: 10, fontSize: 15, color: '#222', backgroundColor: '#fafaff' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0effa', borderRadius: 10, padding: 12, marginTop: 10 },
  switch: { fontSize: 15, color: '#999', fontWeight: '700' },
  switchOn: { color: '#7c5cff' },
  note: { fontSize: 12, color: '#888', marginTop: 10, lineHeight: 18 },
  bar: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  btnGhost: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#eee', marginRight: 10 },
  btnGhostText: { color: '#333' },
  btnPrimary: { backgroundColor: '#7c5cff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  btnText: { color: '#fff', fontWeight: '700' },
});
