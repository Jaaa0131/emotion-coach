// ProfileCard.jsx —— 可折叠的女生基础情况卡
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

const FIELDS = [
  { key: 'age', label: '年龄', ph: '如 24' },
  { key: 'zodiac', label: '星座', ph: '如 天蝎' },
  { key: 'personality', label: '性格', ph: '如 慢热、独立' },
  { key: 'channel', label: '认识渠道', ph: '如 朋友介绍/软件' },
  { key: 'meetTime', label: '认识时间', ph: '如 2026.9 认识1周' },
  { key: 'interests', label: '兴趣', ph: '如 猫、爬山' },
  { key: 'taboos', label: '雷点/禁忌', ph: '如 讨厌被逼问' },
  { key: 'stage', label: '当前阶段', ph: '如 破冰/暧昧' },
  { key: 'goal', label: '目标', ph: '如 发展成恋人' },
];

export default function ProfileCard({ girl, onChange }) {
  const [open, setOpen] = useState(false);
  const p = girl.profile || {};

  const set = (key, val) => {
    const next = { ...p, [key]: val };
    onChange(next);
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.head} onPress={() => setOpen(!open)}>
        <Text style={styles.headTitle}>基础情况 {open ? '▲' : '▼'}</Text>
        <Text style={styles.hint}>{open ? '收起' : '展开填写'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.body}>
          {FIELDS.map((f) => (
            <View key={f.key} style={styles.row}>
              <Text style={styles.label}>{f.label}</Text>
              <TextInput
                style={styles.input}
                value={p[f.key] || ''}
                placeholder={f.ph}
                placeholderTextColor="#aaa"
                onChangeText={(t) => set(f.key, t)}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, margin: 10, padding: 4, elevation: 2 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  headTitle: { fontSize: 16, fontWeight: '700', color: '#1b1b2f' },
  hint: { fontSize: 13, color: '#7c5cff' },
  body: { paddingHorizontal: 12, paddingBottom: 12 },
  row: { marginBottom: 8 },
  label: { fontSize: 13, color: '#555', marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#e2e2ef', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: '#222',
    backgroundColor: '#fafaff',
  },
});
