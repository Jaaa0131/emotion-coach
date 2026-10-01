// Icon.jsx —— 线性 SVG 图标（替换 emoji，统一风格）
// 使用 react-native-svg；viewBox 24x24。支持 filled（实心填充，用于 Tab 选中态）
import React from 'react';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

// Tab 四个主图标：支持 filled（选中时整体填充绿色）
const ICONS = {
  // 消息：微信式圆气泡（左下小尾巴）
  message: ({ filled, color }) => (
    <>
      <Path d="M5 4.5h14A2.5 2.5 0 0 1 21.5 7v7.5A2.5 2.5 0 0 1 19 17H5A2.5 2.5 0 0 1 2.5 14.5V7A2.5 2.5 0 0 1 5 4.5z"
        fill={filled ? color : 'none'} />
      <Path d="M9.6 16.4 L5.2 20.7 L4.8 16.4 Z" fill={filled ? color : 'none'} />
    </>
  ),
  // 破冰：指南针
  ice: ({ filled, color }) => (
    <>
      <Circle cx="12" cy="12" r="8.6" fill={filled ? color : 'none'} />
      <Path d="M12 5.6 L14.3 12 L12 18.4 L9.7 12 Z"
        fill={filled ? '#fff' : 'none'} stroke={filled ? '#fff' : undefined} />
    </>
  ),
  // Soul：心形
  soul: ({ filled, color }) => (
    <Path d="M12 20.4s-7.6-4.9-7.6-10.2C4.4 7.5 6.4 5.8 8.9 5.8c1.5 0 2.6.9 3.1 2 .5-1.1 1.6-2 3.1-2 2.5 0 4.5 1.7 4.5 4.4 0 5.3-7.6 10.2-7.6 10.2z"
      fill={filled ? color : 'none'} />
  ),
  // 助手：星芒
  assistant: ({ filled, color }) => (
    <Path d="M12 2.6 L14.2 9.8 L21.4 12 L14.2 14.2 L12 21.4 L9.8 14.2 L2.6 12 L9.8 9.8 Z"
      fill={filled ? color : 'none'} />
  ),

  // ===== 通用线性图标 =====
  gear: () => (
    <>
      <Circle cx="12" cy="12" r="7.8" />
      <Circle cx="12" cy="12" r="3.2" />
      <Path d="M19.8 12H21.8M2.2 12H4.2M12 2.2V4.2M12 19.8V21.8M17.5 6.5L18.9 5.1M5.1 18.9L6.5 17.5M17.5 17.5L18.9 18.9M5.1 5.1L6.5 6.5" />
    </>
  ),
  key: () => (
    <>
      <Circle cx="8" cy="12" r="3.6" />
      <Path d="M11.6 12H20.5M17 12v2.6M19.6 12v2" />
    </>
  ),
  cloud: () => (
    <Path d="M17.6 18.2H7.2a4.2 4.2 0 0 1-.5-8.37A5.7 5.7 0 0 1 17.4 9.3a4.5 4.5 0 0 1 .2 8.9z" />
  ),
  eye: () => (
    <>
      <Path d="M2.6 12S6.2 5.8 12 5.8 21.4 12 21.4 12 17.8 18.2 12 18.2 2.6 12 2.6 12z" />
      <Circle cx="12" cy="12" r="3.1" />
    </>
  ),
  eyeoff: () => (
    <>
      <Path d="M2.6 12S6.2 5.8 12 5.8c1.3 0 2.5.3 3.6.8" />
      <Path d="M21.4 12s-3.6 6.2-9.4 6.2c-1.3 0-2.5-.3-3.6-.8" />
      <Path d="M4 20L20 4" />
    </>
  ),
  phone: () => (
    <>
      <Rect x="7" y="2.6" width="10" height="18.8" rx="2.6" />
      <Path d="M10.6 18.4h2.8" />
    </>
  ),
  shield: () => (
    <Path d="M12 3.2l7 2.9v5.4c0 4.4-2.9 7.7-7 9.3-4.1-1.6-7-4.9-7-9.3V6.1z" />
  ),
  clock: () => (
    <>
      <Circle cx="12" cy="12" r="8.6" />
      <Path d="M12 7.4V12l3.2 2.1" />
    </>
  ),
  help: () => (
    <>
      <Circle cx="12" cy="12" r="8.6" />
      <Path d="M9.7 9.6a2.4 2.4 0 1 1 3.3 2.2c-.7.3-1 .9-1 1.6v.3" />
      <Path d="M12 17.1v.1" />
    </>
  ),
  chevron: () => <Path d="M9.2 4.8 L16 12 L9.2 19.2" />,
  back: () => <Path d="M14.8 4.8 L8 12 L14.8 19.2" />,
  check: () => <Path d="M5 12.6 L9.4 17 L19 7" />,
  close: () => <Path d="M6 6 L18 18M18 6L6 18" />,
  plus: () => (
    <>
      <Line x1="12" y1="5" x2="12" y2="19" />
      <Line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  camera: () => (
    <>
      <Path d="M4 8.6h3l1.6-2.2h6.8L17 8.6h3a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.6a1 1 0 0 1 1-1z" />
      <Circle cx="12" cy="13.6" r="3.3" />
    </>
  ),
  copy: () => (
    <>
      <Rect x="8.6" y="8.6" width="11.4" height="11.4" rx="2.2" />
      <Path d="M15.4 5.4H6a2 2 0 0 0-2 2v9" />
    </>
  ),
  review: () => (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Line x1="12" y1="7" x2="12" y2="12" />
      <Line x1="12" y1="12" x2="15" y2="14" />
    </>
  ),
  topic: () => (
    <>
      <Path d="M9 18h6" />
      <Path d="M10 21h4" />
      <Path d="M12 3a6 6 0 0 0-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 0 0-4-10z" />
    </>
  ),
  template: () => (
    <>
      <Line x1="9" y1="7" x2="20" y2="7" />
      <Line x1="9" y1="12" x2="20" y2="12" />
      <Line x1="9" y1="17" x2="20" y2="17" />
      <Circle cx="5" cy="7" r="1.3" />
      <Circle cx="5" cy="12" r="1.3" />
      <Circle cx="5" cy="17" r="1.3" />
    </>
  ),
  tip: () => (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Line x1="12" y1="11" x2="12" y2="16" />
      <Line x1="12" y1="8" x2="12" y2="8.5" />
    </>
  ),
};

export default function Icon({ name, size = 24, color = '#999', filled = false, strokeWidth = 1.8 }) {
  const Node = ICONS[name] || ICONS.help;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Node filled={filled} color={color} />
    </Svg>
  );
}
