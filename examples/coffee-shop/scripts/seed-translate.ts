/**
 * Updates existing categories and products from Polish to English.
 * Run after db:seed if the database was previously seeded with Polish data.
 */
import { db } from "../lib/db";
import { categories, products } from "../lib/db/schema";
import { eq, asc } from "drizzle-orm";

const CATEGORY_UPDATES: Array<{ sortOrder: number; name: string }> = [
  { sortOrder: 0, name: "Coffee" },
  { sortOrder: 1, name: "Tea" },
  { sortOrder: 2, name: "Snacks" },
];

const PRODUCT_UPDATES: Array<{
  categorySortOrder: number;
  productSortOrder: number;
  name: string;
  description: string;
}> = [
  { categorySortOrder: 0, productSortOrder: 0, name: "Espresso", description: "Pure, intense coffee" },
  { categorySortOrder: 0, productSortOrder: 1, name: "Cappuccino", description: "Espresso with milk and foam" },
  { categorySortOrder: 0, productSortOrder: 2, name: "Latte", description: "Smooth coffee with milk" },
  { categorySortOrder: 1, productSortOrder: 0, name: "Black Tea", description: "Classic black tea" },
  { categorySortOrder: 2, productSortOrder: 0, name: "Croissant", description: "Fresh butter croissant" },
];

async function translate() {
  for (const { sortOrder, name } of CATEGORY_UPDATES) {
    await db.update(categories).set({ name }).where(eq(categories.sortOrder, sortOrder));
  }

  const cats = await db.select().from(categories).orderBy(asc(categories.sortOrder));
  const catBySort = Object.fromEntries(cats.map((c) => [c.sortOrder, c.id]));

  for (const { categorySortOrder, productSortOrder, name, description } of PRODUCT_UPDATES) {
    const categoryId = catBySort[categorySortOrder];
    if (!categoryId) continue;
    const prods = await db
      .select()
      .from(products)
      .where(eq(products.categoryId, categoryId))
      .orderBy(asc(products.sortOrder));
    const prod = prods[productSortOrder];
    if (prod) {
      await db.update(products).set({ name, description }).where(eq(products.id, prod.id));
    }
  }

  console.log("Translation to English completed.");
}

translate().catch(console.error);
