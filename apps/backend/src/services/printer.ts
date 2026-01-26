/**
 * ESC/POS Thermal Printer Service
 * 
 * This service handles receipt printing for the POS system.
 * It supports USB and network thermal printers using the ESC/POS protocol.
 */

// Note: escpos requires native USB drivers on the target machine
// On Ubuntu, you may need to install libusb: sudo apt-get install libusb-1.0-0-dev
// The imports are dynamic to handle cases where printer isn't connected

interface PrintResult {
  success: boolean;
  error?: string;
}

interface PrinterStatusResult {
  connected: boolean;
  name?: string;
  error?: string;
}

interface OrderForPrint {
  id: string;
  orderNumber: number;
  type: string;
  status: string;
  items: Array<{
    product: { name: string };
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes?: string | null;
    modifiers: Array<{ name: string; price: number }>;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  createdAt: Date;
  paymentMethod?: string | null;
}

interface SettingsForPrint {
  shopName: string;
  address: string;
  phone: string;
  vatNumber?: string | null;
  vatRate: number;
  currencySymbol: string;
  receiptFooter?: string | null;
}

// Format currency
function formatCurrency(amount: number, symbol: string = '£'): string {
  return `${symbol}${amount.toFixed(2)}`;
}

// Format date/time
function formatDateTime(date: Date): string {
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Order type label
function getOrderTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    dine_in: 'DINE IN',
    takeaway: 'TAKEAWAY',
    delivery: 'DELIVERY',
    online: 'ONLINE ORDER',
  };
  return labels[type] || type.toUpperCase();
}

/**
 * Print a customer receipt
 */
export async function printReceipt(
  order: OrderForPrint,
  settings: SettingsForPrint | null,
  printType: 'customer' | 'kitchen' | 'both'
): Promise<PrintResult> {
  const printerType = process.env.PRINTER_TYPE || 'none';

  // If no printer configured, simulate success for development
  if (printerType === 'none') {
    console.log('='.repeat(40));
    if (printType === 'customer' || printType === 'both') {
      console.log('SIMULATED CUSTOMER RECEIPT');
      console.log('='.repeat(40));
      printReceiptToConsole(order, settings);
    }
    if (printType === 'kitchen' || printType === 'both') {
      if (printType === 'both') console.log('='.repeat(40));
      console.log('SIMULATED KITCHEN DOCKET');
      console.log('='.repeat(40));
      printKitchenDocketToConsole(order);
    }
    console.log('='.repeat(40));
    return { success: true };
  }

  try {
    // Dynamic import to handle missing dependencies gracefully
    const escpos = await import('escpos');
    
    let device: any;

    if (printerType === 'usb') {
      const USB = (await import('escpos-usb')).default;
      device = new USB();
    } else if (printerType === 'network') {
      const Network = (await import('escpos-network')).default;
      const host = process.env.PRINTER_NETWORK_HOST || '192.168.1.100';
      const port = parseInt(process.env.PRINTER_NETWORK_PORT || '9100');
      device = new Network(host, port);
    } else {
      return { success: false, error: 'Invalid printer type' };
    }

    const printer = new escpos.Printer(device);
    const shopSettings = settings || getDefaultSettings();
    const symbol = shopSettings.currencySymbol;

    return new Promise((resolve) => {
      device.open((err: any) => {
        if (err) {
          console.error('Failed to open printer:', err);
          resolve({ success: false, error: 'Failed to connect to printer' });
          return;
        }

        try {
          // Print customer receipt
          if (printType === 'customer' || printType === 'both') {
            printCustomerReceipt(printer, order, shopSettings, symbol);
          }

          // Print kitchen ticket
          if (printType === 'kitchen' || printType === 'both') {
            printKitchenTicket(printer, order);
          }

          printer.close();
          resolve({ success: true });
        } catch (printError: any) {
          console.error('Print error:', printError);
          resolve({ success: false, error: printError.message });
        }
      });
    });
  } catch (error: any) {
    console.error('Printer service error:', error);
    return { success: false, error: error.message };
  }
}

