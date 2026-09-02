import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateOrderBody,
  CreateOrderResponse,
  GetOrderSummaryResponse,
  ListOrdersQueryParams,
  ListOrdersResponse,
  UpdateOrderStatusBody,
  UpdateOrderStatusParams,
  UpdateOrderStatusResponse,
} from "@workspace/api-zod";
import {
  db,
  orderItemsTable,
  ordersTable,
  productsTable,
} from "@workspace/db";

const router: IRouter = Router();
const statuses = ["new", "picking", "delivery", "completed"] as const;

async function getOrderWithItems(id: number) {
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, id));
  if (!order) return undefined;

  const items = await db
    .select({
      productId: orderItemsTable.productId,
      productName: productsTable.name,
      quantity: orderItemsTable.quantity,
      price: orderItemsTable.priceAtMoment,
    })
    .from(orderItemsTable)
    .innerJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
    .where(eq(orderItemsTable.orderId, id))
    .orderBy(asc(orderItemsTable.id));

  return {
    id: order.id,
    clientName: order.clientName,
    phone: order.phone,
    address: order.address,
    totalSum: Number(order.totalSum),
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    items: items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      price: Number(item.price),
      lineTotal: Number(item.price) * item.quantity,
    })),
  };
}

router.get("/orders", async (req, res): Promise<void> => {
  const query = ListOrdersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const orders = await db
    .select()
    .from(ordersTable)
    .where(query.data.status ? eq(ordersTable.status, query.data.status) : undefined)
    .orderBy(desc(ordersTable.createdAt));

  const detailedOrders = await Promise.all(
    orders.map((order) => getOrderWithItems(order.id)),
  );
  res.json(ListOrdersResponse.parse(detailedOrders.filter(Boolean)));
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const hasInvalidQuantity = parsed.data.items.some(
    (item) => !Number.isInteger(item.productId) || !Number.isInteger(item.quantity),
  );
  if (hasInvalidQuantity) {
    res.status(400).json({ error: "Product IDs and quantities must be whole numbers" });
    return;
  }

  const created = await db.transaction(async (tx) => {
    const productIds = [...new Set(parsed.data.items.map((item) => item.productId))];
    const products = await tx
      .select()
      .from(productsTable)
      .where(inArray(productsTable.id, productIds));

    const productById = new Map(products.map((product) => [product.id, product]));
    let totalSum = 0;
    for (const item of parsed.data.items) {
      const product = productById.get(item.productId);
      if (!product) throw new Error("One of the selected products no longer exists");
      if (product.quantity < item.quantity) {
        throw new Error(`Not enough stock for ${product.name}`);
      }
      totalSum += Number(product.price) * item.quantity;
    }

    const [order] = await tx
      .insert(ordersTable)
      .values({
        clientName: parsed.data.clientName.trim(),
        phone: parsed.data.phone.trim(),
        address: parsed.data.address.trim(),
        totalSum: Number(totalSum.toFixed(2)),
        status: "new",
      })
      .returning();

    for (const item of parsed.data.items) {
      const product = productById.get(item.productId)!;
      await tx.insert(orderItemsTable).values({
        orderId: order.id,
        productId: product.id,
        quantity: item.quantity,
        priceAtMoment: Number(product.price),
      });
      await tx
        .update(productsTable)
        .set({ quantity: product.quantity - item.quantity })
        .where(eq(productsTable.id, product.id));
    }

    return { orderId: order.id, totalSum: Number(order.totalSum) };
  });

  res.status(201).json(CreateOrderResponse.parse(created));
});

router.get("/orders/summary", async (_req, res): Promise<void> => {
  const [totals] = await db
    .select({
      totalOrders: sql<number>`count(*)`,
      totalRevenue: sql<number>`coalesce(sum(${ordersTable.totalSum}), 0)`,
    })
    .from(ordersTable);
  const grouped = await db
    .select({ status: ordersTable.status, count: sql<number>`count(*)` })
    .from(ordersTable)
    .groupBy(ordersTable.status);
  const counts = new Map(grouped.map((row) => [row.status, Number(row.count)]));

  res.json(
    GetOrderSummaryResponse.parse({
      totalOrders: Number(totals?.totalOrders ?? 0),
      totalRevenue: Number(totals?.totalRevenue ?? 0),
      newOrders: counts.get("new") ?? 0,
      pickingOrders: counts.get("picking") ?? 0,
      deliveryOrders: counts.get("delivery") ?? 0,
      completedOrders: counts.get("completed") ?? 0,
    }),
  );
});

router.patch("/orders/:id/status", async (req, res): Promise<void> => {
  const params = UpdateOrderStatusParams.safeParse(req.params);
  const body = UpdateOrderStatusBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid order or status" });
    return;
  }
  if (!statuses.includes(body.data.status)) {
    res.status(400).json({ error: "Invalid order status" });
    return;
  }

  const [updated] = await db
    .update(ordersTable)
    .set({ status: body.data.status })
    .where(eq(ordersTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const order = await getOrderWithItems(updated.id);
  res.json(UpdateOrderStatusResponse.parse(order));
});

export default router;