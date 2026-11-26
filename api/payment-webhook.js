const { readJson, writeJson } = require('./_store');

module.exports = async (req) => {
  if (req.method !== 'POST') return new Response('Método não permitido', { status: 405 });

  try {
    const body = await req.json();
    const orderId = String(body.order_nsu || '');
    const transactionNsu = String(body.transaction_nsu || '');
    const slug = String(body.invoice_slug || body.slug || '');

    if (!orderId || !transactionNsu || !slug) {
      return new Response('Webhook recebido', { status: 200 });
    }

    const orders = await readJson('invictt/orders.json', []);
    const order = orders.find(x => x.id === orderId);
    if (!order) return new Response('Pedido não encontrado', { status: 200 });

    if (!process.env.INFINITEPAY_API_KEY && !process.env.INFINITEPAY_HANDLE) {
      return new Response('Configuração ausente', { status: 500 });
    }

    const checkBody = {
      handle: process.env.INFINITEPAY_HANDLE,
      order_nsu: orderId,
      transaction_nsu: transactionNsu,
      slug
    };

    const headers = { 'Content-Type': 'application/json' };
    if (process.env.INFINITEPAY_API_KEY) headers['X-Api-Key'] = process.env.INFINITEPAY_API_KEY;

    const r = await fetch('https://api.checkout.infinitepay.io/payment_check', {
      method: 'POST',
      headers,
      body: JSON.stringify(checkBody)
    });
    const payment = await r.json();

    // A InfinitePay recomenda confirmar o pagamento pelo payment_check,
    // pois o webhook não possui assinatura.
    if (r.ok && payment.success === true && payment.paid === true) {
      order.status = 'pago';
      order.payment = 'infinitepay';
      order.paymentId = transactionNsu;
      order.invoiceSlug = slug;
      order.captureMethod = payment.capture_method || body.capture_method || null;
      order.paidAmount = payment.paid_amount ?? body.paid_amount ?? null;
      order.updatedAt = new Date().toISOString();
      await writeJson('invictt/orders.json', orders);
    } else if (body.event === 'refunded' || body.status === 'refunded') {
      order.status = 'estornado';
      order.updatedAt = new Date().toISOString();
      await writeJson('invictt/orders.json', orders);
    } else if (body.event === 'canceled' || body.status === 'canceled') {
      order.status = 'cancelado';
      order.updatedAt = new Date().toISOString();
      await writeJson('invictt/orders.json', orders);
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    return new Response('Erro ao processar webhook', { status: 400 });
  }
};