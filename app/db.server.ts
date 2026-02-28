import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

// Reuse a single PrismaClient across requests (avoids connection pool exhaustion in serverless)
const prisma =
  global.prismaGlobal ?? (global.prismaGlobal = new PrismaClient());

export default prisma;
