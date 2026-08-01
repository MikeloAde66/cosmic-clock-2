import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Calls your Python FastAPI backend directly
    const res = await fetch("http://localhost:8000/categories", {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`FastAPI responded with status: ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching from FastAPI backend:", error);
    return NextResponse.json(
      { error: "Failed to connect to Python backend" },
      { status: 500 }
    );
  }
}