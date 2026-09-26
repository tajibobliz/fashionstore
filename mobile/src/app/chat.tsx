import { useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { aiService } from "@/services/ai.service";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  typing?: boolean;
}

let messageCounter = 0;
const nextId = () => `msg-${Date.now()}-${messageCounter++}`;

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "¡Hola! Soy el asistente de FashionStore. Puedo recomendarte productos y responder tus dudas. ¿En qué te ayudo?",
};

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const listRef = useRef<FlatList<Message>>(null);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    const typingId = nextId();
    setMessages((current) => [
      ...current,
      { id: nextId(), role: "user", content: text },
      { id: typingId, role: "assistant", content: "Escribiendo...", typing: true },
    ]);
    setInput("");
    setSending(true);

    try {
      const result = await aiService.chat(text);
      setMessages((current) =>
        current.map((m) => (m.id === typingId ? { ...m, content: result.respuesta, typing: false } : m)),
      );
    } catch {
      setMessages((current) =>
        current.map((m) =>
          m.id === typingId ? { ...m, content: "No pude responder. Intenta de nuevo.", typing: false } : m,
        ),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      style={{ paddingTop: insets.top }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : undefined}
    >
      <View className="flex-row items-center justify-between border-b border-gray-100 px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12} aria-label="Volver al catálogo">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </Pressable>
        <Text className="text-lg font-semibold text-gray-900">Asistente FashionStore</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatBubble role={item.role} content={item.content} typing={item.typing} />}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      <View
        className="flex-row items-center gap-2 border-t border-gray-100 px-3 py-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <TextInput
          className="flex-1 rounded-full border border-gray-200 px-4 py-3 text-base"
          placeholder="Pregúntame algo sobre la tienda..."
          value={input}
          onChangeText={setInput}
          editable={!sending}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <Pressable
          onPress={handleSend}
          disabled={sending || !input.trim()}
          className={`h-11 w-11 items-center justify-center rounded-full ${
            sending || !input.trim() ? "bg-gray-300" : "bg-[#e11d48]"
          }`}
        >
          <Ionicons name="send" size={18} color="white" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
