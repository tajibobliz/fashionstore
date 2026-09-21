import { View, Text } from "react-native";

export default function CartScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-gray-900">Carrito</Text>
      <Text className="mt-2 text-gray-500">Próximamente</Text>
    </View>
  );
}