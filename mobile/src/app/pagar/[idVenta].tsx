import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Image, Alert, AppState } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import { AxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { salesService } from "@/services/sales.service";
import { paymentsService } from "@/services/payments.service";
import { generateUUID } from "@/lib/uuid";
import { useFormatMoney } from "@/lib/moneda";
import { MetodoPago, MetodosTienda, Payment, Sale } from "@/types/checkout.types";

/**
 * Pagar un pedido de la tienda online, igual que la web (frontend/src/features/payments/StorePayment.tsx):
 * - Tarjeta → abre la pasarela (Stripe o simulada) en el navegador; al volver se revisa el estado.
 * - QR / transferencia → registra el pago PENDIENTE y pide la foto del comprobante; la tienda lo verifica.
 * - Efectivo al retirar / contra entrega → registra el pago PENDIENTE; se cobra al entregar.
 * Solo se muestran los medios que la tienda activó en su panel. Cuando la tienda aprueba o rechaza
 * el pago, la clienta recibe una notificación push.
 */
const OPCIONES: { metodo: MetodoPago; nombre: string; detalle: string; icono: keyof typeof Ionicons.glyphMap; activo: (m: MetodosTienda) => boolean }[] = [
  { metodo: "TARJETA", nombre: "Tarjeta de débito o crédito", detalle: "Pago seguro en línea. Se confirma al instante.", icono: "card-outline", activo: (m) => m.tarjeta },
  { metodo: "QR", nombre: "QR", detalle: "Escanea el QR de la tienda con tu app del banco y sube el comprobante.", icono: "qr-code-outline", activo: (m) => m.qr },
  { metodo: "TRANSFERENCIA", nombre: "Transferencia bancaria", detalle: "Transfiere a la cuenta de la tienda y sube el comprobante.", icono: "swap-horizontal-outline", activo: (m) => m.transferencia },
  { metodo: "EFECTIVO", nombre: "Efectivo al retirar", detalle: "Pagas en la sucursal cuando recoges tu pedido.", icono: "cash-outline", activo: (m) => m.efectivoRetiro },
  { metodo: "CONTRAPAGO", nombre: "Contra entrega", detalle: "Pagas cuando recibes tu pedido.", icono: "home-outline", activo: (m) => m.contraentrega },
];
const nombre = (m: MetodoPago) => OPCIONES.find((o) => o.metodo === m)?.nombre ?? m;

const mensajeError = (e: unknown, porDefecto: string) => {
  const err = e as AxiosError<{ message?: string | string[] }>;
  if (!err.response) return "Sin conexión con el servidor.";
  const m = err.response.data?.message;
  return Array.isArray(m) ? m.join("\n") : m || porDefecto;
};

export default function PagarPedidoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const fmt = useFormatMoney();
  const { idVenta } = useLocalSearchParams<{ idVenta: string }>();

  const [venta, setVenta] = useState<Sale | null>(null);
  const [metodos, setMetodos] = useState<MetodosTienda | null>(null);
  const [pagos, setPagos] = useState<Payment[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elegido, setElegido] = useState<MetodoPago | null>(null);
  const [cambiando, setCambiando] = useState(false);
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [v, m, p] = await Promise.all([
        salesService.getSaleById(Number(idVenta)),
        paymentsService.metodos(),
        paymentsService.deVenta(Number(idVenta)),
      ]);
      setVenta(v);
      setMetodos(m);
      setPagos(p);
      setError(null);
    } catch (e) {
      setError(mensajeError(e, "No se pudo cargar el pedido."));
    } finally {
      setCargando(false);
    }
  }, [idVenta]);

  // Carga inicial: los setState ocurren al llegar las respuestas (después del await), no durante el efecto.
  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, [cargar]);

  // Al volver a la app (p. ej. desde la pasarela de la tarjeta) se revisa si el pago ya se aprobó.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado === "active") void cargar();
    });
    return () => sub.remove();
  }, [cargar]);

  const aprobado = venta?.estado === "PAGADA" || pagos.some((p) => p.estado === "APROBADO");
  const pendiente = venta?.estado === "PENDIENTE";
  // El pago "en curso" es el último pendiente que no sea de tarjeta (la tarjeta se resuelve en la pasarela).
  const enCurso = pagos.find((p) => p.estado === "PENDIENTE" && p.metodo !== "TARJETA") ?? null;
  const rechazado = !enCurso ? pagos.find((p) => p.estado === "RECHAZADO") : undefined;

  // Mientras la tienda revisa el comprobante, se consulta cada 20 s (además del push).
  useEffect(() => {
    if (!enCurso || aprobado) return;
    const t = setInterval(() => void cargar(), 20_000);
    return () => clearInterval(t);
  }, [enCurso, aprobado, cargar]);

  const registrar = async (metodo: MetodoPago) => {
    if (!venta) return;
    setTrabajando(true);
    try {
      if (metodo === "TARJETA") {
        const { url } = await paymentsService.pagarConTarjeta(venta.idVenta);
        await WebBrowser.openBrowserAsync(url);
        await cargar();
      } else {
        await paymentsService.create({ idVenta: venta.idVenta, metodo, monto: Number(venta.total), clientRequestId: generateUUID() });
        setCambiando(false);
        await cargar();
      }
    } catch (e) {
      Alert.alert("No se pudo registrar el pago", mensajeError(e, "Intenta de nuevo."));
    } finally {
      setTrabajando(false);
    }
  };

  const subirComprobante = async (pago: Payment) => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, base64: true });
    if (r.canceled || !r.assets?.[0]?.base64) return;
    const foto = r.assets[0];
    setTrabajando(true);
    try {
      await paymentsService.subirComprobante(pago.idPago, foto.base64!, foto.mimeType ?? "image/jpeg", foto.fileName ?? "comprobante.jpg");
      await cargar();
      Alert.alert("Comprobante enviado", "La tienda lo revisará y te avisaremos cuando apruebe tu pago.");
    } catch (e) {
      Alert.alert("No se pudo subir el comprobante", mensajeError(e, "Intenta con otra foto."));
    } finally {
      setTrabajando(false);
    }
  };

  if (cargando) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  const opciones = metodos ? OPCIONES.filter((o) => o.activo(metodos)) : [];
  const actual = elegido ?? opciones[0]?.metodo ?? null;

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center bg-white px-4 pb-3 pt-2">
        <Pressable onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={26} color="#111827" />
        </Pressable>
        <Text className="text-xl font-bold text-gray-900">Pagar pedido</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {error || !venta || !metodos ? (
          <View className="m-5 rounded-2xl bg-white p-5">
            <Text className="text-gray-700">{error ?? "No se pudo cargar el pedido."}</Text>
            <View className="mt-4">
              <Button title="Reintentar" onPress={() => { setCargando(true); void cargar(); }} />
            </View>
          </View>
        ) : (
          <>
            {/* Resumen */}
            <View className="mt-3 bg-white px-5 py-4">
              <Text className="text-xs uppercase tracking-wider text-gray-500">Pedido #{venta.idVenta}</Text>
              <Text className="mt-1 text-sm text-gray-600">Retiro en {venta.sucursal?.nombre}</Text>
              <View className="mt-3 flex-row justify-between border-t border-gray-100 pt-3">
                <Text className="text-lg font-bold text-gray-900">Total</Text>
                <Text className="text-lg font-bold text-primary-500">{fmt(venta.total)}</Text>
              </View>
            </View>

            <View className="mt-3 bg-white px-5 py-5">
              {aprobado ? (
                <Aviso icono="checkmark-circle" color="#16a34a" titulo="¡Pago confirmado!" texto="Tu pedido está pagado y la tienda ya lo está preparando." />
              ) : !pendiente ? (
                <Aviso icono="close-circle" color="#dc2626" titulo="Pedido cancelado" texto="Este pedido ya no se puede pagar." />
              ) : enCurso && !cambiando ? (
                <PagoEnCurso pago={enCurso} metodos={metodos} sucursal={venta.sucursal?.nombre} trabajando={trabajando} onSubir={() => subirComprobante(enCurso)} onCambiar={() => { setCambiando(true); setElegido(null); }} />
              ) : (
                <>
                  {rechazado && (
                    <View className="mb-4 rounded-xl bg-amber-50 p-3">
                      <Text className="text-sm text-amber-800">
                        Tu pago anterior por {nombre(rechazado.metodo).toLowerCase()} no fue aprobado. Elige un medio para intentarlo de nuevo.
                      </Text>
                    </View>
                  )}
                  <Text className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Elige cómo pagar</Text>
                  {opciones.length === 0 ? (
                    <Text className="text-gray-600">La tienda todavía no activó medios de pago en línea. Acércate a la sucursal para pagar.</Text>
                  ) : (
                    opciones.map((o) => {
                      const activo = o.metodo === actual;
                      return (
                        <Pressable key={o.metodo} onPress={() => setElegido(o.metodo)} className={`mb-2 flex-row items-center rounded-xl border-2 p-4 ${activo ? "border-primary-500 bg-primary-50" : "border-gray-100 bg-white"}`}>
                          <Ionicons name={o.icono} size={24} color={activo ? "#e11d48" : "#6b7280"} />
                          <View className="ml-3 flex-1">
                            <Text className="font-semibold text-gray-900">{o.nombre}</Text>
                            <Text className="mt-0.5 text-xs text-gray-500">
                              {o.detalle}
                              {o.metodo === "TARJETA" && metodos.proveedorTarjeta === "SIMULADO" ? " (modo de prueba)" : ""}
                            </Text>
                          </View>
                          <Ionicons name={activo ? "radio-button-on" : "radio-button-off"} size={20} color={activo ? "#e11d48" : "#d1d5db"} />
                        </Pressable>
                      );
                    })
                  )}
                  {actual && (
                    <View className="mt-3 gap-2">
                      <Button title={actual === "TARJETA" ? `Pagar ${fmt(venta.total)}` : "Continuar"} loading={trabajando} onPress={() => registrar(actual)} />
                      {cambiando && <Button title="Volver" variant="outline" onPress={() => setCambiando(false)} />}
                    </View>
                  )}
                </>
              )}
            </View>

            <View className="mx-5 mt-4">
              <Button title="Ver mis pedidos" variant="outline" onPress={() => router.replace("/orders" as any)} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Aviso({ icono, color, titulo, texto }: { icono: keyof typeof Ionicons.glyphMap; color: string; titulo: string; texto: string }) {
  return (
    <View className="items-center py-2">
      <Ionicons name={icono} size={48} color={color} />
      <Text className="mt-2 text-lg font-bold text-gray-900">{titulo}</Text>
      <Text className="mt-1 text-center text-gray-600">{texto}</Text>
    </View>
  );
}

/** Pago registrado y esperando: QR o datos de la cuenta + comprobante, o instrucciones de efectivo. */
function PagoEnCurso({ pago, metodos, sucursal, trabajando, onSubir, onCambiar }: { pago: Payment; metodos: MetodosTienda; sucursal?: string; trabajando: boolean; onSubir: () => void; onCambiar: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const conComprobante = pago.metodo === "QR" || pago.metodo === "TRANSFERENCIA";

  useEffect(() => {
    if (pago.metodo !== "QR") return;
    paymentsService.qrDataUrl().then(setQr).catch(() => setQrError(true));
  }, [pago.metodo]);

  const c = metodos.cuenta;
  return (
    <View>
      <Text className="text-sm font-semibold uppercase tracking-wider text-gray-500">{nombre(pago.metodo)}</Text>

      {pago.metodo === "QR" && (
        <View className="mt-3 items-center rounded-2xl bg-gray-50 p-4">
          {qr ? <Image source={{ uri: qr }} style={{ width: 220, height: 220 }} resizeMode="contain" /> : qrError ? <Text className="text-gray-600">La tienda todavía no subió su QR.</Text> : <ActivityIndicator color="#e11d48" />}
          <Text className="mt-2 text-center text-xs text-gray-500">Escanéalo con la app de tu banco. Tip: haz una captura y ábrela desde tu banco.</Text>
        </View>
      )}

      {pago.metodo === "TRANSFERENCIA" && c && (
        <View className="mt-3 rounded-2xl bg-gray-50 p-4">
          {[["Banco", c.banco], ["Titular", c.titular], ["Cuenta", c.numeroCuenta], ["Tipo", c.tipoCuenta], ["Documento", c.documentoTitular]]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <View key={k} className="flex-row justify-between py-1">
                <Text className="text-gray-500">{k}</Text>
                <Text selectable className="font-semibold text-gray-900">{v}</Text>
              </View>
            ))}
        </View>
      )}

      {metodos.instrucciones ? <Text className="mt-3 text-sm text-gray-600">{metodos.instrucciones}</Text> : null}

      {conComprobante ? (
        <View className="mt-4">
          {pago.comprobante ? (
            <View className="mb-3 rounded-xl bg-blue-50 p-3">
              <Text className="text-sm text-blue-800">Comprobante enviado. La tienda lo está revisando; te avisaremos con una notificación.</Text>
            </View>
          ) : null}
          <Button title={pago.comprobante ? "Cambiar comprobante" : "Subir foto del comprobante"} loading={trabajando} onPress={onSubir} variant={pago.comprobante ? "outline" : "primary"} />
        </View>
      ) : (
        <View className="mt-3 rounded-xl bg-blue-50 p-3">
          <Text className="text-sm text-blue-800">
            {pago.metodo === "EFECTIVO" ? `Pagas al retirar tu pedido${sucursal ? ` en ${sucursal}` : ""}. Muestra el número de pedido en caja.` : "Pagas cuando recibes tu pedido."}
          </Text>
        </View>
      )}

      <Pressable onPress={onCambiar} className="mt-4 items-center py-2">
        <Text className="font-semibold text-primary-500">Pagar con otro medio</Text>
      </Pressable>
    </View>
  );
}
