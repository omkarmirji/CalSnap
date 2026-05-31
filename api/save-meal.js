// api/save-meal.js — persist one analysis result to Supabase

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY;

function supa(path, method, body) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase env vars not set' });
  }

  const { foods, notes } = req.body || {};
  if (!Array.isArray(foods) || foods.length === 0) {
    return res.status(400).json({ error: 'foods array required' });
  }

  const totalCalories = foods.reduce((s, f) => s + (f.calories  || 0), 0);
  const totalCarbs    = foods.reduce((s, f) => s + (f.carbs_g   || 0), 0);
  const totalProtein  = foods.reduce((s, f) => s + (f.protein_g || 0), 0);
  const totalFat      = foods.reduce((s, f) => s + (f.fat_g     || 0), 0);

  // insert meal row
  const mealRes = await supa('meals', 'POST', {
    total_calories:  totalCalories,
    total_carbs_g:   +totalCarbs.toFixed(1),
    total_protein_g: +totalProtein.toFixed(1),
    total_fat_g:     +totalFat.toFixed(1),
    notes:           notes || null,
    food_count:      foods.length,
  });

  if (!mealRes.ok) {
    const err = await mealRes.text();
    return res.status(500).json({ error: 'Failed to save meal', detail: err });
  }

  const [meal] = await mealRes.json();

  // insert food rows
  const foodRows = foods.map(f => ({
    meal_id:            meal.id,
    name:               f.name,
    emoji:              f.emoji              || null,
    portion:            f.portion            || null,
    quantity_reasoning: f.quantity_reasoning || null,
    calories:           f.calories           || null,
    carbs_g:            f.carbs_g            != null ? +Number(f.carbs_g).toFixed(1)   : null,
    protein_g:          f.protein_g          != null ? +Number(f.protein_g).toFixed(1) : null,
    fat_g:              f.fat_g              != null ? +Number(f.fat_g).toFixed(1)     : null,
    glycemic_index:     f.glycemic_index     || null,
    confidence:         f.confidence         != null ? +Number(f.confidence).toFixed(2): null,
  }));

  const foodsRes = await supa('meal_foods', 'POST', foodRows);
  if (!foodsRes.ok) {
    const err = await foodsRes.text();
    return res.status(500).json({ error: 'Meal saved but foods failed', detail: err });
  }

  return res.status(200).json({ id: meal.id, saved: foods.length });
}
