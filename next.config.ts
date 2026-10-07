import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Startup migration reads these if the server trace does not already include them.
  outputFileTracingIncludes: {
    "/*": ["./drizzle/**/*", "./src/db/embedded-migrations.json"],
  },
};

export default nextConfig;
