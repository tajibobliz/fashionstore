package com.margelo.nitro.camera.poselandmarker

import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.SystemClock
import android.util.Size as AndroidSize
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import com.margelo.nitro.NitroModules
import com.margelo.nitro.camera.CameraOrientation
import com.margelo.nitro.camera.HybridCameraOutputSpec
import com.margelo.nitro.camera.MediaType
import com.margelo.nitro.camera.MirrorMode
import com.margelo.nitro.camera.Size
import com.margelo.nitro.camera.extensions.surfaceRotation
import com.margelo.nitro.camera.extensions.toSize
import com.margelo.nitro.camera.public.NativeCameraOutput
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

class HybridPoseLandmarkerOutput(
  private val options: PoseLandmarkerOptions,
) : HybridCameraOutputSpec(), ImageAnalysis.Analyzer, NativeCameraOutput {
  override val mediaType = MediaType.VIDEO
  override var mirrorMode = MirrorMode.AUTO
  override var outputOrientation = CameraOrientation.UP
    set(value) {
      field = value
      imageAnalysis?.targetRotation = value.surfaceRotation
    }
  override val currentResolution: Size?
    get() = imageAnalysis?.resolutionInfo?.resolution?.toSize()

  private val executor = Executors.newSingleThreadExecutor()
  private val disposed = AtomicBoolean(false)
  private var imageAnalysis: ImageAnalysis? = null
  private val poseLandmarker: PoseLandmarker

  init {
    val context = NitroModules.applicationContext ?: throw Error("React context unavailable")
    val baseOptions = BaseOptions.builder()
      .setModelAssetPath("pose_landmarker_lite.task")
      .build()
    val landmarkerOptions = PoseLandmarker.PoseLandmarkerOptions.builder()
      .setBaseOptions(baseOptions)
      .setRunningMode(RunningMode.LIVE_STREAM)
      .setNumPoses(1)
      .setMinPoseDetectionConfidence((options.minPoseDetectionConfidence ?: 0.5).toFloat())
      .setMinPosePresenceConfidence((options.minPosePresenceConfidence ?: 0.5).toFloat())
      .setMinTrackingConfidence((options.minTrackingConfidence ?: 0.5).toFloat())
      .setOutputSegmentationMasks(false)
      .setResultListener(::onResult)
      .setErrorListener { error -> if (!disposed.get()) options.onError(error) }
      .build()
    poseLandmarker = PoseLandmarker.createFromOptions(context, landmarkerOptions)
  }

  override fun createUseCase(
    mirrorMode: MirrorMode,
    config: NativeCameraOutput.Config,
  ): NativeCameraOutput.PreparedUseCase {
    val selector = ResolutionSelector.Builder()
      .setResolutionStrategy(
        ResolutionStrategy(
          AndroidSize(640, 480),
          ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER,
        ),
      )
      .build()
    val analysis = ImageAnalysis.Builder()
      .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
      .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
      .setTargetRotation(outputOrientation.surfaceRotation)
      .setResolutionSelector(selector)
      .build()
    return NativeCameraOutput.PreparedUseCase(analysis) {
      imageAnalysis = analysis
      this.mirrorMode = mirrorMode
      analysis.setAnalyzer(executor, this)
    }
  }

  override fun analyze(imageProxy: ImageProxy) {
    if (disposed.get()) {
      imageProxy.close()
      return
    }
    try {
      val source = Bitmap.createBitmap(imageProxy.width, imageProxy.height, Bitmap.Config.ARGB_8888)
      imageProxy.planes[0].buffer.rewind()
      source.copyPixelsFromBuffer(imageProxy.planes[0].buffer)
      val rotation = imageProxy.imageInfo.rotationDegrees
      val front = options.cameraFacing == CameraPosition.FRONT
      val matrix = Matrix().apply {
        postRotate(rotation.toFloat())
        if (front) postScale(-1f, 1f)
      }
      val oriented = Bitmap.createBitmap(source, 0, 0, source.width, source.height, matrix, true)
      if (oriented !== source) source.recycle()
      imageProxy.close()

      val timestamp = SystemClock.uptimeMillis()
      val mpImage = BitmapImageBuilder(oriented).build()
      poseLandmarker.detectAsync(mpImage, timestamp)
    } catch (error: Throwable) {
      imageProxy.close()
      if (!disposed.get()) options.onError(error)
    }
  }

  private fun onResult(result: PoseLandmarkerResult, input: MPImage) {
    if (disposed.get()) {
      input.close()
      return
    }
    val timestamp = result.timestampMs()
    val points = result.landmarks().firstOrNull()?.mapIndexed { index, landmark ->
      PosePoint(
        index = index.toDouble(),
        x = landmark.x().toDouble(),
        y = landmark.y().toDouble(),
        z = landmark.z().toDouble(),
        visibility = landmark.visibility().orElse(0f).toDouble(),
        presence = landmark.presence().orElse(0f).toDouble(),
      )
    }?.toTypedArray() ?: emptyArray()
    options.onResults(
      PoseResult(
        landmarks = points,
        frameWidth = input.width.toDouble(),
        frameHeight = input.height.toDouble(),
        inferenceTimeMs = (SystemClock.uptimeMillis() - timestamp).toDouble(),
        timestampMs = timestamp.toDouble(),
      ),
    )
    input.close()
  }

  override fun dispose() {
    if (!disposed.compareAndSet(false, true)) return
    imageAnalysis?.clearAnalyzer()
    imageAnalysis = null
    executor.execute { poseLandmarker.close() }
    executor.shutdown()
    executor.awaitTermination(2, TimeUnit.SECONDS)
    super.dispose()
  }
}
