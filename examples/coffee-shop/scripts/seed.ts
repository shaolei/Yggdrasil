import { db } from "../lib/db";
import {
  users,
  categories,
  products,
} from "../lib/db/schema";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

async function seed() {
  const [existing] = await db.select().from(users).limit(1);
  if (existing) {
    console.log("Seed already applied. Skip.");
    return;
  }
  const ownerHash = await bcrypt.hash("owner123", 10);
  const baristaHash = await bcrypt.hash("barista123", 10);
  const customerHash = await bcrypt.hash("customer123", 10);

  await db.insert(users).values([
    {
      id: randomUUID(),
      email: "owner@coffee.local",
      passwordHash: ownerHash,
      name: "Owner",
      role: "owner",
    },
    {
      id: randomUUID(),
      email: "barista@coffee.local",
      passwordHash: baristaHash,
      name: "Barista",
      role: "barista",
    },
    {
      id: randomUUID(),
      email: "customer@coffee.local",
      passwordHash: customerHash,
      name: "Customer",
      role: "customer",
    },
  ]);

  const catCoffee = randomUUID();
  const catTea = randomUUID();
  const catSnacks = randomUUID();

  await db.insert(categories).values([
    { id: catCoffee, name: "Coffee", sortOrder: 0 },
    { id: catTea, name: "Tea", sortOrder: 1 },
    { id: catSnacks, name: "Snacks", sortOrder: 2 },
  ]);

  await db.insert(products).values([
    {
      id: randomUUID(),
      categoryId: catCoffee,
      name: "Espresso",
      description: "Pure, intense coffee",
      priceS: 800,
      priceM: 1000,
      priceL: 1200,
      available: true,
      sortOrder: 0,
    },
    {
      id: randomUUID(),
      categoryId: catCoffee,
      name: "Cappuccino",
      description: "Espresso with milk and foam",
      priceS: 1200,
      priceM: 1400,
      priceL: 1600,
      available: true,
      sortOrder: 1,
    },
    {
      id: randomUUID(),
      categoryId: catCoffee,
      name: "Latte",
      description: "Smooth coffee with milk",
      priceS: 1300,
      priceM: 1500,
      priceL: 1700,
      available: true,
      sortOrder: 2,
    },
    {
      id: randomUUID(),
      categoryId: catTea,
      name: "Black Tea",
      description: "Classic black tea",
      priceS: 600,
      priceM: 800,
      priceL: 1000,
      available: true,
      sortOrder: 0,
    },
    {
      id: randomUUID(),
      categoryId: catSnacks,
      name: "Croissant",
      description: "Fresh butter croissant",
      priceS: 900,
      priceM: 900,
      priceL: 900,
      available: true,
      sortOrder: 0,
    },
  ]);

  console.log("Seed completed.");
}

seed().catch(console.error);
