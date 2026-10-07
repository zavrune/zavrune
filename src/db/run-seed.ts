import { seedDatabase } from "./seed";
import { pool } from "./index";

async function main() {
  try {
    await seedDatabase();
    console.log("Seeding finished successfully.");
  } catch (err) {
    console.error("Seeding failed:", err);
  } finally {
    await pool.end();
  }
}

main();
