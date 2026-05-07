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
              text: `You are a nutrition expert specialising in Indian cuisine, with deep knowledge of West Indian food (Maharashtrian, Gujarati, Goan, Rajasthani) and South Indian food (Tamil, Kannada, Telugu, Kerala). You are also familiar with common North Indian and street food dishes found across India.

Analyze this food image carefully. Identify every food item visible on the plate or in the image.

For each item:
- Use the specific regional Indian name where possible (e.g. "Vada Pav" not just "bread roll", "Masala Dosa" not just "crepe", "Poha" not just "flattened rice", "Modak" not just "dumpling")
- Estimate the portion size by looking at visual cues in the image such as the size of the plate or bowl, how much of it is filled, the number of pieces, thickness, and comparison to other items
- Provide a short 1-sentence explanation of HOW you estimated the quantity from the image
- Estimate calories using Indian cooking methods (e.g. deep fried, tadka with oil, ghee used, coconut-based gravies)
- Use realistic calorie values for home-cooked Indian food, not Western food databases

Return your response as valid JSON only, with no extra text, in this exact format:
{
  "foods": [
    {
      "name": "Specific Indian food name",
      "emoji": "relevant emoji",
      "portion": "e.g. 2 medium vadas, 1 standard katori, 3 rotis",
      "quantity_reasoning": "One short sentence explaining what visual clues you used to estimate this quantity",
      "calories": 250,
      "confidence": 0.92
    }
  ],
  "notes": "One sentence about the overall meal — mention the regional cuisine if identifiable"
}

Confidence is 0.0-1.0 based on how clearly you can identify the dish. Return only the JSON, no other text.`
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
