# VisionCamera Pose Landmarker (Android prototype)

Local, Android-only VisionCamera 5 `CameraOutput` used by `/pose-native-test`.

- CameraX delivers RGBA `ImageProxy` frames directly to Kotlin.
- MediaPipe Pose Landmarker Lite runs with `RunningMode.LIVE_STREAM` on CPU.
- Results contain all 33 normalized pose landmarks; the test screen renders only 11, 12, 23–28.
- `STRATEGY_KEEP_ONLY_LATEST` and MediaPipe live-stream frame dropping keep latency bounded.
- `dispose()` detaches the analyzer, closes MediaPipe and stops its executor.

After changing `src/specs/*.nitro.ts`, regenerate the checked-in Nitro bridge from this directory:

```sh
npm run specs
```

The `.task` model is the official MediaPipe Pose Landmarker Lite float16 asset.