function printCustomerReceipt(
  printer: any,
  order: OrderForPrint,
  settings: SettingsForPrint,
  symbol: string
): void {
  const divider = '-'.repeat(32);

  printer
    .font('a')
    .align('ct')
    .style('b')
    .size(1, 1)
    .text(settings.shopName)
    .style('normal')
    .size(0, 0);

  if (settings.address) {
    printer.text(settings.address);
  }
  if (settings.phone) {
    printer.text(`Tel: ${settings.phone}`);
  }

  printer
    .text(divider)
    .align('ct')
    .style('b')
    .text(getOrderTypeLabel(order.type))
    .style('normal')
    .text(`Order #${order.orderNumber}`)
    .text(formatDateTime(order.createdAt))
    .text(divider);

  // Items
  printer.align('lt');
  
  for (const item of order.items) {
    printer
      .text(`${item.quantity}x ${item.product.name}`)
      .align('rt')
      .text(formatCurrency(item.totalPrice, symbol))
      .align('lt');

    // Modifiers
    for (const mod of item.modifiers) {
      printer.text(`  + ${mod.name}`);
      if (mod.price > 0) {
        printer.align('rt').text(formatCurrency(mod.price, symbol)).align('lt');
      }
    }

    // Item notes
    if (item.notes) {
      printer.text(`  Note: ${item.notes}`);
    }
  }

  printer.text(divider);

  // Totals
  printer
    .align('lt')
    .text('Subtotal:')
    .align('rt')
    .text(formatCurrency(order.subtotal, symbol))
    .align('lt')
    .text(`VAT (${settings.vatRate}%):`)
    .align('rt')
    .text(formatCurrency(order.tax, symbol))
    .align('lt')
    .text(divider)
    .style('b')
    .align('lt')
    .text('TOTAL:')
    .align('rt')
    .size(1, 1)
    .text(formatCurrency(order.total, symbol))
    .size(0, 0)
    .style('normal')
    .text(divider);

  // Payment method
  if (order.paymentMethod) {
    printer
      .align('ct')
      .text(`Paid by: ${order.paymentMethod.toUpperCase()}`);
  }

  // VAT number
  if (settings.vatNumber) {
    printer.align('ct').text(`VAT No: ${settings.vatNumber}`);
  }

  // Footer
  if (settings.receiptFooter) {
    printer.text('').text(settings.receiptFooter);
  }

  printer
    .text('')
    .text('')
    .cut()
    .flush();
}

function printKitchenTicket(printer: any, order: OrderForPrint): void {
  const divider = '='.repeat(32);

  printer
    .font('a')
    .align('ct')
    .style('b')
    .size(2, 2)
    .text(`#${order.orderNumber}`)
    .size(1, 1)
    .text(getOrderTypeLabel(order.type))
    .size(0, 0)
    .style('normal')
    .text(formatDateTime(order.createdAt))
    .text(divider);

  if (order.customerName) {
    printer.text(`Customer: ${order.customerName}`);
  }

  printer.text(divider).align('lt');

  // Items - larger for kitchen
  for (const item of order.items) {
    printer
      .size(1, 1)
      .style('b')
      .text(`${item.quantity}x ${item.product.name}`)
      .style('normal')
      .size(0, 0);

    // Modifiers
    for (const mod of item.modifiers) {
      printer.text(`  + ${mod.name}`);
    }

    // Notes - important for kitchen
    if (item.notes) {
      printer.style('b').text(`  *** ${item.notes} ***`).style('normal');
    }

    printer.text('');
  }

  // Order notes
  if (order.notes) {
    printer.text(divider).style('b').text(`NOTES: ${order.notes}`).style('normal');
  }

  printer
    .text(divider)
    .text('')
    .cut()
    .flush();
}

/**
 * Get printer status
 */
