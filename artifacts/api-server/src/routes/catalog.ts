import { and, asc, eq, ilike } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, productsTable } from "@workspace/db";
import {
  ListCategoriesResponse,
  ListProductsQueryParams,
  ListProductsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/products", async (req, res): Promise<void> => {
  const query = ListProductsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.search) {
    conditions.push(ilike(productsTable.name, `%${query.data.search}%`));
  }
  if (query.data.category) {
    conditions.push(eq(productsTable.category, query.data.category));
  }

  const products = await db
    .select()
    .from(productsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(productsTable.category), asc(productsTable.name));

  res.json(
    ListProductsResponse.parse(
      products.map((product) => ({
        ...product,
        price: Number(product.price),
        quantity: Number(product.quantity),
      })),
    ),
  );
});

router.get("/categories", async (_req, res): Promise<void> => {
  const categories = await db
    .selectDistinct({ category: productsTable.category })
    .from(productsTable)
    .orderBy(asc(productsTable.category));

  res.json(ListCategoriesResponse.parse(categories.map(({ category }) => category)));
});

export default router;