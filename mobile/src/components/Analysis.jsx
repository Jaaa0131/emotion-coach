// Analysis.jsx —— 深度分析区：上传整段对话(文本/截图) -> 阶段/心理/行动/技巧
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { recognizeImage } from '../lib/ocr';

export default function Analysis({ girl, settings, generateReply }) {
  const [text, setText] = useState('');
  const [noReply, setNoReply] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (res.canceled) return;
    setLoading(true);
    try {
      setText(await recognizeImage(res.assets[0].uri, settings));
    } catch (e) {
      alert('截图识别失败，可手动输入：' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const go = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      setResult(await generateReply({ conversation: text, noReply, girl, mode: 'analysis' }));
    } catch (e) {
      alert('分析失败：' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>深度分析（整段对话）</Text>
      <TextInput
        style={styles.input}
        multiline
        placeholder="粘贴整段对话，或截图；分析当前阶段/心理/该做什么"
        placeholderTextColor="#aaa"
        value={text}
        onChangeText={setText}
      />
      <View style={styles.bar}>
        <TouchableOpacity style={styles.btnGhost} onPress={pickImage}>
          <Text style={styles.btnGhostText}>📷 截图识别</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnGhost} onPress={() => setNoReply(!noReply)}>
          <Text style={[styles.btnGhostText, noReply && styles.on]}>末尾未回 {noReply ? '✓' : ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnPrimary} onPress={go} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>分析</Text>}
        </TouchableOpacity>
      </View>

      {result ? (
        <View style={styles.result}>
          <Text style={styles.resultText}>{result}</Text>
          <TouchableOpacity style={styles.copyBtn} onPress={() => Clipboard.setStringAsync(result).then(() => alert('已复制'))}>
            <Text style={styles.copyText}>复制分析</Text>
          </TouchableOpacity>
        </View>
      ) : null}
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
  btnPrimary: { marginLeft: 'auto', backgroundColor: '#1b1b2f', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 },
  btnText: { color: '#fff', fontWeight: '700' },
  result: { marginTop: 10, backgroundColor: '#f6f5ff', borderRadius: 10, padding: 12 },
  resultText: { fontSize: 15, color: '#222', lineHeight: 22 },
  copyBtn: { marginTop: 8, alignSelf: 'flex-end', backgroundColor: '#1b1b2f', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  copyText: { color: '#fff', fontSize: 13 },
});
