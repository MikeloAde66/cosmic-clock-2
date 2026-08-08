const VOYAGE_MODEL = 'voyage-3'; // 1024-dimensional output — must match the Atlas vector index's numDimensions

interface VoyageEmbeddingResponse {
  data: { embedding: number[]; index: number }[];
}

export async function embedTexts(texts: string[], inputType: 'document' | 'query'): Promise<number[][]> {
  if (!process.env.VOYAGE_API_KEY) {
    throw new Error('VOYAGE_API_KEY is not configured.');
  }
  if (texts.length === 0) return [];

  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: texts,
      model: VOYAGE_MODEL,
      input_type: inputType,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Voyage embeddings request failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as VoyageEmbeddingResponse;
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export async function embedOne(text: string, inputType: 'document' | 'query'): Promise<number[]> {
  const [embedding] = await embedTexts([text], inputType);
  return embedding;
}
