# INVICTT 2.0 — Loja com InfinitePay

Arquitetura:
- Loja INVICTT
- Cadastro e login
- Carrinho e pedidos
- Checkout Integrado InfinitePay
- Pix e cartão
- Webhook + payment_check para confirmação
- Promoções por e-mail/WhatsApp
- Vercel Blob
- Cron para campanhas

## Variáveis da Vercel

Obrigatórias para pagamento:
- `INFINITEPAY_API_KEY` — API Key criada no Checkout Integrado da InfinitePay.
- `INFINITEPAY_HANDLE` — sua InfiniteTag sem `$`.

Opcionais:
- `INFINITEPAY_PIX_DISCOUNT` — desconto Pix em percentual, por exemplo `5`.
- `INFINITEPAY_ASSURED_INSTALLMENTS` — número de parcelas cujas taxas a loja assume, de `0` a `12`.

A API Key deve ficar somente no servidor, como variável de ambiente.

## Ativação no InfinitePay

No App/Conta Web: Vendas → Checkout → Configurações → Habilitar Checkout Integrado → criar API Key.

Depois, configurar as variáveis na Vercel e publicar.

## Fluxo de pagamento

1. Cliente entra na conta.
2. Adiciona produtos ao carrinho.
3. INVICTT cria o pedido.
4. `/api/checkout` cria o link da InfinitePay.
5. Cliente é levado ao Checkout InfinitePay.
6. InfinitePay chama `/api/payment-webhook`.
7. O servidor confirma o evento usando `/payment_check`.
8. Pedido passa para `pago`.

Observação: a InfinitePay não oferece checkout transparente/iframe; o cliente é redirecionado para a página segura da InfinitePay e depois pode voltar à INVICTT.