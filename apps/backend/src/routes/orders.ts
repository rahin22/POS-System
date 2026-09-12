import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../index';
import { createOrderSchema, updateOrderSchema } from '@kebab-pos/shared';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { printReceipt } from '../services/printer';
import { shopDayKey, shopDayRange, shopDayLockId } from '../lib/shopTime';

const router = Router();

// Arbitrary namespace for the daily order-number advisory lock, so its keys can never
// collide with an advisory lock taken anywhere else against the same database.
const ORDER_NUMBER_LOCK_NAMESPACE = 4417;

// Get all orders
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { status, type, date, page = '1', limit = '50', includeArchived = 'false' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Date filter - shop-local day boundaries (handles AEST/AEDT)
    let dateFilter = {};
    if (date) {
      const { start, end } = shopDayRange(date as string); // Format: YYYY-MM-DD

      dateFilter = {
        createdAt: {
          gte: start,
          lt: end,
        },
      };
    }

    // Status filter - handle both single and multiple statuses
    let statusFilter = {};
    if (status) {
      const statusStr = status as string;
      if (statusStr.includes(',')) {
        statusFilter = { status: { in: statusStr.split(',') } };
      } else {
        statusFilter = { status: statusStr };
      }
    }

    // Archive filter - exclude archived by default unless explicitly requested
    const archivedFilter = includeArchived === 'true' ? {} : { archived: false };

    const where = {
      ...statusFilter,
      ...(type && { type: (type as string).replace('-', '_') as any }),
      ...dateFilter,
      ...archivedFilter,
    };

    // Check if full details requested (for single order view)
    const includeItems = req.query.includeItems === 'true';

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: includeItems ? {
          items: {
            include: {
              product: {
                select: { id: true, name: true, price: true, categoryId: true },
              },
              modifiers: {
                select: { id: true, name: true, price: true },
              },
            },
          },
          createdBy: {
            select: { id: true, name: true },
          },
        } : {
          createdBy: {
            select: { id: true, name: true },
          },
          _count: {
            select: { items: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: orders,
        total,
        page: pageNum,
        pageSize: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get orders',
    });
  }
});

// Kitchen docket queue: orders that arrived without staff involvement (kiosk/online)
// and have not had a kitchen docket printed yet.
// NOTE: must stay above the '/:id' route or Express will capture it.
router.get('/kitchen/queue', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      sources = 'kiosk,online',
      sinceMinutes = '360',
      requirePaid = 'true',
      limit = '20',
    } = req.query;

    const since = new Date(Date.now() - parseInt(sinceMinutes as string) * 60 * 1000);

    const orders = await prisma.order.findMany({
      where: {
        source: { in: (sources as string).split(',').map((s) => s.trim()).filter(Boolean) },
        kitchenPrintedAt: null,
        status: { not: 'cancelled' },
        createdAt: { gte: since },
        ...(requirePaid === 'true' ? { paymentStatus: 'paid' as any } : {}),
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true } },
            modifiers: { select: { id: true, name: true, price: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: parseInt(limit as string),
    });

    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Kitchen queue error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get kitchen queue',
    });
  }
});

// Claim an order for kitchen printing. Atomic: only the first caller gets claimed=true,
// so two POS devices polling the queue can never both print the same docket.
router.post('/:id/kitchen-print-claim', authenticate, async (req: AuthRequest, res) => {
  try {
    const { device } = req.body || {};

    const claim = await prisma.order.updateMany({
      where: { id: req.params.id, kitchenPrintedAt: null },
      data: {
        kitchenPrintedAt: new Date(),
        kitchenPrintedBy: typeof device === 'string' ? device.slice(0, 100) : null,
      },
    });

    if (claim.count === 0) {
      // Already printed by another device (or the order doesn't exist)
      return res.json({ success: true, claimed: false });
    }

    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            product: true,
            modifiers: true,
          },
        },
      },
    });

    res.json({ success: true, claimed: true, data: order });
  } catch (error) {
    console.error('Kitchen print claim error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to claim order for kitchen printing',
    });
  }
});

// Release a claim so the docket can be retried after a failed print
router.post('/:id/kitchen-print-release', authenticate, async (req: AuthRequest, res) => {
  try {
    await prisma.order.update({
      where: { id: req.params.id },
      data: { kitchenPrintedAt: null, kitchenPrintedBy: null },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Kitchen print release error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to release kitchen print claim',
    });
  }
});

// Get single order
router.get('/:id', authenticate, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, price: true, categoryId: true },
            },
            modifiers: {
              select: { id: true, name: true, price: true },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get order',
    });
  }
});

