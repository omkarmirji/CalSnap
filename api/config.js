// api/config.js — exposes public (non-secret) config to the frontend
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  });
}
