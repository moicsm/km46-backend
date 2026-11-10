// Panel "Datos del pago" en la página de cada pedido del Admin.
//
// La tienda cobra por Zelle / Pago Móvil / PayPal fuera de la web. El cliente
// deja estos datos en el checkout (se guardan en la metadata del pedido) y manda
// el capture por WhatsApp. Aquí se ven claros para compararlos con el banco
// antes de darle "Capture payment" (confirmar pago).
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminOrder, DetailWidgetProps } from "@medusajs/types"
import { Badge, Container, Heading, Text } from "@medusajs/ui"

const text = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v))
const money = (n: number) => `$${n.toFixed(2)}`

const DatosDelPagoWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const m = (order.metadata ?? {}) as Record<string, unknown>
  const metodo = text(m.metodo_pago)
  const referencia = text(m.referencia)

  // Pedidos que no vienen del checkout de la web (ej. creados a mano): no se muestra nada
  if (!metodo && !referencia) return null

  const reportado = Number(text(m.monto_reportado).replace(",", "."))
  const total = typeof order.total === "number" ? order.total : null
  const montoNoCoincide = total !== null && !Number.isNaN(reportado) && reportado > 0 && Math.abs(reportado - total) > 0.009

  const filas: [string, string][] = [
    ["Método", metodo],
    ["Referencia", referencia],
    ["Titular de la cuenta", text(m.titular)],
    ["Monto que reportó", text(m.monto_reportado) ? `$${text(m.monto_reportado)}` : ""],
    ["Teléfono", text(m.telefono)],
    ["Nota del cliente", text(m.nota)],
  ]

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Datos del pago</Heading>
        {metodo && <Badge size="2xsmall">{metodo}</Badge>}
      </div>

      <div className="flex flex-col gap-y-3 px-6 py-4">
        {filas
          .filter(([, valor]) => valor)
          .map(([etiqueta, valor]) => (
            <div key={etiqueta} className="grid grid-cols-2 items-start gap-x-4">
              <Text size="small" leading="compact" className="text-ui-fg-subtle">
                {etiqueta}
              </Text>
              <Text
                size="small"
                leading="compact"
                weight={etiqueta === "Referencia" ? "plus" : "regular"}
                className="break-words"
              >
                {valor}
              </Text>
            </div>
          ))}
        {total !== null && (
          <div className="grid grid-cols-2 items-start gap-x-4">
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              Total del pedido
            </Text>
            <Text size="small" leading="compact" weight="plus">
              {money(total)}
            </Text>
          </div>
        )}
        {montoNoCoincide && (
          <Badge color="orange" size="2xsmall" className="w-fit">
            El monto reportado no coincide con el total
          </Badge>
        )}
      </div>

      <div className="px-6 py-4">
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          El comprobante (capture) llega por WhatsApp. Cuando confirmes el pago en el banco, usa
          “Capture payment”; al despachar, “Create fulfillment”.
        </Text>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.before",
})

export default DatosDelPagoWidget
