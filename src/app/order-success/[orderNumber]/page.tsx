import { db } from "@/db";
import { orders, orderItems, navigation } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CheckCircle2, Truck, PhoneCall, ArrowLeft, ShoppingBag } from "lucide-react";
import { formatDZD } from "@/lib/translations";

export const revalidate = 0;

interface OrderSuccessProps {
  params: Promise<{ orderNumber: string }>;
}

export default async function OrderSuccessPage({ params }: OrderSuccessProps) {
  const { orderNumber } = await params;

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);

  if (!order) {
    notFound();
  }

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  const navItems = await db
    .select()
    .from(navigation)
    .where(eq(navigation.location, "header"));

  return (
    <div className="min-h-screen bg-[#08080A] text-zinc-100 flex flex-col font-sans antialiased">
      <Header customNav={navItems as any} />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-12 space-y-8">
        {/* Banner Success Card */}
        <div className="bg-[#0E0E12] border border-emerald-500/40 p-6 sm:p-8 text-center space-y-4 shadow-2xl relative overflow-hidden">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-widest block">
              ORDER CONFIRMED
            </span>
            <h1 className="text-2xl sm:text-4xl font-black font-mono uppercase text-white tracking-tight">
              ORDER RECEIVED SUCCESSFULLY!
            </h1>
            <p className="text-sm font-mono text-zinc-400 max-w-lg mx-auto">
              Thank you for shopping with ZAVRUNE. We will phone call you shortly at <strong className="text-white">{order.customerPhone}</strong> to confirm delivery.
            </p>
          </div>

          <div className="pt-2 font-mono text-xs">
            <span className="bg-zinc-800 text-zinc-200 px-3 py-1.5 border border-white/10 uppercase">
              ORDER NUMBER: <strong className="text-white font-bold">{order.orderNumber}</strong>
            </span>
          </div>
        </div>

        {/* Order Details & Summary */}
        <div className="bg-[#121216] border border-white/10 p-6 space-y-6 font-mono text-xs">
          <h2 className="text-sm font-bold text-white uppercase border-b border-white/10 pb-3 flex items-center justify-between">
            <span>ORDERED ITEMS</span>
            <span className="text-zinc-400">{items.length} item</span>
          </h2>

          <div className="space-y-4 divide-y divide-white/5">
            {items.map((item) => (
              <div key={item.id} className="pt-4 first:pt-0 flex items-center gap-4">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.productName}
                    className="w-16 h-20 object-cover border border-white/10 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-20 bg-zinc-800 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-6 h-6 text-zinc-500" />
                  </div>
                )}

                <div className="flex-1 space-y-1">
                  <h3 className="font-bold text-sm text-white uppercase">{item.productName}</h3>
                  <div className="text-zinc-400 text-[11px] space-x-2">
                    <span>Color: <strong className="text-zinc-200">{item.color}</strong></span>
                    <span>•</span>
                    <span>Size: <strong className="text-zinc-200">{item.size}</strong></span>
                    <span>•</span>
                    <span>Qty: <strong className="text-zinc-200">{item.quantity}</strong></span>
                  </div>
                </div>

                <div className="text-right font-bold text-sm text-white">
                  {formatDZD(item.totalPrice)}
                </div>
              </div>
            ))}
          </div>

          {/* Pricing Totals Breakdown */}
          <div className="pt-4 border-t border-white/10 space-y-2">
            <div className="flex justify-between text-zinc-400">
              <span>Items Subtotal:</span>
              <span>{formatDZD(order.itemsSubtotal)}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Shipping Fee ({order.shippingMethodName}):</span>
              <span>{formatDZD(order.shippingPrice)}</span>
            </div>
            <div className="pt-2 border-t border-white/10 flex justify-between text-base font-bold text-white">
              <span>TOTAL (DZD):</span>
              <span className="text-emerald-400 text-lg">{formatDZD(order.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Customer & Delivery Address */}
        <div className="bg-[#121216] border border-white/10 p-6 space-y-4 font-mono text-xs">
          <h2 className="text-sm font-bold text-white uppercase border-b border-white/10 pb-3 flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-400" />
            <span>DELIVERY ADDRESS</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-zinc-300">
            <div>
              <span className="text-zinc-500 block uppercase">Customer Name</span>
              <strong className="text-white text-sm">{order.customerName}</strong>
            </div>

            <div>
              <span className="text-zinc-500 block uppercase">Phone Number</span>
              <strong className="text-white text-sm">{order.customerPhone}</strong>
            </div>

            <div>
              <span className="text-zinc-500 block uppercase">Wilaya & Commune</span>
              <span className="text-white">{order.wilaya} — {order.commune}</span>
            </div>

            <div>
              <span className="text-zinc-500 block uppercase">Address</span>
              <span className="text-white">{order.address}</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="text-center pt-4">
          <a
            href="/shop"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-black font-mono font-extrabold text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>CONTINUE SHOPPING</span>
          </a>
        </div>
      </main>

      <Footer />
    </div>
  );
}
