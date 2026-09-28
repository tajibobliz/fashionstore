import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  garmentImage: string;
  onBackToPhoto: () => void;
};

const LazyVisionHatCamera = lazy(async () => {
  const module = await import('./VisionHatCamera');
  return { default: module.VisionHatCamera };
});

class NativeCameraBoundary extends Component<Props & { children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // The installed runtime does not contain the native camera modules.
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <View style={styles.messageBox}>
      <Text style={styles.message}>Este APK no incluye la cámara nativa del vestidor.</Text>
      <Pressable style={styles.button} onPress={this.props.onBackToPhoto}>
        <Text style={styles.buttonText}>Volver a Foto</Text>
      </Pressable>
    </View>;
  }
}

export function VisionHatCameraLoader(props: Props) {
  return <NativeCameraBoundary {...props}>
    <Suspense fallback={<View style={styles.messageBox}><ActivityIndicator color="#be3f70" /></View>}>
      <LazyVisionHatCamera {...props} />
    </Suspense>
  </NativeCameraBoundary>;
}

const styles = StyleSheet.create({
  messageBox: { marginTop: 12, minHeight: 480, alignItems: 'center', justifyContent: 'center', gap: 16, borderRadius: 16, backgroundColor: '#fff1f2', padding: 24 },
  message: { textAlign: 'center', color: '#9f1239', fontWeight: '600' },
  button: { borderRadius: 10, backgroundColor: '#be3f70', paddingHorizontal: 18, paddingVertical: 12 },
  buttonText: { color: 'white', fontWeight: '700' },
});
