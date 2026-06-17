import { useEffect } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

function FireParticle({ x, delay, screenHeight }: { x: number; delay: number; screenHeight: number }) {
  const ty = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    ty.value = withDelay(delay, withTiming(-screenHeight * 0.7, { duration: 2000 }));
    opacity.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 150 }),
      withDelay(1300, withTiming(0, { duration: 500 }))
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: `${x}%` as any,
    bottom: 80,
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  return <Animated.Text style={[style, { fontSize: 52 }]}>🔥</Animated.Text>;
}

export function FireCelebration({ visible, title, subtitle }: {
  visible: boolean;
  title?: string;
  subtitle?: string;
}) {
  const { height } = useWindowDimensions();
  const textOpacity = useSharedValue(0);
  const textScale = useSharedValue(0.5);

  useEffect(() => {
    if (visible) {
      textOpacity.value = withSequence(
        withSpring(1, { damping: 10, stiffness: 200 }),
        withDelay(2000, withTiming(0, { duration: 600 }))
      );
      textScale.value = withSequence(
        withSpring(1, { damping: 8, stiffness: 200 }),
        withDelay(2000, withTiming(0.8, { duration: 600 }))
      );
    }
  }, [visible]);

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ scale: textScale.value }],
  }));

  const particles = [5, 12, 22, 32, 42, 50, 58, 68, 78, 88, 95].map((x, i) => ({ x, delay: i * 100 }));

  if (!visible) return null;
  return (
    <View style={[StyleSheet.absoluteFillObject, fireStyles.container]} pointerEvents="none">
      {particles.map((p, i) => (
        <FireParticle key={i} x={p.x} delay={p.delay} screenHeight={height} />
      ))}
      <Animated.View style={[fireStyles.banner, textStyle]}>
        <Text style={fireStyles.bannerTitle}>{title ?? '🔥 Challenge Complete! 🔥'}</Text>
        <Text style={fireStyles.bannerSub}>{subtitle ?? 'You did it — amazing discipline!'}</Text>
      </Animated.View>
    </View>
  );
}

const fireStyles = StyleSheet.create({
  container: { zIndex: 100 },
  banner: {
    position: 'absolute',
    top: '35%',
    left: 30,
    right: 30,
    backgroundColor: '#FF6B00',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
  },
  bannerTitle: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  bannerSub: { color: '#FFE0B2', fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
