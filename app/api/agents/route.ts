// GET /api/agents - Returns list of available agents
import { NextResponse } from "next/server";
import { AGENTS } from "@/lib/agents";

export async function GET() {
  return NextResponse.json(AGENTS);
}




