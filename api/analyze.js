// api/analyze.js — Vercel serverless function with LLM-as-Judge pipeline

const ANALYZER_PROMPT = `You are a nutrition expert specialising in Indian cuisine, with deep knowledge of West Indian food (Maharashtrian, Gujarati, Goan, Rajasthani) and South Indian food (Tamil, Kannada, Telugu, Kerala). You are also familiar with common North Indian and street food dishes found across India.

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

Confidence is 0.0-1.0 based on how clearly you can identify the dish. Return only the JSON, no other text.`;

const JUDGE_PROMPT = `You are a strict nutrition verification expert and food image analyst specialising in Indian cuisine.

You will be shown:
1. The original food image
2. An AI analyzer's response identifying food items and estimating calories

Your task is to CRITICALLY VERIFY the analyzer's response by re-examining the image yourself.

Score the response on four criteria (0-100 each):

1. food_identification: Are all visible food items correctly identified with proper Indian regional names? Were any items missed, merged, or wrongly labelled?
2. calorie_accuracy: Are calorie estimates realistic for Indian cooking methods (deep frying, ghee, coconut milk, tadka)? Use ICMR/NIN nutrition data as reference.
3. portion_accuracy: Are portion estimates reasonable based on visual cues — plate size, fill level, number of pieces, thickness?
4. item_distinction: Were multiple food items properly separated from each other? Score 100 if only one item is present.

overall_accuracy = (food_identification × 0.35) + (calorie_accuracy × 0.35) + (portion_accuracy × 0.20) + (item_distinction × 0.10). Round to nearest integer.

Set retry_recommended to true only if overall_accuracy < 70 OR a food item is clearly misidentified.

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
  "feedback_for_analyzer": "Specific actionable corrections. Be concise and direct.",
  "retry_recommended": false,
  "summary": "One sentence overall assessment of the analysis quality"
}`;

async function callOpenAI(apiKey, messages, maxTokens = 1024) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model: 'gpt-4o', max_tokens: maxTokens, messages })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'OpenAI API error');
  }

  const data = await response.json();
  const raw = data.choices[0].message.content.trim();
  return parseJSON(raw);
}

function parseJSON(raw) {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

function imageContent(imageBase64, imageType) {
  return { type: 'image_url', image_url: { url: `data:${imageType};base64,${imageBase64}`, detail: 'high' } };
}

async function checkIsFood(apiKey, imageBase64, imageType) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 5,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${imageType};base64,${imageBase64}`, detail: 'low' } },
          { type: 'text', text: 'Does this image contain any food or drink? Answer only: yes or no' }
        ]
      }]
    })
  });
  if (!response.ok) return true; // if pre-check fails, let the main pipeline handle it
  const data = await response.json();
  return data.choices[0].message.content.trim().toLowerCase().startsWith('yes');
}

async function runAnalyzer(apiKey, imageBase64, imageType, feedback = null) {
  const prompt = feedback
    ? `${ANALYZER_PROMPT}\n\nCORRECTION FROM AI JUDGE — address these issues in your revised analysis:\n${feedback}`
    : ANALYZER_PROMPT;

  return callOpenAI(apiKey, [{
    role: 'user',
    content: [imageContent(imageBase64, imageType), { type: 'text', text: prompt }]
  }]);
}

async function runJudge(apiKey, imageBase64, imageType, analyzerResult) {
  const prompt = `${JUDGE_PROMPT}\n\nANALYZER RESPONSE TO VERIFY:\n${JSON.stringify(analyzerResult, null, 2)}`;

  return callOpenAI(apiKey, [{
    role: 'user',
    content: [imageContent(imageBase64, imageType), { type: 'text', text: prompt }]
  }], 1200);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { imageBase64, imageType } = req.body;

  if (!imageBase64 || !imageType) {
    return res.status(400).json({ error: 'Missing imageBase64 or imageType' });
  }

  if (Buffer.byteLength(imageBase64, 'base64') > 10 * 1024 * 1024) {
    return res.status(413).json({ error: 'Image too large. Please upload an image under 10 MB.' });
  }

  if (!imageType.startsWith('image/')) {
    return res.status(400).json({ error: 'Invalid file type. Please upload an image.' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing OPENAI_API_KEY. Please set it in Vercel.' });
  }

  try {
    // Pre-check: cheap gpt-4o-mini call to confirm image contains food
    const hasFood = await checkIsFood(apiKey, imageBase64, imageType);
    if (!hasFood) {
      return res.status(200).json({ noFood: true });
    }

    // Pass 1: analyzer
    let analyzerResult = await runAnalyzer(apiKey, imageBase64, imageType);

    // Pass 1 judgment
    let judgment = await runJudge(apiKey, imageBase64, imageType, analyzerResult);

    let wasRefined = false;

    // Pass 2: retry once if judge recommends it
    if (judgment.retry_recommended) {
      const refined = await runAnalyzer(apiKey, imageBase64, imageType, judgment.feedback_for_analyzer);
      const refinedJudgment = await runJudge(apiKey, imageBase64, imageType, refined);
      if (refinedJudgment.overall_accuracy >= judgment.overall_accuracy) {
        analyzerResult = refined;
        judgment = refinedJudgment;
        wasRefined = true;
      }
    }

    return res.status(200).json({ ...analyzerResult, judgment, wasRefined });

  } catch (err) {
    // Log only the message — never log req.body which contains image data
    console.error('Analysis error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