export async function getPrinterStatus(): Promise<PrinterStatusResult> {
  const printerType = process.env.PRINTER_TYPE || 'none';

  if (printerType === 'none') {
    return {
      connected: false,
      name: 'No printer configured',
      error: 'Printer type set to "none"',
    };
  }

  try {
    if (printerType === 'usb') {
      const USB = (await import('escpos-usb')).default as any;
      const devices = USB.findPrinter ? USB.findPrinter() : [];
      
      if (devices && devices.length > 0) {
        return {
          connected: true,
          name: `USB Printer (${devices.length} found)`,
        };
      } else {
        return {
          connected: false,
          error: 'No USB printers found',
        };
      }
    } else if (printerType === 'network') {
      // Network printer - we can't easily check without connecting
      return {
        connected: true,
        name: `Network Printer (${process.env.PRINTER_NETWORK_HOST}:${process.env.PRINTER_NETWORK_PORT})`,
      };
    }

    return { connected: false, error: 'Unknown printer type' };
  } catch (error: any) {
    return { connected: false, error: error.message };
  }
}

/**
 * Console print for development/debugging - Customer Receipt
 */
function printReceiptToConsole(order: OrderForPrint, settings: SettingsForPrint | null): void {
  const s = settings || getDefaultSettings();
  const symbol = s.currencySymbol;

  console.log(`\n${s.shopName}`);
  if (s.address) console.log(s.address);
  if (s.phone) console.log(`Tel: ${s.phone}`);
  console.log('-'.repeat(32));
  console.log(`${getOrderTypeLabel(order.type)}`);
  console.log(`Order #${order.orderNumber}`);
  console.log(formatDateTime(order.createdAt));
  console.log('-'.repeat(32));

  for (const item of order.items) {
    console.log(`${item.quantity}x ${item.product.name} - ${formatCurrency(item.totalPrice, symbol)}`);
    for (const mod of item.modifiers) {
      console.log(`  + ${mod.name} ${mod.price > 0 ? formatCurrency(mod.price, symbol) : ''}`);
    }
    if (item.notes) console.log(`  Note: ${item.notes}`);
  }

  console.log('-'.repeat(32));
  console.log(`Subtotal: ${formatCurrency(order.subtotal, symbol)}`);
  console.log(`VAT (${s.vatRate}%): ${formatCurrency(order.tax, symbol)}`);
  console.log(`TOTAL: ${formatCurrency(order.total, symbol)}`);
  
  if (s.receiptFooter) {
    console.log('\n' + s.receiptFooter);
  }
}

/**
 * Console print for development/debugging - Kitchen Docket
 */
function printKitchenDocketToConsole(order: OrderForPrint): void {
  console.log('');
  console.log(`*** ORDER #${order.orderNumber} ***`);
  console.log(`${getOrderTypeLabel(order.type)}`);
  console.log(formatDateTime(order.createdAt));
  console.log('-'.repeat(32));

  if (order.customerName) {
    console.log(`Customer: ${order.customerName}`);
    console.log('-'.repeat(32));
  }

  // Items - focused on preparation
  for (const item of order.items) {
    console.log(`\n>>> ${item.quantity}x ${item.product.name} <<<`);
    
    // Modifiers
    for (const mod of item.modifiers) {
      console.log(`    + ${mod.name}`);
    }

    // Notes - highlighted for kitchen
    if (item.notes) {
      console.log(`    *** ${item.notes} ***`);
    }
  }

  // Order notes
  if (order.notes) {
    console.log('\n' + '-'.repeat(32));
    console.log(`*** ORDER NOTES: ${order.notes} ***`);
  }

  console.log('\n' + '-'.repeat(32));
}

function getDefaultSettings(): SettingsForPrint {
  return {
    shopName: 'Kebab Shop',
    address: '',
    phone: '',
    vatRate: 20,
    currencySymbol: '£',
    receiptFooter: 'Thank you for your order!',
  };
}
