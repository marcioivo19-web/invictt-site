const { json, readJson } = require('./_store');

function cents(value) {
  return Math.round(Number(value) * 100);
}

module.exports = async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  if (!process.env.INFINITEPAY_API_KEY && !process.env.INFINITEPAY_HANDLE) {
    return json({ error: 'Pagamento ainda não configurado: falta INFINITEPAY_API_KEY ou INFINITEPAY_HANDLE na Vercel.' }, 503);
  }

  try {
    const b = await req.json();
    const items = Array.isArray(b.items) ? b.items : [];
    if (!items.length) return json({ error: 'Carrinho vazio.' }, 400);
    if (!b.orderId) return json({ error: 'Pedido não informado.' }, 400);

    // Revalida o pedido criado pelo servidor antes de gerar a cobrança.
    const orders = await readJson('invictt/orders.json', []);
    const order = orders.find(x => x.id === b.orderId);
    if (!order) return json({ error: 'Pedido não encontrado.' }, 404);
    if (order.status !== 'aguardando_pagamento') return json({ error: 'Este pedido não pode ser pago.' }, 409);

    const apiItems = items.map(p => ({
      description: String(p.name || 'Produto INVICTT').slice(0, 120),
      quantity: Math.max(1, Number(p.quantity || 1)),
      price: cents(p.price)
    }));

    if (apiItems.some(p => !Number.isFinite(p.price) || p.price < 100)) {
      return json({ error: 'Existe um item com valor inválido. O mínimo é R$ 1,00.' }, 400);
    }

    const origin = String(b.origin || '').replace(/\/$/, '');
    if (!origin) return json({ error: 'Origem do site não informada.' }, 400);

    const payload = {
      items: apiItems,
      order_nsu: String(order.id),
      redirect_url: `${origin}/?payment=success&order_nsu=${encodeURIComponent(order.id)}`,
      webhook_url: `${origin}/api/payment-webhook`,
      customer: {
        name: String(b.customer?.name || order.userName || '').slice(0, 120),
        email: String(b.customer?.email || '').slice(0, 160),
        phone_number: String(b.customer?.phone || '').slice(0, 30)
      }
    };

    if (process.env.INFINITEPAY_HANDLE) payload.handle = process.env.INFINITEPAY_HANDLE;

    if (process.env.INFINITEPAY_API_KEY) {
      payload.options = {
        single_payment: true,
        payment_methods_enabled: ['credit_card', 'pix'],
        ...(process.env.INFINITEPAY_PIX_DISCOUNT
          ? { discounts: { pix: Number(process.env.INFINITEPAY_PIX_DISCOUNT) } }
          : {}),
        ...(process.env.INFINITEPAY_ASSURED_INSTALLMENTS
          ? { assured_installments: Number(process.env.INFINITEPAY_ASSURED_INSTALLMENTS) }
          : {})
      };
    }

    const headers = { 'Content-Type': 'application/json' };
    if (process.env.INFINITEPAY_API_KEY) headers['X-Api-Key'] = process.env.INFINITEPAY_API_KEY;

    const r = await fetch('https://api.checkout.infinitepay.io/links', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const j = await r.json();

    if (!r.ok) {
      return json({ error: j.message || j.error || 'Falha ao criar checkout na InfinitePay.' }, 502);
    }

    const checkoutUrl = j.url || j.checkout_url || j.init_point;
    if (!checkoutUrl) return json({ error: 'A InfinitePay não retornou a URL de checkout.' }, 502);

    order.payment = 'infinitepay';
    order.paymentCheckoutUrl = checkoutUrl;
    order.updatedAt = new Date().toISOString();
    await require('./_store').writeJson('invictt/orders.json', orders);

    return json({ checkoutUrl, orderId: order.id });
  } catch (e) {
    return json({ error: 'Falha ao iniciar o pagamento com a InfinitePay.' }, 500);
  }
};