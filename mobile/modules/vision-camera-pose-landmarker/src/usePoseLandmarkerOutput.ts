import { useMemo } from 'react';
import type { CameraOutput } from 'react-native-vision-camera';
import { createPoseLandmarkerOutput } from './factory';
import type { PoseLandmarkerOptions } from './specs/PoseLandmarkerFactory.nitro';

export function usePoseLandmarkerOutput(options: PoseLandmarkerOptions): CameraOutput {
  const cameraFacing = options.cameraFacing ?? 'front';
  const minPoseDetectionConfidence = options.minPoseDetectionConfidence ?? 0.5;
  const minPosePresenceConfidence = options.minPosePresenceConfidence ?? 0.5;
  const minTrackingConfidence = options.minTrackingConfidence ?? 0.5;

  return useMemo(() => createPoseLandmarkerOutput({
    cameraFacing,
    minPoseDetectionConfidence,
    minPosePresenceConfidence,
    minTrackingConfidence,
    onResults: options.onResults,
    onError: options.onError,
  }), [cameraFacing, minPoseDetectionConfidence, minPosePresenceConfidence, minTrackingConfidence, options.onError, options.onResults]);
}
