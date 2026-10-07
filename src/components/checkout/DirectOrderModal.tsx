"use client";

import React, { useState, useEffect } from "react";
import { useDirectOrder } from "@/context/DirectOrderContext";
import { useLanguage } from "@/context/LanguageContext";
import { ALGERIA_WILAYAS } from "@/lib/wilayas";
import { formatDZD } from "@/lib/translations";
import { X, CheckCircle, Truck, AlertCircle, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";

export function DirectOrderModal() {
  const { isOpen, item, closeDirectOrder } = useDirectOrder();
  const { language, t, dir } = useLanguage();
  const router = useRouter();

  const [quantity, setQuantity] = useState(1);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedWilayaCode, setSelectedWilayaCode] = useState("16"); // Default 16 - Alger
  const [selectedCommune, setSelectedCommune] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [deliveryType, setDeliveryType] = useState<"home" | "bureau">("home");

  const [shippingCost, setShippingCost] = useState(400); // default Algiers home
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const currentWilaya = ALGERIA_WILAYAS.find((w) => w.code === selectedWilayaCode) || ALGERIA_WILAYAS[15];

  // Reset or update quantity when item changes
  useEffect(() => {
    if (item) {
      setQuantity(item.quantity || 1);
    }
  }, [item]);

  // Dynamically update shipping cost based on selected Wilaya and Delivery type
  useEffect(() => {
    if (selectedWilayaCode === "16") {
      setShippingCost(deliveryType === "home" ? 400 : 300);
    } else {
      setShippingCost(deliveryType === "home" ? 750 : 450);
    }
  }, [selectedWilayaCode, deliveryType]);

  // Set default commune when wilaya changes
  useEffect(() => {
    if (currentWilaya.communes.length > 0) {
      setSelectedCommune(currentWilaya.communes[0]);
    }
  }, [selectedWilayaCode, currentWilaya]);

  if (!isOpen || !item) return null;

  const unitPrice = item.price;
  const itemsSubtotal = unitPrice * quantity;
  const grandTotal = itemsSubtotal + shippingCost;

  const getProductName = () => {
    if (language === "ar") return item.nameAr || item.nameEn;
    if (language === "fr") return item.nameFr || item.nameEn;
    return item.nameEn;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!fullName.trim()) {
      setErrorMessage(language === "ar" ? "يرجى إدخال الاسم الكامل" : "Please enter your full name");
      return;
    }

    if (!phone.trim() || phone.trim().length < 9) {
      setErrorMessage(language === "ar" ? "يرجى إدخال رقم هاتف صحيح" : "Please enter a valid phone number");
      return;
    }

    if (!address.trim()) {
      setErrorMessage(language === "ar" ? "يرجى إدخال عنوان التوصيل" : "Please enter delivery address");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        customerName: fullName.trim(),
        customerPhone: phone.trim(),
        customerEmail: email.trim() || null,
        wilaya: language === "ar" ? currentWilaya.nameAr : currentWilaya.nameEn,
        commune: selectedCommune,
        address: address.trim(),
        deliveryNotes: deliveryNotes.trim() || null,
        deliveryType,
        items: [
          {
            productId: item.productId,
            variantId: item.variantId,
            color: item.color,
            size: item.size,
            quantity: quantity,
          },
        ],
      };

      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to place order");
      }

      closeDirectOrder();
      router.push(`/order-success/${data.orderNumber}`);
    } catch (err: any) {
      console.error("Order submit error:", err);
      setErrorMessage(err.message || "An error occurred while creating your order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn" dir={dir}>
      <div className="relative w-full max-w-2xl bg-[#0D0D10] border border-white/15 text-zinc-100 shadow-2xl p-4 sm:p-6 my-auto overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            <h2 className="text-lg sm:text-xl font-bold tracking-tight uppercase font-mono">
              {t("directOrder")}
            </h2>
          </div>
          <button
            onClick={closeDirectOrder}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          {/* Selected Item Summary Card */}
          <div className="bg-[#15151A] border border-white/10 p-3 sm:p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={getProductName()}
                className="w-20 h-24 object-cover border border-white/10 shrink-0"
              />
            ) : (
              <div className="w-20 h-24 bg-zinc-800 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-8 h-8 text-zinc-500" />
              </div>
            )}

            <div className="flex-1 min-w-0 space-y-1.5">
              <h3 className="font-bold text-base text-white tracking-wide uppercase line-clamp-1">
                {getProductName()}
              </h3>
              <div className="flex flex-wrap gap-2 text-xs text-zinc-400 font-mono">
                <span className="bg-zinc-800 px-2 py-0.5 border border-white/10">
                  {t("color")}: <strong className="text-zinc-200">{item.color}</strong>
                </span>
                <span className="bg-zinc-800 px-2 py-0.5 border border-white/10">
                  {t("size")}: <strong className="text-zinc-200">{item.size}</strong>
                </span>
                <span className="bg-zinc-800 px-2 py-0.5 border border-white/10 text-emerald-400">
                  {formatDZD(unitPrice)}
                </span>
              </div>

              {/* Quantity Selector */}
              <div className="flex items-center gap-3 pt-1">
                <label className="text-xs text-zinc-400 uppercase font-mono">{t("quantity")}:</label>
                <div className="flex items-center border border-white/20 bg-black">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-2.5 py-1 hover:bg-white/10 text-zinc-300 font-mono"
                  >
                    -
                  </button>
                  <span className="px-3 py-1 text-sm font-bold font-mono min-w-[2rem] text-center">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(item.availableStock || 99, quantity + 1))}
                    className="px-2.5 py-1 hover:bg-white/10 text-zinc-300 font-mono"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="sm:text-right shrink-0">
              <span className="text-xs text-zinc-400 uppercase font-mono block">{t("subtotal")}</span>
              <span className="text-lg font-extrabold text-white font-mono">
                {formatDZD(itemsSubtotal)}
              </span>
            </div>
          </div>

          {/* Customer Details Form */}
          <div className="space-y-4">
            <h4 className="text-xs font-mono text-zinc-400 uppercase tracking-wider border-b border-white/10 pb-1">
              {t("checkoutSubtitle")}
            </h4>

            {errorMessage && (
              <div className="p-3 bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-zinc-300 mb-1">
                  {t("fullName")} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Karim Benali"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-black border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:border-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-300 mb-1">
                  {t("phone")} <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="0550 12 34 56"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-black border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:border-white font-mono transition-colors"
                />
              </div>
            </div>

            {/* Wilaya & Commune */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-zinc-300 mb-1">
                  {t("wilaya")} <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedWilayaCode}
                  onChange={(e) => setSelectedWilayaCode(e.target.value)}
                  className="w-full bg-black border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:border-white font-mono transition-colors"
                >
                  {ALGERIA_WILAYAS.map((w) => (
                    <option key={w.code} value={w.code} className="bg-zinc-900">
                      {language === "ar" ? w.nameAr : w.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-300 mb-1">
                  {t("commune")} <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedCommune}
                  onChange={(e) => setSelectedCommune(e.target.value)}
                  className="w-full bg-black border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:border-white font-mono transition-colors"
                >
                  {currentWilaya.communes.map((c) => (
                    <option key={c} value={c} className="bg-zinc-900">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-mono text-zinc-300 mb-1">
                {t("address")} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Cité 1000 Logements, Bâtiment B, N° 12"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-black border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:border-white transition-colors"
              />
            </div>

            {/* Delivery Method Selector */}
            <div>
              <label className="block text-xs font-mono text-zinc-300 mb-1.5">
                {t("deliveryMethod")}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeliveryType("home")}
                  className={`px-3 py-2 border text-left flex items-center justify-between text-xs font-mono transition-all ${
                    deliveryType === "home"
                      ? "bg-white text-black border-white font-bold"
                      : "bg-black text-zinc-400 border-white/20 hover:border-white/40"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" />
                    {t("homeDelivery")}
                  </span>
                  <span>{selectedWilayaCode === "16" ? "400 دج" : "750 دج"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryType("bureau")}
                  className={`px-3 py-2 border text-left flex items-center justify-between text-xs font-mono transition-all ${
                    deliveryType === "bureau"
                      ? "bg-white text-black border-white font-bold"
                      : "bg-black text-zinc-400 border-white/20 hover:border-white/40"
                  }`}
                >
                  <span>{t("bureauPickup")}</span>
                  <span>{selectedWilayaCode === "16" ? "300 دج" : "450 دج"}</span>
                </button>
              </div>
            </div>

            {/* Delivery Notes */}
            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-1">
                {t("notesOptional")}
              </label>
              <input
                type="text"
                placeholder="e.g. Please call before arriving"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                className="w-full bg-black border border-white/10 px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-white/30"
              />
            </div>
          </div>

          {/* Price Calculation Summary */}
          <div className="bg-[#18181F] border border-white/10 p-3 sm:p-4 space-y-2 text-xs font-mono">
            <div className="flex justify-between text-zinc-400">
              <span>{t("subtotal")} ({quantity} item)</span>
              <span>{formatDZD(itemsSubtotal)}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>{t("shipping")} ({deliveryType === "home" ? t("homeDelivery") : t("bureauPickup")})</span>
              <span>{formatDZD(shippingCost)}</span>
            </div>
            <div className="pt-2 border-t border-white/10 flex justify-between text-base font-bold text-white">
              <span>{t("total")}</span>
              <span className="text-emerald-400 font-extrabold">{formatDZD(grandTotal)}</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-white text-black font-extrabold text-sm sm:text-base tracking-widest uppercase hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>{t("placingOrder")}</span>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                <span>{t("confirmOrder")} • {formatDZD(grandTotal)}</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-center text-zinc-500 font-mono">
            🔒 Payment on Delivery (Cash on Delivery / الدفع عند الاستلام)
          </p>
        </form>
      </div>
    </div>
  );
}
