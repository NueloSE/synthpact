import { NextResponse } from "next/server";
import { getAllDeals } from "@/lib/contract";

export const revalidate = 0;

export async function GET() {
  try {
    const deals = await getAllDeals();
    return NextResponse.json(deals, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch deals" }, { status: 500 });
  }
}
