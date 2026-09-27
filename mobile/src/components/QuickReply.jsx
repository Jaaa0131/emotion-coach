// QuickReply.jsx —— 快速回复区：文本/截图输入 -> 3 条可复制回复
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { recognizeImage } from '../lib/ocr';

function splitReplies(text) {
  // 尝试按 ①/②/③ 或 1)/2)/3) 或 "1." 拆分；拆不出就整段作为一条
  const re = /(①|②|③|\(?[123]\)|\b[123]\.\s)/;
  const parts = text.split(re).filter((s) => s && s.trim());
  // split 会把分隔符也留下，重新拼回
  const items = [];
  for (let i = 0; i < parts.length; i++) {
    if (re.test(parts[i])) {
      items.push((parts[i] + (parts[i + 1] || '')).trim());
      i++;
    } else if (i === 0) {
      items.push(parts[i].trim());
    }
  }
  return items.length ? items : [text.trim()];
}

export default function QuickReply({ girl, settings, generateReply, onLogHer }) {
  const [text, setText] = useState('');
  const [noReply, setNoReply] = useState(false);
  const [loading, setLoading] = useState(false);
  const [replies, setReplies] = useState([]);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (res.canceled) return;
    setLoading(true);
    try {
      const txt = await recognizeImage(res.assets[0].uri, settings);
      setText(txt);
    } catch (e) {
      alert('截图识别失败，可手动输入对话：' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const go = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const out = await generateReply({ conversation: text, noReply, girl, mode: 'reply' });
      setReplies(splitReplies(out));
      onLogHer && onLogHer(text);
    } catch (e) {
      alert('生成失败：' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const copy = async (s) => {
    await Clipboard.setStringAsync(s);
    alert('已复制');
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>快速回复</Text>
      <TextInput
        style={styles.input}
        multiline
        placeholder="粘贴她的话，或 女生：… 我：… 格式；也可截图"
        placeholderTextColor="#aaa"
        value={text}
        onChangeText={setText}
      />
      <View style={styles.bar}>
        <TouchableOpacity style={styles.btnGhost} onPress={pickImage}>
          <Text style={styles.btnGhostText}>📷 截图识别</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnGhost} onPress={() => setNoReply(!noReply)}>
          <Text style={[styles.btnGhostText, noReply && styles.on]}>她未回 {noReply ? '✓' : ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnPrimary} onPress={go} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>出回复</Text>}
        </TouchableOpacity>
      </View>

      {replies.map((r, i) => (
        <View key={i} style={styles.reply}>
          <Text style={styles.replyText}>{r}</Text>
          <TouchableOpacity style={styles.copyBtn} onPress={() => copy(r)}>
            <Text style={styles.copyText}>复制</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, margin: 10, padding: 12, elevation: 2 },
  title: { fontSize: 16, fontWeight: '700', color: '#1b1b2f', marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: '#e2e2ef', borderRadius: 10, minHeight: 70,
    padding: 10, fontSize: 15, color: '#222', backgroundColor: '#fafaff', textAlignVertical: 'top',
  },
  bar: { flexDirection: 'row', marginTop: 8, alignItems: 'center' },
  btnGhost: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#f0effa', marginRight: 8 },
  btnGhostText: { fontSize: 13, color: '#555' },
  on: { color: '#7c5cff', fontWeight: '700' },
  btnPrimary: { marginLeft: 'auto', backgroundColor: '#7c5cff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 },
  btnText: { color: '#fff', fontWeight: '700' },
  reply: {
    marginTop: 10, backgroundColor: '#f6f5ff', borderRadius: 10, padding: 10,
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  replyText: { flex: 1, fontSize: 15, color: '#222', lineHeight: 22 },
  copyBtn: { marginLeft: 10, backgroundColor: '#7c5cff', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  copyText: { color: '#fff', fontSize: 13 },
});
