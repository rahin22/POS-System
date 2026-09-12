/**
 * Customer receipt / order ticket markup.
 *
 * Rendered in a hidden BrowserWindow and printed silently through the Windows
 * driver for the kiosk's integrated thermal printer, so layout is plain HTML
 * rather than ESC/POS. Width is driven by the printer's configured paper size;
 * `paperWidthMm` only controls how wide we lay the content out.
 */

export interface ReceiptItem {
  name: string;
  quantity: number;
  totalPrice: number;
  modifiers?: Array<{ name: string; price: number }>;
  notes?: string;
}

export interface ReceiptData {
  orderNumber: number;
  orderType: 'dine-in' | 'takeaway';
  createdAt: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  discount?: number;
  total: number;
  currencySymbol: string;
  vatRate: number;
  shopName: string;
  address?: string;
  phone?: string;
  vatNumber?: string;
  receiptFooter?: string;
  paperWidthMm?: number;
  /** Terminal receipt text returned by SmartConnect, printed verbatim when present */
  eftposReceipt?: string;
  eftposAuthId?: string;
  eftposCardPan?: string;
  eftposCardType?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(amount: number, symbol: string): string {
  return `${symbol}${amount.toFixed(2)}`;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildReceiptHtml(data: ReceiptData): string {
  const width = data.paperWidthMm ?? 72;
  const symbol = data.currencySymbol || '$';
  const typeLabel = data.orderType === 'dine-in' ? 'EAT IN' : 'TAKE AWAY';

  const itemRows = data.items
    .map((item) => {
      const modifiers = (item.modifiers || [])
        .map(
          (mod) =>
            `<div class="mod">+ ${escapeHtml(mod.name)}${
              mod.price > 0 ? ` <span class="mod-price">${money(mod.price, symbol)}</span>` : ''
            }</div>`
        )
        .join('');

      const note = item.notes ? `<div class="note">${escapeHtml(item.notes)}</div>` : '';

      return `
        <div class="item">
          <div class="item-line">
            <span class="qty">${item.quantity}x</span>
            <span class="name">${escapeHtml(item.name)}</span>
            <span class="price">${money(item.totalPrice, symbol)}</span>
          </div>
          ${modifiers}
          ${note}
        </div>`;
    })
    .join('');

  // Raw values here; escaped once where they are joined into the markup below
  const paymentLines: string[] = [];
  if (data.eftposCardType || data.eftposCardPan) {
    paymentLines.push(`CARD ${data.eftposCardType || ''} ${data.eftposCardPan || ''}`.trim());
  } else {
    paymentLines.push('PAID BY CARD');
  }
  if (data.eftposAuthId) paymentLines.push(`Auth: ${data.eftposAuthId}`);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 4mm 2mm 6mm;
    width: ${width}mm;
    font-family: "Segoe UI", Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.35;
    color: #000;
    -webkit-print-color-adjust: exact;
  }
  .center { text-align: center; }
  .shop { font-size: 13pt; font-weight: 700; text-transform: uppercase; }
  .muted { font-size: 9.5pt; }
  .ticket {
    margin: 3mm 0 2mm;
    padding: 2mm 0;
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
    text-align: center;
  }
  .ticket-label { font-size: 10pt; letter-spacing: 2px; font-weight: 700; }
  .ticket-number { font-size: 46pt; font-weight: 800; line-height: 1; margin: 1mm 0; }
  .ticket-type { font-size: 14pt; font-weight: 700; letter-spacing: 1px; }
  .rule { border-top: 1px dashed #000; margin: 2mm 0; }
  .item { margin-bottom: 2mm; }
  .item-line { display: flex; align-items: baseline; gap: 2mm; font-weight: 600; }
  .item-line .name { flex: 1; }
  .item-line .price { white-space: nowrap; }
  .mod { padding-left: 7mm; font-size: 9.5pt; }
  .mod-price { float: right; }
  .note { padding-left: 7mm; font-size: 9.5pt; font-style: italic; }
  .totals div { display: flex; justify-content: space-between; }
  .grand { font-size: 15pt; font-weight: 800; margin-top: 1mm; }
  .eftpos { white-space: pre-wrap; font-family: "Consolas", monospace; font-size: 8.5pt; margin-top: 2mm; }
  .footer { margin-top: 3mm; font-size: 9.5pt; }
</style>
</head>
<body>
  <div class="center">
    <div class="shop">${escapeHtml(data.shopName || 'Al Taher Kebabs')}</div>
    ${data.address ? `<div class="muted">${escapeHtml(data.address)}</div>` : ''}
    ${data.phone ? `<div class="muted">Tel: ${escapeHtml(data.phone)}</div>` : ''}
  </div>

  <div class="ticket">
    <div class="ticket-label">ORDER NUMBER</div>
    <div class="ticket-number">${data.orderNumber}</div>
    <div class="ticket-type">${typeLabel}</div>
  </div>

  <div class="center muted">${formatDateTime(data.createdAt)}</div>

  <div class="rule"></div>

  ${itemRows}

  <div class="rule"></div>

  <div class="totals">
    ${
      data.discount && data.discount > 0
        ? `<div><span>Discount</span><span>-${money(data.discount, symbol)}</span></div>`
        : ''
    }
    <div class="grand"><span>TOTAL</span><span>${money(data.total, symbol)}</span></div>
    <div><span>Includes GST (${data.vatRate}%)</span><span>${money(data.tax, symbol)}</span></div>
  </div>

  <div class="rule"></div>

  <div class="center muted">${paymentLines.map(escapeHtml).join('<br/>')}</div>
  ${data.vatNumber ? `<div class="center muted">ABN/VAT: ${escapeHtml(data.vatNumber)}</div>` : ''}

  ${data.eftposReceipt ? `<div class="eftpos">${escapeHtml(data.eftposReceipt)}</div>` : ''}

  <div class="center footer">
    ${escapeHtml(data.receiptFooter || 'Thank you for your order!')}<br/>
    <strong>Please keep this ticket &mdash; your number will be called.</strong>
  </div>
</body>
</html>`;
}
