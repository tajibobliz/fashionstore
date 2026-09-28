import { SafeAreaView } from 'react-native-safe-area-context';
import { VisionHatCamera } from '@/features/tryon/VisionHatCamera';

export default function VisionHatTestScreen() {
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}><VisionHatCamera /></SafeAreaView>;
}
