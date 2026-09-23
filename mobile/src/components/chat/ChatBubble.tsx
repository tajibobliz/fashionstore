import { View, Text } from "react-native";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  typing?: boolean;
}

export function ChatBubble({ role, content, typing = false }: ChatBubbleProps) {
  const isUser = role === "user";
  return (
    <View
      className={`my-1 max-w-[80%] rounded-2xl px-4 py-3 ${
        isUser ? "self-end bg-[#e11d48]" : "self-start bg-gray-100"
      }`}
    >
      <Text className={isUser ? "text-white" : typing ? "italic text-gray-400" : "text-gray-900"}>
        {content}
      </Text>
    </View>
  );
}
