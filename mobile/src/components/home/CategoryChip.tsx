import { Pressable, Text } from "react-native";
import { Categoria } from "@/types/catalog.types";

// Sin ícono dedicado por categoría en el proyecto: se mapea por nombre a un emoji, con un genérico
// de respaldo para categorías nuevas que no estén en la lista (no debe romperse con datos reales).
const EMOJI_POR_CATEGORIA: Record<string, string> = {
  accesorios: "👜",
  blusas: "👚",
  faldas: "🧵",
  pantalones: "👖",
  "poleras y polerones": "👕",
  vestidos: "👗",
  zapatos: "👟",
};
const EMOJI_DEFECTO = "🛍️";

function emojiPara(nombre: string) {
  return EMOJI_POR_CATEGORIA[nombre.trim().toLowerCase()] ?? EMOJI_DEFECTO;
}

export function CategoryChip({ categoria, onPress }: { categoria: Categoria; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="mr-3 items-center justify-center rounded-2xl bg-gray-50 px-5 py-4"
      style={{ minWidth: 88 }}
    >
      <Text className="text-2xl">{emojiPara(categoria.nombre)}</Text>
      <Text className="mt-1 text-xs font-medium text-gray-700" numberOfLines={1}>
        {categoria.nombre}
      </Text>
    </Pressable>
  );
}