// Create order
router.post('/', async (req: AuthRequest, res) => {
  try {
    const validation = createOrderSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
    }

    const {
      type,
      source,
      paymentMethod,
      paymentStatus,
      items,
      customerName,
      customerPhone,
      customerEmail,
      notes,
      discount,
    } = validation.data;

    // A payment can only be recorded at creation time if the method is stated too
    if (paymentStatus === 'paid' && !paymentMethod) {
      return res.status(400).json({
        success: false,
        error: 'paymentMethod is required when creating an order as paid',
      });
    }

    // Get products and calculate totals
    const productIds = items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    type ProductType = typeof products[number];
    const productMap = new Map<string, ProductType>(products.map((p: ProductType) => [p.id, p]));

    // Calculate order items
    let subtotal = 0;
    // Explicitly typed: it is now built outside the transaction callback that consumes
    // it, so TypeScript cannot infer the element type from later pushes.
    const orderItems: Prisma.OrderItemUncheckedCreateWithoutOrderInput[] = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return res.status(400).json({
          success: false,
          error: `Product not found: ${item.productId}`,
        });
      }

      if (!product.isAvailable) {
        return res.status(400).json({
          success: false,
          error: `Product not available: ${product.name}`,
        });
      }

      // Get modifiers if any
      let modifierTotal = 0;
      const modifiers = [];

      if (item.modifierIds && item.modifierIds.length > 0) {
        const mods = await prisma.modifier.findMany({
          where: { id: { in: item.modifierIds } },
        });

        for (const mod of mods) {
          modifierTotal += mod.price;
          modifiers.push({
            modifierId: mod.id,
            name: mod.name,
            price: mod.price,
          });
        }
      }

      let unitPrice: number;
      let totalPrice: number;

      // Check if this is a weight-based item with pre-calculated prices
      if (item.isWeightBased && item.unitPrice !== undefined && item.totalPrice !== undefined) {
        // Use pre-calculated prices from frontend for weight-based items
        unitPrice = item.unitPrice;
        totalPrice = item.totalPrice;
      } else {
        // Standard quantity-based pricing
        unitPrice = product.price + modifierTotal;
        totalPrice = unitPrice * item.quantity;
      }
      
      subtotal += totalPrice;

      orderItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        notes: item.notes,
        modifiers: {
          create: modifiers,
        },
      });
    }

    // Get GST rate from settings
    const settings = await prisma.settings.findUnique({
      where: { id: 'default' },
    });
    const gstRate = settings?.vatRate || 10;

    // Apply discount and calculate totals
    // Note: GST is included in product prices, so we extract it from the total
    let discountAmount = discount?.amount || 0;
    
    // If coupon was used, increment usage count
    if (discount?.code) {
      try {
        await prisma.coupon.update({
          where: { code: discount.code.toUpperCase() },
          data: { usageCount: { increment: 1 } },
        });
      } catch (error) {
        console.error('Failed to update coupon usage:', error);
      }
    }

    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const total = afterDiscount; // Total already includes GST
    const tax = total - (total / (1 + gstRate / 100)); // Extract GST from total

    // Allocate the daily order number and create the order in a single transaction,
    // guarded by an advisory lock on the shop-local trading day. Without the lock two
    // devices can read the same maximum and both write it, which is how duplicate
    // order numbers were being issued.
    const tradingDay = shopDayKey();
    const { start: dayStart, end: dayEnd } = shopDayRange(tradingDay);

    const order = await prisma.$transaction(
      async (tx) => {
        // Released automatically when the transaction ends. Scoped to this trading
        // day, so concurrent creates only ever wait on each other, never on anything
        // else touching the database.
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            ${ORDER_NUMBER_LOCK_NAMESPACE}::int4,
            ${shopDayLockId(tradingDay)}::int4
          )
        `;

        const lastOrderToday = await tx.order.findFirst({
          where: {
            createdAt: {
              gte: dayStart,
              lt: dayEnd,
            },
          },
          orderBy: { orderNumber: 'desc' },
          select: { orderNumber: true },
        });

        return tx.order.create({
          data: {
            orderNumber: (lastOrderToday?.orderNumber || 0) + 1,
            type: type.replace('-', '_') as any,
            source: source || 'pos',
            ...(paymentMethod ? { paymentMethod: paymentMethod as any } : {}),
            ...(paymentStatus ? { paymentStatus: paymentStatus as any } : {}),
            subtotal,
            discount: discountAmount,
            discountType: discount?.type,
            discountValue: discount?.value,
            couponCode: discount?.code,
            tax,
            total,
            customerName,
            customerPhone,
            customerEmail,
            notes,
            createdById: req.user?.id,
            items: {
              create: orderItems,
            },
          },
          include: {
            items: {
              include: {
                product: true,
                modifiers: true,
              },
            },
          },
        });
      },
      { maxWait: 5000, timeout: 10000 }
    );

    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order',
    });
  }
});

// Update order status
router.patch('/:id/status', authenticate, async (req: AuthRequest, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required',
      });
    }

    const updateData: any = { status };

    // Set completedAt if marking as completed
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        items: {
          include: {
            product: true,
            modifiers: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status',
    });
  }
});

// Update order payment
router.patch('/:id/payment', authenticate, async (req: AuthRequest, res) => {
  try {
    const validation = updateOrderSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        paymentMethod: validation.data.paymentMethod as any,
        paymentStatus: validation.data.paymentStatus as any,
      },
      include: {
        items: {
          include: {
            product: true,
            modifiers: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Update order payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order payment',
    });
  }
});

// Cancel order
router.post('/:id/cancel', authenticate, async (req: AuthRequest, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    if (order.status === 'completed' || order.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel a completed or already cancelled order',
      });
    }

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        status: 'cancelled',
        paymentStatus: order.paymentStatus === 'paid' ? 'refunded' : 'failed',
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel order',
    });
  }
});

// Reprint receipt
router.post('/:id/reprint', authenticate, async (req: AuthRequest, res) => {
  try {
    const { type = 'customer' } = req.body; // 'customer', 'kitchen', or 'both'
    
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            product: true,
            modifiers: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    // Get settings for printing
    const settings = await prisma.settings.findUnique({
      where: { id: 'default' },
    });

    // Print receipt/docket
    await printReceipt(order as any, settings as any, type as 'customer' | 'kitchen' | 'both');

    res.json({
      success: true,
      message: `${type === 'both' ? 'Receipt and kitchen docket' : type === 'kitchen' ? 'Kitchen docket' : 'Receipt'} reprinted successfully`,
    });
  } catch (error) {
    console.error('Reprint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reprint',
    });
  }
});

export default router;
