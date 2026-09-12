import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AttractScreen, KioskStatus } from './screens/AttractScreen';
import { OrderTypeScreen } from './screens/OrderTypeScreen';
import { MenuScreen } from './screens/MenuScreen';
import { ItemSheet } from './screens/ItemSheet';
import { CartScreen } from './screens/CartScreen';
import { ComboSheet } from './screens/ComboSheet';
import { PaymentScreen, PaymentStatus } from './screens/PaymentScreen';
import { ConfirmationScreen } from './screens/ConfirmationScreen';
import { AdminScreen } from './screens/AdminScreen';
import { PinDialog } from './components/PinDialog';
import { IdlePrompt } from './components/IdlePrompt';
import { ConfirmDialog } from './components/ConfirmDialog';
import { HelpDialog } from './components/HelpDialog';
import { Toast } from './components/Toast';
import { useMenu } from './hooks/useMenu';
import { useCart } from './hooks/useCart';
import { useIdleTimer } from './hooks/useIdleTimer';
import { createPaidOrder, setApiBaseUrl } from './lib/api';
import { findComboOffers } from './lib/combos';
import { displayName } from './lib/format';
import type { CartLine, KioskSettings, Modifier, OrderType, Product } from './types';

type Screen = 'attract' | 'order-type' | 'menu' | 'cart' | 'payment' | 'confirmation' | 'admin';

/** One add-on from each group, so the cart never suggests three dips */
const UPSELL_GROUPS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'drink', pattern: /drink/i },
  { label: 'side', pattern: /side|chip|dip|bite/i },
  { label: 'dessert', pattern: /dessert|sweet/i },
];

