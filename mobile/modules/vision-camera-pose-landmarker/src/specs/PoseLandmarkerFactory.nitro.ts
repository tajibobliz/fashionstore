import type { HybridObject } from 'react-native-nitro-modules';
import type { CameraOutput, CameraPosition } from 'react-native-vision-camera';

export interface PosePoint {
  index: number;
  x: number;
  y: number;
  z: number;
  visibility: number;
  presence: number;
}

export interface PoseResult {
  landmarks: PosePoint[];
  frameWidth: number;
  frameHeight: number;
  inferenceTimeMs: number;
  timestampMs: number;
}

export interface PoseLandmarkerOptions {
  cameraFacing?: CameraPosition;
  minPoseDetectionConfidence?: number;
  minPosePresenceConfidence?: number;
  minTrackingConfidence?: number;
  onResults: (result: PoseResult) => void;
  onError: (error: Error) => void;
}

export interface PoseLandmarkerFactory extends HybridObject<{ android: 'kotlin' }> {
  createPoseLandmarkerOutput(options: PoseLandmarkerOptions): CameraOutput;
}
