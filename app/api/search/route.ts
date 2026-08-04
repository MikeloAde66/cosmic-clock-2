import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ results: [] }, { status: 400 });
  }

  try {
    // Standalone response for verification
    return NextResponse.json({
      query,
      results: [
        {
          id: 1,
          title: `Retrieved data for: ${query}`,
          snippet: `Successfully queried backend for "${query}".`,
        },
      ],
    });
  } catch {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}