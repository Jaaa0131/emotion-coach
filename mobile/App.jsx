// App.jsx —— 情感教练主界面（A2：Expo + React Native 原生）
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import ProfileCard from './src/components/ProfileCard';
import QuickReply from './src/components/QuickReply';
import Analysis from './src/components/Analysis';
import Settings from './src/components/Settings';
import { loadSettings, saveSettings, loadGirls, saveGirls, newGirl } from './src/lib/storage';
import { buildSystem, buildUser } from './src/lib/prompt';
import { generate, ensureLocal, isLocalReady } from './src/lib/llm';

export default function App() {
  const [settings, setSettings] = useState(null);
  const [girls, setGirls] = useState([]);
  const [selId, setSelId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [localStatus, setLocalStatus] = useState('');

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

  const addGirl = () => {
    const g = newGirl();
    persist([...girls, g]);
    setSelId(g.id);
  };
  const renameGirl = (g) => {
    if (typeof Alert.prompt !== 'function') return;
    Alert.prompt('改名', '输入新的名称', (name) => {
      if (name && name.trim()) updateGirl(g.id, { name: name.trim() });
    });
  };
  const deleteGirl = (g) => {
    Alert.alert('删除', '确定删除「' + g.name + '」及她的所有记录？', [
      { text: '取消' }, { text: '删除', style: 'destructive', onPress: () => {
        const next = girls.filter((x) => x.id !== g.id);
        persist(next);
        setSelId(next[0]?.id || null);
      } },
    ]);
  };

  const generateReply = async ({ conversation, noReply, girl, mode }) => {
    const sys = buildSystem(girl, mode, noReply);
    const user = buildUser(mode, conversation);
    if (settings.useLocal) {
      const ok = await ensureLocal(settings);
      setLocalStatus(ok ? '本地模型运行中' : '本地加载失败，已用云端');
    }
    return await generate(sys, user, { ...settings, useLocal: settings.useLocal && isLocalReady() });
  };

  const logHer = (text) => {
    if (!girl) return;
    const history = [...(girl.history || []), { role: 'her', text, ts: Date.now() }];
    updateGirl(girl.id, { history });
  };

  const onSaveSettings = (s) => { setSettings(s); saveSettings(s); setShowSettings(false); };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.appName}>情感教练</Text>
        <TouchableOpacity onPress={() => setShowSettings(true)}>
          <Text style={styles.gear}>⚙</Text>
        </TouchableOpacity>
      </View>

      {localStatus ? <Text style={styles.localStat}>{localStatus}</Text> : null}

      <ScrollView horizontal style={styles.tabs} showsHorizontalScrollIndicator={false}>
        {girls.map((g) => (
          <TouchableOpacity
            key={g.id}
            style={[styles.tab, g.id === selId && styles.tabOn]}
            onPress={() => setSelId(g.id)}
            onLongPress={() => Alert.alert('操作', '对「' + g.name + '」', [
              { text: '改名', onPress: () => renameGirl(g) },
              { text: '删除', style: 'destructive', onPress: () => deleteGirl(g) },
              { text: '取消' },
            ])}
          >
            <Text style={[styles.tabText, g.id === selId && styles.tabTextOn]}>{g.name}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.tabAdd} onPress={addGirl}>
          <Text style={styles.tabAddText}>+ 添加</Text>
        </TouchableOpacity>
      </ScrollView>

      {girl ? (
        <ScrollView style={styles.content}>
          <ProfileCard girl={girl} onChange={(p) => updateGirl(girl.id, { profile: p })} />
          <QuickReply girl={girl} settings={settings} generateReply={generateReply} onLogHer={logHer} />
          <Analysis girl={girl} settings={settings} generateReply={generateReply} />
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>还没有女生，点上方「+ 添加」开始</Text>
        </View>
      )}

      {showSettings && (
        <Settings settings={settings} onSave={onSaveSettings} onClose={() => setShowSettings(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f2fb' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#1b1b2f' },
  appName: { color: '#fff', fontSize: 18, fontWeight: '800' },
  gear: { color: '#fff', fontSize: 22 },
  localStat: { textAlign: 'center', fontSize: 12, color: '#7c5cff', paddingVertical: 4 },
  tabs: { maxHeight: 54, paddingHorizontal: 8, backgroundColor: '#1b1b2f' },
  tab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#2c2c44', marginRight: 8 },
  tabOn: { backgroundColor: '#7c5cff' },
  tabText: { color: '#cfcfe6', fontSize: 15 },
  tabTextOn: { color: '#fff', fontWeight: '700' },
  tabAdd: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#7c5cff' },
  tabAddText: { color: '#7c5cff', fontSize: 15 },
  content: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#888', fontSize: 15 },
});
