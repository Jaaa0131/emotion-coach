# 情感教练 App（A2：免费自签原生 · 纯手机独立）

按你的需求做的原生 iOS App：女生分模块记忆、可折叠档案、快速回复（文本/格式/截图）、深度分析、本地推理（可离线）。

## 一、你要准备的东西（全免费，除可选 $99）
1. **Node.js 18+**：https://nodejs.org 装 LTS。
2. **Expo 账号（免费）**：https://expo.dev 注册。
3. **一个免费 Apple ID**（你手机现在登录的那个就行）。
4. **Windows 上装 SidelLoadly**（免费自签工具）：https://sideloadly.io
5. （可选，将来若嫌每周重签烦）Apple Developer $99/年 → 转 TestFlight。

## 二、第一步：先用「云端免费模型」测交互（当天就能在手机上用）
> 这样你不用等训练完就能看到界面对不对。

1. 在本机 `relationship-coach/mobile` 目录打开终端，安装依赖：
   ```
   npm install
   ```
2. 登录 Expo 并构建 iOS 开发包（**EAS 云端编译，不需要你本机有 Mac**）：
   ```
   npx eas login
   npx eas build --platform ios --profile development
   ```
   选 "Always" 让 EAS 帮你管理签名。构建完会给你一个 `.ipa` 下载链接。
3. 手机和电脑连同一 WiFi，电脑上用 **SidelLoadly** 打开那个 `.ipa`，填你的 Apple ID，开始签名安装。
   手机「设置→VPN与设备管理」里信任该 Apple ID 证书，App 即可打开。
4. 打开 App → 右上角 ⚙ → 填 **智谱 API Key**（open.bigmodel.cn 免费申请）→ 保存。
5. 点「+ 添加」建一个女生，填档案（可先收起），贴她的话点「出回复」试。

> 此阶段回复走云端（需联网），模型是通用大模型 + 内置方法论原则。专属微调模型就绪后可切本地离线。

## 三、第二步：炼你的专属模型（一次性，加新教材时重炼）
1. **补齐音视频教材**（如还没转完）：双击桌面「学习资料.bat」，把那 30G 转写进 `C:\网盘下载\课程资料-AI`。
2. **生成语料**（已帮你跑过一次，重跑即可扩充）：
   ```
   python train/prepare_corpus.py
   ```
3. **微调**（需显卡：你电脑有独显就本地，没有就用云 GPU 几~十几元，如 AutoDL）：
   ```
   pip install torch transformers peft bitsandbytes datasets accelerate sentencepiece
   python train/finetune.py --mode both --epochs 3
   ```
4. **转 GGUF + 量化**（在有 llama.cpp 的机器上）：
   ```
   python llama.cpp/convert_hf_to_gguf.py checkpoints/coach-qwen3b/sft --outfile coach-f16.gguf
   ./llama-quantize coach-f16.gguf coach-qwen3b-q4_k_m.gguf Q4_K_M
   ```
5. **托管 GGUF**：把 `coach-qwen3b-q4_k_m.gguf`（约1.5~2GB）传到任意可公网访问的地方
   （GitHub Release / Cloudflare R2 / 对象存储 等），拿到下载 URL。

## 四、第三步：切到本地离线模型（纯手机独立）
1. App ⚙ → 打开「使用本地微调模型」→ 填上面 GGUF 的 URL → 保存。
2. 首次在 **WiFi** 下点「出回复」，App 会下载模型到手机（约1.5~2GB，进度在日志里）。
3. 之后**完全离线、零外传、不开电脑**也能用。

## 五、关于「每周重签」
免费自签的 App **每 7 天会打不开**，需用 SidelLoadly + 电脑重新签一次（约 2 分钟）。
你说过这不介意。若哪天嫌烦，花 $99/年转 TestFlight 即可永久（模型/代码全复用）。

## 六、目录结构
```
mobile/                 Expo 原生 App 源码
  App.jsx               主界面（女生标签/记忆/生成）
  src/components/        ProfileCard / QuickReply / Analysis / Settings
  src/lib/              storage(本地存储) / prompt(提示词) / llm(本地+云端) / ocr(截图识别)
train/                  模型相关
  prepare_corpus.py     教材 -> 训练语料（已跑，产出 corpus/）
  finetune.py           LoRA 微调 Qwen2.5-3B
  corpus/               生成的语料（documents.jsonl / instructions.jsonl）
```

## 七、常见问题
- **构建报原生错？** llama.rn 需要 dev build（已用 `development` profile），不要用 Expo Go 直接跑。
- **截图识别要联网？** 是的，默认走智谱视觉模型；也可手动输入对话绕过。
- **本地模型太慢？** 换更小量化（Q3_K）或更小基座（Qwen2.5-1.5B）；性能够用就保持 Q4_K_M。
