import { useEffect, useState } from "react";
import { Animated } from "react-native";

/** Placeholder con pulso suave de opacidad, para loading de listas horizontales. */
export function Skeleton({ className, style }: { className?: string; style?: object }) {
  // useState (no useRef) para no leer `.current` durante el render: con el React Compiler activado
  // en este proyecto (app.json), ese acceso queda prohibido incluso para inicialización perezosa.
  const [opacity] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      className={`bg-gray-200 ${className ?? ""}`}
      style={[{ opacity }, style]}
    />
  );
}
