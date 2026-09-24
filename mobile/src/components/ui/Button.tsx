import { Pressable, Text, ActivityIndicator, View } from "react-native";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline";
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  compact = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const variantStyles = {
    primary: isDisabled
      ? "bg-primary-300"
      : "bg-primary-500 active:bg-primary-600",
    secondary: isDisabled
      ? "bg-gray-200"
      : "bg-gray-900 active:bg-gray-800",
    outline: isDisabled
      ? "border-2 border-gray-300"
      : "border-2 border-primary-500",
  };

  const textStyles = {
    primary: "text-white",
    secondary: "text-white",
    outline: "text-primary-500",
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`${compact ? "h-12" : "h-14"} items-center justify-center rounded-xl ${variantStyles[variant]}`}
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text className={`text-base font-semibold ${textStyles[variant]}`}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
