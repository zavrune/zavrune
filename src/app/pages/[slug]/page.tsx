import { db } from "@/db";
import { pages, navigation, sizeGuides, sizeGuideMeasurements, categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { DirectOrderModal } from "@/components/checkout/DirectOrderModal";
import { Ruler, Truck, Mail, Phone, HelpCircle } from "lucide-react";

export const revalidate = 0;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CMSPage({ params }: PageProps) {
  const { slug } = await params;

  const navItems = await db
    .select()
    .from(navigation)
    .where(eq(navigation.location, "header"));

  // Check if size guide page requested
  if (slug === "size-guide") {
    const guides = await db.select().from(sizeGuides);
    const measurements = await db.select().from(sizeGuideMeasurements);

    return (
      <div className="min-h-screen bg-[#08080A] text-zinc-100 flex flex-col font-sans antialiased">
        <Header customNav={navItems as any} />

        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 space-y-8 font-mono">
          <div className="border-b border-white/10 pb-6 space-y-2">
            <span className="text-xs text-zinc-400 uppercase tracking-widest block">ZAVRUNE FITTING</span>
            <h1 className="text-3xl sm:text-5xl font-black uppercase text-white tracking-tight flex items-center gap-3">
              <Ruler className="w-8 h-8" />
              <span>STREETWEAR SIZE GUIDE</span>
            </h1>
            <p className="text-sm text-zinc-400">
              All ZAVRUNE garments feature custom heavyweight drops and relaxed proportions. Use measurements below for your optimal fit.
            </p>
          </div>

          <div className="space-y-8">
            {guides.map((g) => {
              const guideMeas = measurements.filter((m) => m.sizeGuideId === g.id);
              return (
                <div key={g.id} className="bg-[#121216] border border-white/10 p-6 space-y-4">
                  <h2 className="text-lg font-bold uppercase text-white">{g.name}</h2>
                  {g.description && <p className="text-xs text-zinc-400">{g.description}</p>}

                  <div className="overflow-x-auto border border-white/10">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-black text-white font-bold border-b border-white/10">
                        <tr>
                          <th className="p-3">SIZE</th>
                          <th className="p-3">CHEST</th>
                          <th className="p-3">WAIST</th>
                          <th className="p-3">LENGTH</th>
                          <th className="p-3">SLEEVE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {guideMeas.map((m) => (
                          <tr key={m.id} className="hover:bg-white/5">
                            <td className="p-3 font-bold text-white">{m.sizeLabel}</td>
                            <td className="p-3 text-zinc-300">{m.chest || "-"}</td>
                            <td className="p-3 text-zinc-300">{m.waist || "-"}</td>
                            <td className="p-3 text-zinc-300 font-bold">{m.length || "-"}</td>
                            <td className="p-3 text-zinc-300">{m.sleeve || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        <Footer />
        <DirectOrderModal />
      </div>
    );
  }

  // Check if shipping page
  if (slug === "shipping") {
    return (
      <div className="min-h-screen bg-[#08080A] text-zinc-100 flex flex-col font-sans antialiased">
        <Header customNav={navItems as any} />

        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 space-y-8 font-mono">
          <div className="border-b border-white/10 pb-6 space-y-2">
            <span className="text-xs text-zinc-400 uppercase tracking-widest block">ALGERIA EXPRESS</span>
            <h1 className="text-3xl sm:text-5xl font-black uppercase text-white tracking-tight flex items-center gap-3">
              <Truck className="w-8 h-8" />
              <span>SHIPPING & RETURNS</span>
            </h1>
          </div>

          <div className="bg-[#121216] border border-white/10 p-6 sm:p-8 space-y-6 text-xs text-zinc-300 leading-relaxed">
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-white uppercase">58 Wilayas Home & Desk Delivery</h2>
              <p>
                ZAVRUNE delivers directly across all 58 Wilayas in Algeria. All orders are processed within 24 hours of telephone confirmation.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-bold text-white uppercase">Rates & Delivery Times</h2>
              <ul className="list-disc list-inside space-y-1 text-zinc-400">
                <li><strong>Wilaya 16 (Alger Hub):</strong> 400 DZD (Home) / 300 DZD (Desk) • 24-48 Hours</li>
                <li><strong>All Other Wilayas:</strong> 750 DZD (Home) / 450 DZD (Stop Desk) • 2-4 Business Days</li>
                <li><strong>Free Shipping:</strong> Free delivery on all orders over 15,000 DZD.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-bold text-white uppercase">Cash on Delivery & Inspections</h2>
              <p>
                You pay in cash upon receiving your order. You have the right to inspect the item upon delivery before making payment.
              </p>
            </div>
          </div>
        </main>

        <Footer />
        <DirectOrderModal />
      </div>
    );
  }

  // Check if contact page
  if (slug === "contact") {
    return (
      <div className="min-h-screen bg-[#08080A] text-zinc-100 flex flex-col font-sans antialiased">
        <Header customNav={navItems as any} />

        <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-12 space-y-8 font-mono">
          <div className="border-b border-white/10 pb-6 space-y-2">
            <h1 className="text-3xl sm:text-5xl font-black uppercase text-white tracking-tight">
              CONTACT ZAVRUNE
            </h1>
            <p className="text-xs text-zinc-400">
              Have questions regarding sizing, custom drop release, or order confirmation? Reach out directly.
            </p>
          </div>

          <div className="bg-[#121216] border border-white/10 p-6 sm:p-8 space-y-6 text-xs">
            <div className="flex items-center gap-4 p-4 bg-black border border-white/10">
              <Phone className="w-6 h-6 text-white shrink-0" />
              <div>
                <span className="text-zinc-500 uppercase block">Phone / WhatsApp</span>
                <strong className="text-white text-base">+213 550 00 00 00</strong>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-black border border-white/10">
              <Mail className="w-6 h-6 text-white shrink-0" />
              <div>
                <span className="text-zinc-500 uppercase block">Support Email</span>
                <strong className="text-white text-base">contact@zavrune.com</strong>
              </div>
            </div>
          </div>
        </main>

        <Footer />
        <DirectOrderModal />
      </div>
    );
  }

  notFound();
}
