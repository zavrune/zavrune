import { ensureDatabaseSchema, logDatabaseError } from "./initialize";
import { seedDatabase } from "./seed";
import { pool } from "./index";

async function main() {
  try {
    await ensureDatabaseSchema();
    await seedDatabase();
    console.log("Seeding finished successfully.");
  } catch (err) {
    logDatabaseError("Seeding failed", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
