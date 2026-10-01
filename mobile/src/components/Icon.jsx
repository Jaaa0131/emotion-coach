// Icon.jsx —— 线性 SVG 图标（替换 emoji，统一风格）
// 使用 react-native-svg；所有图标描边风格，viewBox 24x24
import React from 'react';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

const ICONS = {
  message: () => (
    <Path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 0 1 12 3a8.38 8.38 0 0 1 9 8.5z" />
  ),
  ice: () => (
    <Path d="M12 2 21 7v10l-9 5-9-5V7z" />
  ),
  soul: () => (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Circle cx="12" cy="12" r="5" />
      <Circle cx="12" cy="12" r="1.6" />
    </>
  ),
  assistant: () => (
    <>
      <Rect x="5" y="8" width="14" height="11" rx="2.5" />
      <Circle cx="9" cy="13" r="1.1" />
      <Circle cx="15" cy="13" r="1.1" />
      <Line x1="12" y1="3.5" x2="12" y2="6" />
      <Circle cx="12" cy="3" r="1" />
    </>
  ),
  plus: () => (
    <>
      <Line x1="12" y1="5" x2="12" y2="19" />
      <Line x1="5" y1="12" x2="19" y2="12" />
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

export default function Icon({ name, size = 26, color = '#999' }) {
  const Node = ICONS[name] || ICONS.tip;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Node />
    </Svg>
  );
}
