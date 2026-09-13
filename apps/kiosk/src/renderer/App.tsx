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
import { createPaidOrder, isBackendReachable, setApiBaseUrl } from './lib/api';
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
  const [paymentChargedAt, setPaymentChargedAt] = useState<Date | undefined>();
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
    setPaymentChargedAt(undefined);
    setPaymentStatus('waiting');
    setConfirmCancel(false);
    setShowHelp(false);
    // The next customer gets their own combo offer
    setShowCombos(false);
    setComboPrompted(false);
    setPendingPayment(false);
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

  /**
   * Payment cannot be started from the same handler that upgrades the cart.
   *
   * beginPayment reads cart.total and cart.lines out of the render closure, so
   * calling it straight after cart.upgradeLine() read the PRE-upgrade cart: the
   * customer tapped "Add to my order +$4", confirmed it, and was then charged the
   * old total for the old items while the upgrade they had just agreed to was
   * silently dropped. Setting a flag instead defers the call to an effect, which
   * runs after the upgrade has been committed and re-rendered.
   */
  const [pendingPayment, setPendingPayment] = useState(false);

  const handleComboConfirm = (lineIds: string[]) => {
    for (const lineId of lineIds) {
      const offer = comboOffers.find((candidate) => candidate.line.lineId === lineId);
      if (offer) cart.upgradeLine(lineId, offer.combo);
    }
    setComboPrompted(true);
    setShowCombos(false);
    setPendingPayment(true);
  };

  const handleComboSkip = () => {
    setComboPrompted(true);
    setShowCombos(false);
    setPendingPayment(true);
  };

  const beginPayment = async () => {
    if (paymentInFlight.current) return;
    paymentInFlight.current = true;

    setPaymentError(null);
    setPaymentReference(undefined);
    setPaymentStatus('checking');
    setScreen('payment');

    let charged = false;
    let authReference: string | undefined;

    try {
      if (!settings?.eftposEnabled) {
        throw new Error('Card payments are turned off on this kiosk.');
      }

      /*
       * Gate the TERMINAL, not the entrance.
       *
       * kioskStatus stops a customer starting an order while the backend is down,
       * but a customer already mid-order when it dies still arrives here. Because
       * the order is only created after the card is approved, arming the terminal
       * against an unreachable backend means money taken and no order - which is
       * the single most expensive thing this app can do.
       *
       * Checked as late as possible, immediately before purchase(), so the answer
       * is as fresh as it can be. Failure routes to 'unavailable', which offers
       * the counter and a staff member and deliberately offers NO retry: nothing
       * was charged, and retrying only re-arms the terminal against a system that
       * still cannot record the result.
       */
      if (!(await isBackendReachable())) {
        setPaymentStatus('unavailable');
        return;
      }

      setPaymentStatus('waiting');

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
      // Recorded even when the terminal gives us no reference: the time is what
      // makes an unreferenced charge findable in the PAX transaction report.
      setPaymentChargedAt(new Date());
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

  /**
   * Runs on the render AFTER the combo upgrade has been applied, so beginPayment
   * closes over the updated cart. cart.lines is in the dependency list so the
   * effect cannot fire on a render where the upgrade has not landed yet.
   */
  useEffect(() => {
    if (!pendingPayment) return;
    setPendingPayment(false);
    void beginPayment();
    // beginPayment is recreated every render; depending on it would re-run this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPayment, cart.lines]);

  /*
   * A dead-ended payment left on screen would block the next customer.
   * 'paid-unfinished' is deliberately NOT here: money was taken, and that screen
   * is the customer's only proof, so it stays until a person dismisses it.
   */
  useEffect(() => {
    if (screen !== 'payment') return;
    if (paymentStatus !== 'error' && paymentStatus !== 'unavailable') return;
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
          chargedAt={paymentChargedAt}
          onRetry={beginPayment}
          onBackToOrder={() => setScreen('cart')}
          onHelp={() => setShowHelp(true)}
          onDismissPaidUnfinished={resetToAttract}
          onGiveUp={resetToAttract}
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
          /*
           * Keyed so the sheet always remounts. Its quantity and selections are
           * seeded from editingLine in useState initialisers, which run once per
           * mount - without a key, any path that swapped the product while the
           * sheet stayed mounted would carry the previous item's choices onto a
           * different product. Cheap guarantee rather than a proof about routes.
           */
          key={editingLine ? `line-${editingLine.lineId}` : `product-${sheetProduct.id}`}
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
        <IdlePrompt
          secondsLeft={idle.secondsLeft}
          onContinue={idle.keepAlive}
          onFinish={() => {
            /*
             * Through the same confirmation every other discard uses. This button
             * sits just under a full-width primary, on a dialog that appeared
             * unprompted while the customer was deciding, and the instinct on
             * seeing an unexpected dialog is to tap something to make it go away.
             * keepAlive first so the countdown does not clear the order out from
             * under the confirmation.
             */
            idle.keepAlive();
            requestCancel();
          }}
        />
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

      {showHelp && (
        <HelpDialog
          /*
           * Split on whether money has been taken, not on which screen we are on.
           * A declined card is on the payment screen but nothing was charged and
           * the cart is intact, so "your order is safe" and "back to my order"
           * are both TRUE there — the useful advice is try another card. Only a
           * charge makes them false.
           */
          context={
            paymentStatus === 'paid-unfinished' || paymentStatus === 'finalising'
              ? 'charged'
              : screen === 'payment' && paymentStatus === 'unavailable'
                ? 'unavailable'
                : 'ordering'
          }
          onClose={() => setShowHelp(false)}
        />
      )}

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
