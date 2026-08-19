export interface WikiSummary {
  title: string;
  extract: string;
  url?: string;
}

export async function fetchWikiSummary(topic: string): Promise<WikiSummary | null> {
  try {
    const formattedTopic = encodeURIComponent(topic.trim().replace(/ /g, '_'));
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${formattedTopic}`);

    if (!res.ok) return null;

    const data = await res.json();
    return {
      title: data.title,
      extract: data.extract,
      url: data.content_urls?.desktop?.page,
    };
  } catch (err) {
    console.error('Wiki fetch error:', err);
    return null;
  }
}
