package com.margelo.nitro.camera.poselandmarker

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfoProvider

class VisionCameraPoseLandmarkerPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? = null
  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider { hashMapOf() }

  companion object {
    init { VisionCameraPoseLandmarkerOnLoad.initializeNative() }
  }
}
