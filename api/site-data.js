import { put, list } from '@vercel/blob';

const PATH = 'invictt/site-data.json';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const result = await list({ prefix: PATH, limit: 1 });
      if (!result.blobs?.length) return res.status(200).json({});
      const r = await fetch(result.blobs[0].url, { cache: 'no-store' });
      if (!r.ok) return res.status(502).json({ error: 'Não foi possível ler os dados publicados.' });
      return res.status(200).json(await r.json());
    }

    if (req.method === 'POST') {
      const expected = process.env.ADMIN_KEY;
      const received = req.headers['x-invictt-admin-key'];
      if (!expected || received !== expected) {
        return res.status(401).json({ error: 'Chave de publicação inválida.' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'Dados inválidos.' });
      }
      body.stamp = Date.now();
      await put(PATH, JSON.stringify(body), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
      });
      return res.status(200).json({ ok: true, stamp: body.stamp });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro interno ao acessar a publicação.' });
  }
}