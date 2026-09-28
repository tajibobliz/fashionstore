import { useEffect, useState } from "react";
import { View, Text, ScrollView, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui/Button";
import { HomeBanner } from "@/components/home/HomeBanner";
import { SectionTitle } from "@/components/home/SectionTitle";
import { CategoryChip } from "@/components/home/CategoryChip";
import { ProductCardMini } from "@/components/home/ProductCardMini";
import { PromotionCard } from "@/components/home/PromotionCard";
import { Skeleton } from "@/components/home/Skeleton";
import { useAuthStore } from "@/stores/authStore";
import { homeService } from "@/services/home.service";
import { Categoria, Producto } from "@/types/catalog.types";
import { Promocion } from "@/types/promotion.types";

// Props de rendimiento comunes a las listas horizontales de este home (evitan renderizar/mantener
// montadas más celdas de las necesarias mientras el usuario desliza).
const LIST_PERF_PROPS = { initialNumToRender: 4, removeClippedSubviews: true } as const;

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const router = useRouter();

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriasLoading, setCategoriasLoading] = useState(true);
  const [categoriasError, setCategoriasError] = useState(false);

  const [novedades, setNovedades] = useState<Producto[]>([]);
  const [novedadesLoading, setNovedadesLoading] = useState(true);
  const [novedadesError, setNovedadesError] = useState(false);

  // /promotions/activas y /ai/recomendaciones exigen JWT (cualquier rol); sin sesión ni se piden.
  // El estado inicial de "loading" ya arranca en `isAuthenticated` (en vez de setearlo a true dentro
  // del effect) para no llamar a setState de forma sincrónica ahí, que el React Compiler prohíbe.
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  const [promocionesLoading, setPromocionesLoading] = useState(isAuthenticated);
  const [promocionesError, setPromocionesError] = useState(false);

  const [recomendaciones, setRecomendaciones] = useState<Producto[]>([]);
  const [recomendacionesLoading, setRecomendacionesLoading] = useState(isAuthenticated);
  const [recomendacionesError, setRecomendacionesError] = useState(false);

  useEffect(() => {
    homeService
      .getCategorias()
      .then(setCategorias)
      .catch(() => setCategoriasError(true))
      .finally(() => setCategoriasLoading(false));

    homeService
      .getNovedades()
      .then(setNovedades)
      .catch(() => setNovedadesError(true))
      .finally(() => setNovedadesLoading(false));

    // No hace falta limpiar `promociones`/`recomendaciones` acá: el JSX ya exige `isAuthenticated &&`
    // para mostrarlas, así que datos viejos de una sesión anterior nunca se llegan a renderizar.
    if (!isAuthenticated) return;

    homeService
      .getPromocionesActivas()
      .then(setPromociones)
      .catch(() => setPromocionesError(true))
      .finally(() => setPromocionesLoading(false));

    homeService
      .getRecomendaciones()
      .then(setRecomendaciones)
      .catch(() => setRecomendacionesError(true))
      .finally(() => setRecomendacionesLoading(false));
  }, [isAuthenticated]);

  const irACategoria = (idCategoria: number) => {
    // TODO: (tabs)/catalog.tsx todavía no lee ningún parámetro de filtro por categoría.
    // Cuando lo soporte, leer aquí `categoria` con useLocalSearchParams() en esa pantalla.
    router.push({ pathname: "/catalog", params: { categoria: String(idCategoria) } } as any);
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-6 pt-16 pb-6">
        <Text className="text-4xl font-bold text-primary-500">FashionStore</Text>

        {isAuthenticated ? (
          <Text className="mt-2 text-base text-gray-500">Hola, {user?.nombre} 👋</Text>
        ) : (
          <Text className="mt-2 text-base text-gray-500">Hola 👋</Text>
        )}
        <Text className="mt-1 text-sm text-gray-400">Descubre las últimas tendencias</Text>
      </View>

      <HomeBanner />

      <SectionTitle title="Categorías" />
      {categoriasError ? (
        <Text className="mb-8 px-6 text-sm text-gray-400">
          No se pudieron cargar las categorías.
        </Text>
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-8"
          contentContainerStyle={{ paddingHorizontal: 24 }}
          {...LIST_PERF_PROPS}
          data={categoriasLoading ? Array.from({ length: 4 }) : categorias}
          keyExtractor={(item, index) => (categoriasLoading ? `skeleton-${index}` : String((item as Categoria).idCategoria))}
          renderItem={({ item }) =>
            categoriasLoading ? (
              <Skeleton className="mr-3 rounded-2xl" style={{ width: 88, height: 76 }} />
            ) : (
              <CategoryChip categoria={item as Categoria} onPress={() => irACategoria((item as Categoria).idCategoria)} />
            )
          }
        />
      )}

      <SectionTitle title="Novedades" />
      {novedadesError ? (
        <Text className="mb-8 px-6 text-sm text-gray-400">
          No se pudieron cargar las novedades.
        </Text>
      ) : novedadesLoading ? (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-8"
          contentContainerStyle={{ paddingHorizontal: 24 }}
          {...LIST_PERF_PROPS}
          data={Array.from({ length: 3 })}
          keyExtractor={(_, index) => `skeleton-${index}`}
          renderItem={() => <Skeleton className="mr-4 rounded-2xl" style={{ width: 160, height: 224 }} />}
        />
      ) : novedades.length === 0 ? (
        <Text className="mb-8 px-6 text-sm text-gray-400">Todavía no hay novedades.</Text>
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-8"
          contentContainerStyle={{ paddingHorizontal: 24 }}
          {...LIST_PERF_PROPS}
          data={novedades}
          keyExtractor={(item) => String(item.idProducto)}
          renderItem={({ item }) => <ProductCardMini producto={item} />}
        />
      )}

      {/* Promociones: si no hay sesión, o cargó y no hay ninguna activa, no se renderiza nada (ni el título). */}
      {isAuthenticated && (promocionesLoading || (!promocionesError && promociones.length > 0)) && (
        <>
          <SectionTitle title="Promociones" />
          {promocionesLoading ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-8"
              contentContainerStyle={{ paddingHorizontal: 24 }}
              {...LIST_PERF_PROPS}
              data={Array.from({ length: 2 })}
              keyExtractor={(_, index) => `skeleton-${index}`}
              renderItem={() => <Skeleton className="mr-4 rounded-2xl" style={{ width: 220, height: 150 }} />}
            />
          ) : (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-8"
              contentContainerStyle={{ paddingHorizontal: 24 }}
              {...LIST_PERF_PROPS}
              data={promociones}
              keyExtractor={(item) => String(item.idPromocion)}
              renderItem={({ item }) => <PromotionCard promocion={item} />}
            />
          )}
        </>
      )}

      {/* Recomendado para ti: oculto sin sesión, mientras carga sin datos previos, en error, o si vino vacío. */}
      {isAuthenticated && (recomendacionesLoading || (!recomendacionesError && recomendaciones.length > 0)) && (
        <>
          <View className="mb-3 px-6">
            <Text className="text-lg font-semibold text-gray-900">Recomendado para ti</Text>
            <Text className="text-xs text-gray-400">Selecciones con IA</Text>
          </View>
          {recomendacionesLoading ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-8"
              contentContainerStyle={{ paddingHorizontal: 24 }}
              {...LIST_PERF_PROPS}
              data={Array.from({ length: 3 })}
              keyExtractor={(_, index) => `skeleton-${index}`}
              renderItem={() => <Skeleton className="mr-4 rounded-2xl" style={{ width: 160, height: 224 }} />}
            />
          ) : (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-8"
              contentContainerStyle={{ paddingHorizontal: 24 }}
              {...LIST_PERF_PROPS}
              data={recomendaciones}
              keyExtractor={(item) => String(item.idProducto)}
              renderItem={({ item }) => <ProductCardMini producto={item} />}
            />
          )}
        </>
      )}

      <View className="px-6 pb-10">
        {!isAuthenticated && (
          <View>
            <Text className="mb-4 text-lg font-semibold text-gray-900">¿Ya tienes cuenta?</Text>
            <Button title="Iniciar sesión" onPress={() => router.push("/login" as any)} variant="outline" />
          </View>
        )}
      </View>
    </ScrollView>
  );
}
