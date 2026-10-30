import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

import { getJson } from 'serpapi';

const DEFAULT_SERPAPI_KEY =
  process.env.SERPAPI_API_KEY ||
  '7e3c79f50afc6d3e7609694b0ae1c75c903024731229a372edaf2c2d50d11edb';

// Google Maps Scraper & Live ATM Search endpoint using SerpApi
app.get('/api/scrape-google-maps', async (req, res) => {
  try {
    const lat = req.query.lat || '-26.2041';
    const lng = req.query.lng || '28.0473';
    const zoom = req.query.zoom || '14';
    const query = req.query.q || 'South Africa ATM';
    const apiKey = (req.query.api_key as string) || DEFAULT_SERPAPI_KEY;

    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', 'google_maps');
    url.searchParams.set('q', String(query));
    url.searchParams.set('ll', `@${lat},${lng},${zoom}z`);
    url.searchParams.set('api_key', apiKey);

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'atm-thunywa-scraper/1.0' },
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errJson.error || `SerpApi responded with HTTP ${response.status}`,
      });
    }

    const data: any = await response.json();
    const localResults = data.local_results || [];

    // Parse and structure the scraped results
    const parsedPlaces = localResults.map((r: any, idx: number) => {
      const hasWheelchair = Boolean(
        r.extensions?.some((ext: any) =>
          ext.accessibility?.some((acc: string) =>
            acc.toLowerCase().includes('wheelchair')
          )
        )
      );

      return {
        id: r.place_id || `scraped-${idx}-${Date.now()}`,
        place_id: r.place_id,
        title: r.title,
        address: r.address,
        country: r.country,
        gps_coordinates: r.gps_coordinates,
        phone: r.phone,
        website: r.website,
        rating: r.rating,
        reviews: r.reviews,
        open_state: r.open_state,
        hours: r.hours,
        operating_hours: r.operating_hours,
        thumbnail: r.thumbnail || r.serpapi_thumbnail,
        type: r.type,
        wheelchair_accessible: hasWheelchair,
        data_id: r.data_id,
      };
    });

    res.json({
      success: true,
      query: String(query),
      total_scraped: parsedPlaces.length,
      places: parsedPlaces,
      search_metadata: data.search_metadata,
      raw_results: localResults,
    });
  } catch (error: any) {
    console.error('SerpApi scraping error:', error);
    res.status(500).json({ error: error.message || 'Failed to scrape Google Maps' });
  }
});

// Legacy / shortcut endpoint alias
app.get('/api/live-atms', async (req, res) => {
  try {
    const lat = req.query.lat || '-26.2041';
    const lng = req.query.lng || '28.0473';
    const zoom = req.query.zoom || '14';
    const query = req.query.q || 'South Africa ATM';
    const apiKey = (req.query.api_key as string) || DEFAULT_SERPAPI_KEY;

    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', 'google_maps');
    url.searchParams.set('q', String(query));
    url.searchParams.set('ll', `@${lat},${lng},${zoom}z`);
    url.searchParams.set('api_key', apiKey);

    const response = await fetch(url.toString());
    const data: any = await response.json();
    if (data.error) {
      return res.status(400).json({ error: data.error });
    }
    res.json({
      local_results: data.local_results || [],
      search_metadata: data.search_metadata,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to query live ATMs' });
  }
});

// API endpoint for Gemini ATM Safety & Advisory Assistant
app.post('/api/atm-advice', async (req, res) => {
  try {
    const { prompt, context } = req.body;
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt || 'Give ATM safety advice in South Africa',
      config: {
        systemInstruction: `You are ATM Thunywa AI Security & Assistant, an expert on South African banking, ATM safety, crime prevention (such as card skimming, shoulder surfing, muggings, distraction theft), and navigation. The user's current context is: ${JSON.stringify(context || {})}. Provide clear, actionable, concise, and helpful advice.`,
      },
    });
    res.json({ text: response.text });
  } catch (error: any) {
    console.error('Gemini API error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate AI response' });
  }
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();
