const { put, list } = require('@vercel/blob');

async function readJson(key, fallback){
  const r = await list({ prefix: key, limit: 10 });
  const item = r.blobs.find(x => x.pathname === key);
  if(!item) return fallback;
  const res = await fetch(item.url, { cache:'no-store' });
  if(!res.ok) return fallback;
  return await res.json();
}
async function writeJson(key, data){
  await put(key, JSON.stringify(data), { access:'public', addRandomSuffix:false, contentType:'application/json' });
  return data;
}
function json(data,status=200){ return new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}}); }
function secret(req){ return req.headers.get('x-invictt-admin-key') || ''; }
function requireAdmin(req){ return secret(req) && secret(req) === process.env.ADMIN_KEY; }
module.exports={readJson,writeJson,json,requireAdmin};