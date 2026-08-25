import { NextResponse } from "next/server";

// Real Open Trivia DB question fetcher — https://opentdb.com/api_config.php
// for the full parameter reference. No Python backend, no localhost
// dependency: this is a public, unauthenticated API reachable directly
// from Vercel's serverless functions.
const OPENTDB_URL = "https://opentdb.com/api.php";

// OpenTDB's documented response_code meanings — surfaced as real error
// messages instead of silently passing malformed data through.
const RESPONSE_CODE_MESSAGES: Record<number, string> = {
  1: "No results — not enough questions for that category/difficulty/type combination.",
  2: "Invalid parameter — check amount/category/difficulty/type values.",
  3: "Session token not found.",
  4: "Session token has returned all possible questions; reset the token.",
  5: "Rate limited by Open Trivia DB — it allows one request per IP every 5 seconds.",
};

interface OpenTdbQuestion {
  category: string;
  type: "multiple" | "boolean";
  difficulty: "easy" | "medium" | "hard";
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

interface OpenTdbResponse {
  response_code: number;
  results: OpenTdbQuestion[];
}

// OpenTDB returns HTML-encoded entities (&quot;, &#039;, etc.) by default.
// Decoding server-side means every consumer gets clean text without each
// one needing to know about this.
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&eacute;/g, "é")
    .replace(/&uuml;/g, "ü")
    .replace(/&ouml;/g, "ö")
    .replace(/&auml;/g, "ä")
    .replace(/&rsquo;/g, "’")
    .replace(/&hellip;/g, "…");
}

function decodeQuestion(q: OpenTdbQuestion): OpenTdbQuestion {
  return {
    ...q,
    category: decodeHtmlEntities(q.category),
    question: decodeHtmlEntities(q.question),
    correct_answer: decodeHtmlEntities(q.correct_answer),
    incorrect_answers: q.incorrect_answers.map(decodeHtmlEntities),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Pass-through params, all optional — OpenTDB itself validates these
  // and reports back via response_code if something's off.
  const amount = searchParams.get("amount") ?? "10";
  const category = searchParams.get("category");
  const difficulty = searchParams.get("difficulty");
  const type = searchParams.get("type");

  const upstreamUrl = new URL(OPENTDB_URL);
  upstreamUrl.searchParams.set("amount", amount);
  if (category) upstreamUrl.searchParams.set("category", category);
  if (difficulty) upstreamUrl.searchParams.set("difficulty", difficulty);
  if (type) upstreamUrl.searchParams.set("type", type);

  try {
    const res = await fetch(upstreamUrl.toString(), {
      // OpenTDB questions are randomized server-side per request anyway;
      // no reason to let a CDN/browser cache a stale question set.
      cache: "no-store",
    });

    if (!res.ok) {
      // OpenTDB itself rate-limits at the HTTP level (one request per IP
      // every 5 seconds) — pass that specific status through as-is rather
      // than masking it as a generic upstream failure.
      const status = res.status === 429 ? 429 : 502;
      const message =
        res.status === 429
          ? "Rate limited by Open Trivia DB — it allows one request per IP every 5 seconds."
          : `Open Trivia DB responded with HTTP ${res.status}`;
      return NextResponse.json({ error: message }, { status });
    }

    const data = (await res.json()) as OpenTdbResponse;

    if (data.response_code !== 0) {
      return NextResponse.json(
        {
          error:
            RESPONSE_CODE_MESSAGES[data.response_code] ??
            `Open Trivia DB returned response_code ${data.response_code}`,
          response_code: data.response_code,
        },
        { status: data.response_code === 5 ? 429 : 400 }
      );
    }

    return NextResponse.json({
      response_code: data.response_code,
      results: data.results.map(decodeQuestion),
    });
  } catch (error) {
    console.error("Error fetching from Open Trivia DB:", error);
    return NextResponse.json(
      { error: "Failed to reach Open Trivia DB" },
      { status: 502 }
    );
  }
}
