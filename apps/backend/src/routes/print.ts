import { Router } from 'express';
import { prisma } from '../index';
import { printReceiptSchema } from '@kebab-pos/shared';
import { authenticate } from '../middleware/auth';
import { printReceipt, getPrinterStatus } from '../services/printer';

const router = Router();

// Print receipt
router.post('/receipt', authenticate, async (req, res) => {
  try {
    const validation = printReceiptSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
    }

    const { orderId, printType } = validation.data;

    // Get order with all details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
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

    // Get shop settings
    const settings = await prisma.settings.findUnique({
      where: { id: 'default' },
    });

    // Print receipt
    const result = await printReceipt(order, settings, printType);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to print receipt',
      });
    }

    res.json({
      success: true,
      message: 'Receipt printed successfully',
    });
  } catch (error) {
    console.error('Print receipt error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to print receipt',
    });
  }
});

// Get printer status
router.get('/status', authenticate, async (req, res) => {
  try {
    const status = await getPrinterStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Get printer status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get printer status',
    });
  }
});

export default router;
