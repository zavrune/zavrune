import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems, orderEvents } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  try {
    const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
    const allItems = await db.select().from(orderItems);

    const result = allOrders.map((o) => ({
      ...o,
      items: allItems.filter((item) => item.orderId === o.id),
    }));

    return NextResponse.json({ success: true, orders: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { orderId, status } = await req.json();

    const [updated] = await db
      .update(orders)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    // Record Event History
    await db.insert(orderEvents).values({
      orderId,
      status,
      note: `Status updated to ${status} by Admin.`,
      createdBy: "Admin",
    });

    return NextResponse.json({ success: true, order: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
