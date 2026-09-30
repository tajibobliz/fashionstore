import { NitroModules } from 'react-native-nitro-modules';
import type { CameraOutput } from 'react-native-vision-camera';
import type { PoseLandmarkerFactory, PoseLandmarkerOptions } from './specs/PoseLandmarkerFactory.nitro';

const factory = NitroModules.createHybridObject<PoseLandmarkerFactory>('PoseLandmarkerFactory');

export function createPoseLandmarkerOutput(options: PoseLandmarkerOptions): CameraOutput {
  return factory.createPoseLandmarkerOutput(options);
}
