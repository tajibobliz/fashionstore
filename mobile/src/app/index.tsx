import { View, Text } from "react-native";

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-4xl font-bold text-primary-500">
        FashionStore
      </Text>
      <Text className="mt-3 text-base text-gray-500">
        Tu tienda de moda favorita
      </Text>
    </View>
  );
}