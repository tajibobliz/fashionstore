module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath: 'import com.margelo.nitro.camera.poselandmarker.VisionCameraPoseLandmarkerPackage;',
        packageInstance: 'new VisionCameraPoseLandmarkerPackage()',
      },
      ios: null,
    },
  },
};
