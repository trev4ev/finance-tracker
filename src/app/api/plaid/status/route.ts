import { NextResponse } from "next/server";
import { isPlaidConfigured } from "@/lib/plaid/client";

export async function GET() {
  return NextResponse.json({
    configured: isPlaidConfigured(),
    env: process.env.PLAID_ENV ?? "sandbox",
  });
}
