import { Router } from 'express';
import { prisma } from '../index';
import { createOrderSchema, updateOrderSchema } from '@kebab-pos/shared';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { printReceipt } from '../services/printer';

const router = Router();

// Get all orders
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { status, type, date, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Date filter
    let dateFilter = {};
    if (date) {
      const startDate = new Date(date as string);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date as string);
      endDate.setHours(23, 59, 59, 999);
      dateFilter = {
        createdAt: {
          gte: startDate,
          lte: endDate,
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

    const where = {
      ...statusFilter,
      ...(type && { type: (type as string).replace('-', '_') as any }),
      ...dateFilter,
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
                select: { id: true, name: true, price: true },
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

// Get single order
router.get('/:id', authenticate, async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Use single query with JOINs instead of multiple round trips
    const result = await prisma.$queryRaw<any[]>`
      SELECT 
        o.*,
        json_agg(
          json_build_object(
            'id', oi.id,
            'quantity', oi.quantity,
            'unitPrice', oi."unitPrice",
            'totalPrice', oi."totalPrice",
            'notes', oi.notes,
            'product', json_build_object('id', p.id, 'name', p.name, 'price', p.price),
            'modifiers', COALESCE(
              (SELECT json_agg(json_build_object('id', m.id, 'name', m.name, 'price', m.price))
               FROM "_ModifierToOrderItem" mtoi
               JOIN "Modifier" m ON m.id = mtoi."A"
               WHERE mtoi."B" = oi.id), '[]'::json
            )
          )
        ) FILTER (WHERE oi.id IS NOT NULL) as items,
        json_build_object('id', u.id, 'name', u.name) as "createdBy"
      FROM "Order" o
      LEFT JOIN "OrderItem" oi ON oi."orderId" = o.id
      LEFT JOIN "Product" p ON p.id = oi."productId"
      LEFT JOIN "User" u ON u.id = o."createdById"
      WHERE o.id = ${req.params.id}
      GROUP BY o.id, u.id, u.name
    `;
    
    const queryTime = Date.now() - startTime;
    console.log(`[PERF] Single order query took ${queryTime}ms`);

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    const order = result[0];
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

    const { type, items, customerName, customerPhone, customerEmail, notes, discount } = validation.data;

    // Get products and calculate totals
    const productIds = items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    type ProductType = typeof products[number];
    const productMap = new Map<string, ProductType>(products.map((p: ProductType) => [p.id, p]));

    // Calculate order items
    let subtotal = 0;
    const orderItems = [];

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

      const unitPrice = product.price + modifierTotal;
      const totalPrice = unitPrice * item.quantity;
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
    const tax = afterDiscount * (gstRate / 100);
    const total = afterDiscount + tax;

    // Create order
    const order = await prisma.order.create({
      data: {
        type: type.replace('-', '_') as any,
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
