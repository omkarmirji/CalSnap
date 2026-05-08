// api/judge.js — verification only, runs after /api/analyze returns to the browser.
// Uses gpt-4o-mini for speed. Retry is triggered by frontend only on misidentification.

const JUDGE_PROMPT = `You are a strict nutrition verification expert and food image analyst specialising in Indian cuisine.

You will be shown:
1. The original food image
2. An AI analyzer's response identifying food items and estimating calories

Re-examine the image yourself and critically verify the analyzer's response.

Score on four criteria (0-100 each):
1. food_identification: Are all visible food items correctly identified with proper Indian regional names? Were any missed, merged, or wrongly labelled?
2. calorie_accuracy: Are calorie estimates realistic for Indian cooking methods (deep frying, ghee, coconut milk, tadka)? Use ICMR/NIN data as reference.
3. portion_accuracy: Are portion estimates reasonable given visual cues — plate size, fill level, number of pieces, thickness?
4. item_distinction: Were multiple items properly separated? Score 100 if only one item is present.

overall_accuracy = (food_identification × 0.35) + (calorie_accuracy × 0.35) + (portion_accuracy × 0.20) + (item_distinction × 0.10). Round to nearest integer.

IMPORTANT — retry_recommended: set to true ONLY if a food item is completely wrong (identified as an entirely different dish). Do NOT set true for calorie or portion estimate differences — those are best-effort visual estimates.

Return valid JSON only, no other text:
{
  "scores": {
    "food_identification": 85,
    "calorie_accuracy": 72,
    "portion_accuracy": 68,
    "item_distinction": 90
  },
  "overall_accuracy": 79,
  "item_verdicts": [
    {
      "name": "exact food name from analyzer",
      "identification_correct": true,
      "calorie_verdict": "accurate",
      "notes": "Brief note — only if there is a correction or concern, otherwise omit this field"
    }
  ],
  "feedback_for_analyzer": "Specific corrections for misidentified items only. Omit if all items are correctly identified.",
  "retry_recommended": false,
  "summary": "One sentence overall assessment of the analysis quality"
}`;

function parseJSON(raw) {
  return JSON.parse(raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```$/i,'').trim());
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { imageBase64, imageType, analyzerResult } = req.body;

  if (!imageBase64 || !imageType || !analyzerResult) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (Buffer.byteLength(imageBase64, 'base64') > 10 * 1024 * 1024) {
    return res.status(413).json({ error: 'Image too large.' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server is missing OPENAI_API_KEY.' });

  try {
    const prompt = `${JUDGE_PROMPT}\n\nANALYZER RESPONSE TO VERIFY:\n${JSON.stringify(analyzerResult, null, 2)}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1200,
        temperature: 0,
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:${imageType};base64,${imageBase64}`, detail: 'high' } },
          { type: 'text', text: prompt }
        ]}]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    const judgment = parseJSON(data.choices[0].message.content.trim());
    return res.status(200).json(judgment);
  } catch (err) {
    console.error('Judge error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
