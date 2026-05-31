// api/meals.js — fetch all meals with their food items

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')  return res.status(405).json({ error: 'Method not allowed' });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase env vars not set' });
  }

  // fetch meals newest-first, embedding their food items
  const url = `${SUPABASE_URL}/rest/v1/meals?select=*,meal_foods(*)&order=created_at.desc`;
  const r = await fetch(url, {
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!r.ok) {
    const err = await r.text();
    return res.status(500).json({ error: 'Failed to fetch meals', detail: err });
  }

  const meals = await r.json();
  return res.status(200).json(meals);
}