export default function App() {
  const [settings, setSettings] = useState<KioskSettings | null>(null);
  const [screen, setScreen] = useState<Screen>('attract');
  const [orderType, setOrderType] = useState<OrderType>('takeaway');
  /**
   * Where the order-type screen was opened from. Null means it is the opening step
   * of a new order, so leaving it cancels; otherwise leaving returns there with the
   * basket untouched.
   */
  const [orderTypeReturn, setOrderTypeReturn] = useState<Screen | null>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [editingLine, setEditingLine] = useState<CartLine | null>(null);
  const [showCombos, setShowCombos] = useState(false);
  /** Offered once per order, not once per trip to the cart */
  const [comboPrompted, setComboPrompted] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [undoLine, setUndoLine] = useState<CartLine | null>(null);

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('waiting');
  const [paymentError, setPaymentError] = useState<{ title: string; message: string } | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | undefined>();
  const [confirmation, setConfirmation] = useState<{ orderNumber: number; printed: boolean } | null>(
    null
  );

  // Refresh only between customers: see the useMenu docblock for why a refresh
  // underneath a live order can end in a charge with no order.
  const menu = useMenu(settings?.apiUrl ?? null, screen !== 'attract' && screen !== 'admin');
  const cart = useCart(menu.shop.vatRate);
  const paymentInFlight = useRef(false);
  /** The customer's place in the menu, kept across the trip to the cart */
  const menuScrollTop = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------- settings

  useEffect(() => {
    (async () => {
      const loaded = await window.kioskAPI.getSettings();
      setApiBaseUrl(loaded.apiUrl);
      setSettings(loaded);
      document.body.classList.toggle('hide-cursor', loaded.kioskMode);
    })();
  }, []);

  const applySettings = useCallback((next: KioskSettings) => {
    setApiBaseUrl(next.apiUrl);
    setSettings(next);
    document.body.classList.toggle('hide-cursor', next.kioskMode);
  }, []);

  // Tell the main process when a customer is mid-order so OTA updates hold off
  useEffect(() => {
    const busy = screen !== 'attract' && screen !== 'admin';
    window.kioskAPI.setBusy(busy);
  }, [screen]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const showToast = (message: string, undo?: CartLine) => {
    setToast(message);
    setUndoLine(undo ?? null);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(
      () => {
        setToast(null);
        setUndoLine(null);
      },
      undo ? 6000 : 1800
    );
  };

  const handleRemoveLine = (lineId: string) => {
    const removed = cart.lines.find((line) => line.lineId === lineId);
    cart.removeLine(lineId);
    if (removed) showToast(`${displayName(removed.product.name)} removed`, removed);
  };

  const handleUndoRemove = () => {
    if (!undoLine) return;
    cart.addLine(undoLine.product, undoLine.quantity, undoLine.modifiers);
    setUndoLine(null);
    setToast(null);
  };

  // ------------------------------------------------------------------- reset

  const resetToAttract = useCallback(() => {
    cart.clear();
    // The one piece of customer state the old reset left behind
    setOrderType('takeaway');
    setActiveProduct(null);
    setEditingLine(null);
    setConfirmation(null);
    setPaymentError(null);
    setPaymentReference(undefined);
    setPaymentStatus('waiting');
    setConfirmCancel(false);
    setShowHelp(false);
    // The next customer gets their own combo offer
    setShowCombos(false);
    setComboPrompted(false);
    setOrderTypeReturn(null);
    // The next customer starts at the top of the menu, not wherever the last one left it
    menuScrollTop.current = 0;
    setScreen('attract');
  }, [cart]);

  const requestCancel = () => {
    if (cart.itemCount === 0) {
      resetToAttract();
      return;
    }
    setConfirmCancel(true);
  };

  /**
   * Whether it is safe to let a customer start an order at all.
   *
   * The old gate was `menu.error && products.length === 0`, which almost never
   * fires: useMenu keeps the last good products when a fetch fails, so the real
   * failure at a live site — kiosk booted this morning, backend dies at 7pm —
   * left 171 cached products on screen and the gate open. The customer would then
   * build an order, the PAX would arm, the CARD WOULD BE APPROVED, and only then
   * would createPaidOrder fail, landing on "payment taken, show staff".
   *
   * Any failed fetch now closes the kiosk. A stale menu is an inconvenience; a
   * charge with no order is money and trust.
   */
  const hasOrderableMenu = menu.products.some((product) => product.isAvailable);

  const kioskStatus: KioskStatus = menu.error
    ? 'unavailable'
    : menu.products.length === 0 && menu.isLoading
      ? 'loading'
      : // A 200 that returns nothing orderable - bad deploy, unpublished menu, or
        // staff marking everything sold out at close - is not "ready". Letting the
        // customer through here strands them on an empty menu with no explanation.
        !hasOrderableMenu
        ? 'unavailable'
        : 'ready';

  /** Off in a takeaway-only shop, and then it must not be reachable mid-order either */
  const canChangeOrderType = settings?.orderTypePrompt !== false;

  // Never interrupt a payment, and never time out the attract screen
  const idleEnabled = screen === 'order-type' || screen === 'menu' || screen === 'cart';

  const idle = useIdleTimer({
    timeoutSeconds: settings?.attractTimeoutSeconds ?? 60,
    graceSeconds: 45,
    enabled: idleEnabled,
    onTimeout: resetToAttract,
  });

  // ------------------------------------------------------------------ flow

  const startOrder = () => {
    cart.clear();
    if (settings?.orderTypePrompt === false) {
      setOrderType('takeaway');
      setScreen('menu');
    } else {
      setScreen('order-type');
    }
  };

  const handleQuickAdd = (product: Product) => {
    cart.addLine(product, 1, []);
    showToast(`${displayName(product.name)} added`);
  };

  const handleAddToCart = (product: Product, quantity: number, modifiers: Modifier[]) => {
    cart.addLine(product, quantity, modifiers);
    setActiveProduct(null);
    showToast(`${displayName(product.name)} added`);
  };

  const handleUpdateLine = (lineId: string, quantity: number, modifiers: Modifier[]) => {
    cart.replaceLine(lineId, quantity, modifiers);
    setEditingLine(null);
    setActiveProduct(null);
    showToast('Order updated');
  };

  const suggestions = useMemo(() => {
    const picked: Product[] = [];

    for (const group of UPSELL_GROUPS) {
      const categoryIds = menu.categories
        .filter((category) => group.pattern.test(category.name))
        .map((category) => category.id);

      const candidate = menu.products.find(
        (product) =>
          product.isAvailable &&
          categoryIds.includes(product.categoryId) &&
          !cart.lines.some((line) => line.product.id === product.id) &&
          !picked.some((chosen) => chosen.id === product.id)
      );

      if (candidate) picked.push(candidate);
    }

    return picked;
  }, [menu.products, menu.categories, cart.lines]);

  const comboOffers = useMemo(
    () => findComboOffers(cart.lines, menu.products),
    [cart.lines, menu.products]
  );

  /**
   * Pay runs through the combo prompt once per order. Asking again after the customer
   * has already said no would be nagging, and asking again after they said yes would
   * offer an upgrade on a line that is already a combo.
   */
  const requestPayment = () => {
    if (!comboPrompted && comboOffers.length > 0) {
      setShowCombos(true);
      return;
    }
    void beginPayment();
  };

  const handleComboConfirm = (lineIds: string[]) => {
    for (const lineId of lineIds) {
      const offer = comboOffers.find((candidate) => candidate.line.lineId === lineId);
      if (offer) cart.upgradeLine(lineId, offer.combo);
    }
    setComboPrompted(true);
    setShowCombos(false);
    void beginPayment();
  };

  const handleComboSkip = () => {
    setComboPrompted(true);
    setShowCombos(false);
    void beginPayment();
  };

  const beginPayment = async () => {
    if (paymentInFlight.current) return;
    paymentInFlight.current = true;

    setPaymentError(null);
    setPaymentReference(undefined);
    setPaymentStatus('waiting');
    setScreen('payment');

    let charged = false;
    let authReference: string | undefined;

    try {
      if (!settings?.eftposEnabled) {
        throw new Error('Card payments are turned off on this kiosk.');
      }

      const amountCents = Math.round(cart.total * 100);
      const result = await window.kioskAPI.eftpos.purchase(amountCents);

      if (result.outcome !== 'Accepted') {
        const messages: Record<string, { title: string; message: string }> = {
          Declined: {
            title: 'Card declined',
            message: 'The card was declined. Try another card, or pay at the counter.',
          },
          Cancelled: {
            title: 'Payment cancelled',
            message: 'The payment was cancelled at the card machine. Nothing has been charged.',
          },
          DeviceOffline: {
            title: 'Card machine unavailable',
            message: 'The card machine is not responding. Please order at the counter.',
          },
          Failed: {
            title: 'Payment failed',
            message: result.error || 'Something went wrong. Nothing has been charged.',
          },
        };
        setPaymentError(messages[result.outcome] || messages.Failed);
        setPaymentStatus('error');
        return;
      }

      // Past this line the customer's card HAS been charged
      charged = true;
      authReference = result.authId || result.terminalRef || result.transactionId;
      setPaymentReference(authReference);
      setPaymentStatus('finalising');

      const order = await createPaidOrder({ type: orderType, lines: cart.lines });

      const printResult = await window.kioskAPI.printReceipt({
        orderNumber: order.orderNumber,
        orderType,
        createdAt: order.createdAt || new Date().toISOString(),
        items: cart.lines.map((line) => ({
          name: displayName(line.product.name),
          quantity: line.quantity,
          totalPrice: line.unitPrice * line.quantity,
          modifiers: line.modifiers.map((modifier) => ({
            name: modifier.name,
            price: modifier.price,
          })),
        })),
        subtotal: cart.subtotal,
        tax: cart.tax,
        total: cart.total,
        currencySymbol: menu.shop.currencySymbol,
        vatRate: menu.shop.vatRate,
        shopName: menu.shop.shopName,
        address: menu.shop.address,
        phone: menu.shop.phone,
        vatNumber: menu.shop.vatNumber,
        receiptFooter: menu.shop.receiptFooter,
        eftposReceipt: settings?.eftposPrintReceipt ? result.receipt : undefined,
        eftposAuthId: result.authId,
        eftposCardPan: result.cardPan,
        eftposCardType: result.cardType,
      });

      setConfirmation({
        orderNumber: order.orderNumber,
        printed: printResult.success && !printResult.skipped,
      });
      setScreen('confirmation');
      cart.clear();
    } catch (err: any) {
      if (charged) {
        // Retrying would charge the card a second time, so this is a dead end
        // that only a staff member can clear.
        console.error('Order failed AFTER a successful charge:', err);
        setPaymentReference(authReference);
        setPaymentStatus('paid-unfinished');
      } else {
        setPaymentError({
          title: 'Payment failed',
          message: err?.message || 'Nothing has been charged. Please try again.',
        });
        setPaymentStatus('error');
      }
    } finally {
      paymentInFlight.current = false;
    }
  };

  // A failed payment left on screen would block the next customer
  useEffect(() => {
    if (screen !== 'payment' || paymentStatus !== 'error') return;
    const timer = setTimeout(resetToAttract, 60 * 1000);
    return () => clearTimeout(timer);
  }, [screen, paymentStatus, resetToAttract]);

  // The terminal reports "delayed" while the customer is being prompted
  useEffect(() => {
    return window.kioskAPI.eftpos.onDelayed(() => {
      setPaymentStatus((current) => (current === 'waiting' ? 'processing' : current));
    });
  }, []);

  // ---------------------------------------------------------------- render

  if (!settings) {
    return <div className="h-full bg-cream-100" />;
  }

  const sheetProduct = editingLine ? editingLine.product : activeProduct;

  return (
    <div className="h-full bg-cream-100 text-ink-900">
      {screen === 'attract' && (
        <AttractScreen
          onStart={startOrder}
          onAdminHold={() => setShowPin(true)}
          status={kioskStatus}
          highlights={menu.highlights}
          currencySymbol={menu.shop.currencySymbol}
        />
      )}

      {screen === 'order-type' && (
        <OrderTypeScreen
          currentType={orderTypeReturn ? orderType : null}
          isChanging={orderTypeReturn !== null}
          itemCount={cart.itemCount}
          total={cart.total}
          currencySymbol={menu.shop.currencySymbol}
          onSelect={(type) => {
            setOrderType(type);
            setScreen(orderTypeReturn ?? 'menu');
            setOrderTypeReturn(null);
          }}
          onBack={() => {
            if (orderTypeReturn) {
              setScreen(orderTypeReturn);
              setOrderTypeReturn(null);
              return;
            }
            requestCancel();
          }}
        />
      )}

      {screen === 'menu' && (
        <MenuScreen
          layout={settings.menuLayout}
          categories={menu.categories}
          productsByCategory={menu.productsByCategory}
          currencySymbol={menu.shop.currencySymbol}
          orderType={orderType}
          itemCount={cart.itemCount}
          total={cart.total}
          isLoading={menu.isLoading}
          error={menu.error}
          onReload={menu.reload}
          onSelectProduct={setActiveProduct}
          onQuickAdd={handleQuickAdd}
          onSoldOut={(product) =>
            showToast(`Sorry — ${displayName(product.name)} is sold out today`)
          }
          onViewOrder={() => setScreen('cart')}
          canChangeOrderType={canChangeOrderType}
          onChangeOrderType={() => {
            setOrderTypeReturn('menu');
            setScreen('order-type');
          }}
          onCancelOrder={requestCancel}
          onHelp={() => setShowHelp(true)}
          scrollTopRef={menuScrollTop}
        />
      )}

      {screen === 'cart' && (
        <CartScreen
          lines={cart.lines}
          currencySymbol={menu.shop.currencySymbol}
          orderType={orderType}
          tax={cart.tax}
          total={cart.total}
          suggestions={suggestions}
          onSetQuantity={cart.setQuantity}
          onRemove={handleRemoveLine}
          onEdit={setEditingLine}
          onQuickAdd={handleQuickAdd}
          onSelectProduct={setActiveProduct}
          onAddMore={() => setScreen('menu')}
          onPay={requestPayment}
          onCancelOrder={requestCancel}
          canChangeOrderType={canChangeOrderType}
          onChangeOrderType={() => {
            setOrderTypeReturn('cart');
            setScreen('order-type');
          }}
        />
      )}

      {showCombos && (
        <ComboSheet
          offers={comboOffers}
          currencySymbol={menu.shop.currencySymbol}
          onConfirm={handleComboConfirm}
          onSkip={handleComboSkip}
        />
      )}

      {screen === 'payment' && (
        <PaymentScreen
          status={paymentStatus}
          amount={cart.total}
          currencySymbol={menu.shop.currencySymbol}
          errorTitle={paymentError?.title}
          errorMessage={paymentError?.message}
          reference={paymentReference}
          onRetry={beginPayment}
          onBackToOrder={() => setScreen('cart')}
          onHelp={() => setShowHelp(true)}
          onDismissPaidUnfinished={resetToAttract}
        />
      )}

      {screen === 'confirmation' && confirmation && (
        <ConfirmationScreen
          orderNumber={confirmation.orderNumber}
          printed={confirmation.printed}
          onDone={resetToAttract}
        />
      )}

      {screen === 'admin' && (
        <AdminScreen
          onClose={() => {
            setScreen('attract');
            menu.reload();
          }}
          onSettingsSaved={applySettings}
        />
      )}

      {sheetProduct && (
        <ItemSheet
          product={sheetProduct}
          currencySymbol={menu.shop.currencySymbol}
          editingLine={editingLine}
          onAdd={handleAddToCart}
          onUpdate={handleUpdateLine}
          onClose={() => {
            setActiveProduct(null);
            setEditingLine(null);
          }}
        />
      )}

      {toast && <Toast message={toast} onUndo={undoLine ? handleUndoRemove : undefined} />}

      {idle.warning && idleEnabled && (
        <IdlePrompt onContinue={idle.keepAlive} onFinish={resetToAttract} />
      )}

      {confirmCancel && (
        <ConfirmDialog
          title="Cancel your order?"
          message="Everything in your order will be cleared."
          cancelLabel="No, keep ordering"
          confirmLabel="Yes, cancel my order"
          onCancel={() => setConfirmCancel(false)}
          onConfirm={resetToAttract}
        />
      )}

      {showHelp && <HelpDialog onClose={() => setShowHelp(false)} />}

      {showPin && (
        <PinDialog
          expectedPin={settings.adminPin}
          onSuccess={() => {
            setShowPin(false);
            setScreen('admin');
          }}
          onCancel={() => setShowPin(false)}
        />
      )}
    </div>
  );
}
