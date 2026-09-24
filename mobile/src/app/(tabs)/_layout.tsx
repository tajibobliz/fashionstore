import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCartStore } from "@/stores/cartStore";
import { useAuthStore } from "@/stores/authStore";
import { useEffect } from "react";
import { cartService } from "@/services/cart.service";
import { useShopStore } from "@/stores/shopStore";
export default function TabsLayout() {
  // insets = espacios que ocupan barras del sistema (arriba/abajo)
  const insets = useSafeAreaInsets();
  const totalItems = useCartStore((state) => state.cart?.detalles.reduce((sum, item) => sum + item.cantidad, 0) ?? 0);
  const cartBadge = totalItems > 0 ? totalItems : undefined;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const branchId = useShopStore((state) => state.selectedBranchId);
  const setCart = useCartStore((state) => state.setCart);

  useEffect(() => {
    if (!isAuthenticated || !branchId) {
      setCart(null);
      return;
    }
    void cartService.getMyCart(branchId).then(setCart).catch(() => setCart(null));
  }, [branchId, isAuthenticated, setCart]);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#e11d48",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: {
          display: isAuthenticated ? "flex" : "none",
          // Altura base + espacio de la barra del sistema
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: "#f3f4f6",
          backgroundColor: "#ffffff",
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: "Catálogo",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
       name="cart"
       options={{
       title: "Carrito",
       tabBarIcon: ({ color, size }) => (
      <Ionicons name="cart-outline" size={size} color={color} />
      ),
       tabBarBadge: cartBadge,
       tabBarBadgeStyle: {
       backgroundColor: "#e11d48",
       color: "#ffffff",
       fontSize: 11,
       minWidth: 18,
       height: 18,
         },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
