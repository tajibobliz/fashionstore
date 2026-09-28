import { Text, View } from "react-native";

export function SectionTitle({ title }: { title: string }) {
  return (
    <View className="mb-3 px-6">
      <Text className="text-lg font-semibold text-gray-900">{title}</Text>
    </View>
  );
}
