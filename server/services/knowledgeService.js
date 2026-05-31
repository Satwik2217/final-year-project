// Factual knowledge service — Wikipedia + curated answers for accurate fallback replies.
const CURATED_ANSWERS = [
  {
    match: /three branches.*(indian|india)|branches of (indian|india).*government/i,
    answer:
      "So India has three branches of government — the Legislature (Parliament, made up of the Lok Sabha and Rajya Sabha), the Executive (the President, Prime Minister, and Council of Ministers), and the Judiciary (the Supreme Court and the lower courts). New Delhi is where they all operate from.",
  },
  {
    match: /three branches.*(us|usa|american|united states)/i,
    answer:
      "The U.S. has three branches — Legislative (Congress: Senate + House), Executive (President and administration), and Judicial (Supreme Court and federal courts). It's the classic separation-of-powers setup from the Constitution.",
  },
  {
    match: /capital of india/i,
    answer: "New Delhi — that's where India's central government sits.",
  },
  {
    match: /capital of (usa|america|united states)/i,
    answer: "Washington, D.C. — been the U.S. capital since 1800.",
  },
  {
    match: /capital of france/i,
    answer: "Paris — hard to picture France without it.",
  },
  {
    match: /photosynthesis/i,
    answer:
      "Plants use sunlight, water, and CO₂ to make glucose and oxygen — basically tiny solar-powered food factories. That's photosynthesis.",
  },
  {
    match: /what is (python|javascript|java)\??/i,
    answer: null, // let wikipedia handle
  },
];

function isFactualQuestion(text) {
  const t = text.trim();
  return (
    /\b(what is|what are|what's|who is|who was|who are|where is|where are|when did|when was|how does|how do|how many|why is|why do|why are|explain|define|tell me about|describe|list the|name the|capital of|meaning of)\b/i.test(t) ||
    (t.endsWith('?') && t.split(/\s+/).length >= 3)
  );
}

function curatedAnswer(query) {
  for (const entry of CURATED_ANSWERS) {
    if (entry.match.test(query) && entry.answer) return entry.answer;
  }
  return null;
}

function buildWikiTitle(query) {
  const cleaned = query
    .replace(/\?+$/, '')
    .replace(/\b(what is|what are|what's|who is|tell me about|explain|define)\b/gi, '')
    .trim();

  if (!cleaned) return query.replace(/\?+$/, '').trim();

  return cleaned
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('_');
}

async function fetchWikipediaAnswer(query) {
  try {
    const opensearchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&namespace=0&format=json`;
    const searchRes = await fetch(opensearchUrl, {
      headers: { 'User-Agent': 'NeuroWell/1.0 (mental wellness app)' },
      signal: AbortSignal.timeout(8000),
    });

    if (!searchRes.ok) return null;

    const [, titles] = await searchRes.json();
    const title = titles?.[0];
    if (!title) return null;

    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
    const summaryRes = await fetch(summaryUrl, {
      headers: { 'User-Agent': 'NeuroWell/1.0 (mental wellness app)' },
      signal: AbortSignal.timeout(8000),
    });

    if (!summaryRes.ok) return null;

    const data = await summaryRes.json();
    if (!data.extract) return null;

    const sentences = data.extract.split(/(?<=[.!?])\s+/).slice(0, 3).join(' ');
    return `Right, so — ${sentences}`;
  } catch {
    return null;
  }
}

async function lookupFactualAnswer(query) {
  const curated = curatedAnswer(query);
  if (curated) return curated;

  const wiki = await fetchWikipediaAnswer(query);
  if (wiki) return wiki;

  const titleGuess = buildWikiTitle(query);
  if (titleGuess && titleGuess !== query) {
    const wiki2 = await fetchWikipediaAnswer(titleGuess);
    if (wiki2) return wiki2;
  }

  return null;
}

module.exports = { lookupFactualAnswer, isFactualQuestion, curatedAnswer };
