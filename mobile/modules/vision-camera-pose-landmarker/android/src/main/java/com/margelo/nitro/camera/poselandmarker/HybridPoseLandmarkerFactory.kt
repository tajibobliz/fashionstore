package com.margelo.nitro.camera.poselandmarker

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.camera.HybridCameraOutputSpec

@Keep
@DoNotStrip
class HybridPoseLandmarkerFactory : HybridPoseLandmarkerFactorySpec() {
  override fun createPoseLandmarkerOutput(options: PoseLandmarkerOptions): HybridCameraOutputSpec =
    HybridPoseLandmarkerOutput(options)
}
