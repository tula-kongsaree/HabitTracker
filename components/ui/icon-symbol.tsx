// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<string, ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING: IconMapping = {
  // Navigation
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  // App-specific
  'checkmark.circle.fill': 'check-circle',
  'trophy.fill': 'emoji-events',
  'chart.bar.fill': 'bar-chart',
  'flame.fill': 'local-fire-department',
  'gear': 'settings',
  'bell.fill': 'notifications',
  'plus.circle.fill': 'add-circle',
  'wrench.fill': 'build',
};

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: string;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const mapped = MAPPING[name] ?? 'help-outline';
  return <MaterialIcons color={color} size={size} name={mapped} style={style} />;
}
