// api/analyze.js
// Vercel serverless function — runs on a server, never in the browser.
// Your OPENAI_API_KEY environment variable stays here, safe and hidden.

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers — allows your frontend to call this endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { imageBase64, imageType } = req.body;

  if (!imageBase64 || !imageType) {
    return res.status(400).json({ error: 'Missing imageBase64 or imageType' });
  }

  // API key lives in Vercel environment variable — never exposed to browser
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing OPENAI_API_KEY. Please set it in Vercel.' });
  }

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${imageType};base64,${imageBase64}`,
                detail: 'high'
              }
            },
            {
              type: 'text',
              text: `Analyze this food image and identify all food items visible. For each item, estimate the portion size and calories.

Return your response as valid JSON only, with no extra text, in this exact format:
{
  "foods": [
    {
      "name": "Food name",
      "emoji": "relevant emoji",
      "portion": "e.g. 1 cup, 150g, 2 slices",
      "calories": 250,
      "confidence": 0.92
    }
  ],
  "notes": "Any brief note about the meal (1 sentence max)"
}

Be realistic with calorie estimates. Use USDA data as reference. Confidence is 0.0-1.0.`
            }
          ]
        }]
      })
    });

    if (!openaiRes.ok) {
      const err = await openaiRes.json();
      return res.status(openaiRes.status).json({ error: err.error?.message || 'OpenAI error' });
    }

    const data = await openaiRes.json();
    const raw = data.choices[0].message.content.trim();

    // Strip markdown fences if GPT wraps the JSON
    const jsonStr = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(jsonStr);
    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Analysis error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
