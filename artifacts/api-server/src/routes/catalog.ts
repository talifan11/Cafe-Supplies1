import { and, asc, eq, ilike } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, categoriesTable, productsTable } from "@workspace/db";
import {
  CreateCategoryBody,
  CreateCategoryResponse,
  CreateProductBody,
  CreateProductResponse,
  DeleteCategoryParams,
  DeleteProductParams,
  ListCategoriesResponse,
  ListProductsQueryParams,
  ListProductsResponse,
  UpdateCategoryBody,
  UpdateCategoryParams,
  UpdateCategoryResponse,
  UpdateProductBody,
  UpdateProductParams,
  UpdateProductResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../lib/adminAuth";

const router: IRouter = Router();

const normalizeProduct = (product: typeof productsTable.$inferSelect) => ({
  ...product,
  price: Number(product.price),
  quantity: Number(product.quantity),
});

const normalizeCategory = (category: typeof categoriesTable.$inferSelect) => ({
  ...category,
  parentId: category.parentId ?? null,
});

function validWholeNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

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

  res.json(ListProductsResponse.parse(products.map(normalizeProduct)));
});

router.post("/products", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!validWholeNumber(parsed.data.quantity)) {
    res.status(400).json({ error: "Количество должно быть целым числом" });
    return;
  }

  const [product] = await db.insert(productsTable).values({
    ...parsed.data,
    description: parsed.data.description ?? "",
  }).returning();
  res.status(201).json(CreateProductResponse.parse(normalizeProduct(product)));
});

router.patch("/products/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.quantity !== undefined && !validWholeNumber(parsed.data.quantity)) {
    res.status(400).json({ error: "Количество должно быть целым числом" });
    return;
  }

  const [product] = await db.update(productsTable).set({
    ...parsed.data,
    ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
  }).where(eq(productsTable.id, params.data.id)).returning();
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(UpdateProductResponse.parse(normalizeProduct(product)));
});

router.delete("/products/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const [product] = await db.delete(productsTable).where(eq(productsTable.id, params.data.id)).returning();
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.sendStatus(204);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23503") {
      res.status(409).json({ error: "Товар уже есть в заказах и не может быть удалён" });
      return;
    }
    throw error;
  }
});

router.get("/categories", async (_req, res): Promise<void> => {
  const categories = await db.select().from(categoriesTable).orderBy(asc(categoriesTable.name));
  res.json(ListCategoriesResponse.parse(categories.map(normalizeCategory)));
});

router.post("/categories", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.parentId !== null && parsed.data.parentId !== undefined) {
    const [parent] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, parsed.data.parentId));
    if (!parent || parent.parentId !== null) {
      res.status(400).json({ error: "Подкатегория может принадлежать только категории верхнего уровня" });
      return;
    }
  }
  const [category] = await db.insert(categoriesTable).values({
    name: parsed.data.name.trim(),
    parentId: parsed.data.parentId ?? null,
  }).returning();
  res.status(201).json(CreateCategoryResponse.parse(normalizeCategory(category)));
});

router.patch("/categories/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateCategoryParams.safeParse(req.params);
  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  const nextParentId = parsed.data.parentId === undefined ? existing.parentId : parsed.data.parentId;
  if (nextParentId !== null && nextParentId !== undefined) {
    const [parent] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, nextParentId));
    if (!parent || parent.parentId !== null || parent.id === existing.id) {
      res.status(400).json({ error: "Недопустимая родительская категория" });
      return;
    }
  }

  const nextName = parsed.data.name?.trim();
  const [category] = await db.update(categoriesTable).set({
    ...(nextName !== undefined ? { name: nextName } : {}),
    ...(parsed.data.parentId !== undefined ? { parentId: parsed.data.parentId } : {}),
  }).where(eq(categoriesTable.id, params.data.id)).returning();

  if (nextName && nextName !== existing.name) {
    if (existing.parentId === null) {
      await db.update(productsTable).set({ category: nextName }).where(eq(productsTable.category, existing.name));
    } else {
      await db.update(productsTable).set({ subcategory: nextName }).where(eq(productsTable.subcategory, existing.name));
    }
  }
  res.json(UpdateCategoryResponse.parse(normalizeCategory(category)));
});

router.delete("/categories/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, params.data.id));
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  const children = await db.select({ id: categoriesTable.id }).from(categoriesTable).where(eq(categoriesTable.parentId, category.id));
  const products = category.parentId === null
    ? await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.category, category.name))
    : await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.subcategory, category.name));
  if (children.length || products.length) {
    res.status(400).json({ error: "Сначала переназначьте товары и удалите подкатегории" });
    return;
  }
  await db.delete(categoriesTable).where(eq(categoriesTable.id, category.id));
  res.sendStatus(204);
});

export default router;