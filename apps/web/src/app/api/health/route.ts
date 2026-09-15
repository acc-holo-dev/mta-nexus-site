import { NextResponse } from "next/server";
import { store } from "../../../lib/services/store";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    version: "1.0.0",
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    entitiesCount: {
      users: store.users.size,
      servers: store.servers.size,
      products: store.products.size,
      licenses: store.licenses.size,
      orders: store.orders.size,
      content: store.content.size,
    },
  });
}
