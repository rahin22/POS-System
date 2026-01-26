import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Validate a coupon code
router.post('/validate', authenticate, async (req, res) => {
  try {
    const { code, orderTotal } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Coupon code is required',
      });
    }

    const coupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        error: 'Invalid coupon code',
      });
    }

    // Check if active
    if (!coupon.isActive) {
      return res.status(400).json({
        success: false,
        error: 'This coupon is no longer active',
      });
    }

    // Check expiry
    const now = new Date();
    if (coupon.expiresAt && coupon.expiresAt < now) {
      return res.status(400).json({
        success: false,
        error: 'This coupon has expired',
      });
    }

    // Check start date
    if (coupon.startsAt && coupon.startsAt > now) {
      return res.status(400).json({
        success: false,
        error: 'This coupon is not yet valid',
      });
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return res.status(400).json({
        success: false,
        error: 'This coupon has reached its usage limit',
      });
    }

    // Check minimum order amount
    if (coupon.minOrderAmount && orderTotal < coupon.minOrderAmount) {
      return res.status(400).json({
        success: false,
        error: `Minimum order amount of $${coupon.minOrderAmount.toFixed(2)} required`,
      });
    }

    res.json({
      success: true,
      data: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        maxDiscount: coupon.maxDiscount,
      },
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate coupon',
    });
  }
});

// Get all coupons (admin only)
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: coupons,
    });
  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch coupons',
    });
  }
});

// Create coupon (admin only)
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const {
      code,
      type,
      value,
      minOrderAmount,
      maxDiscount,
      usageLimit,
      startsAt,
      expiresAt,
    } = req.body;

    const coupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        type,
        value,
        minOrderAmount,
        maxDiscount,
        usageLimit,
        startsAt: startsAt ? new Date(startsAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    res.json({
      success: true,
      data: coupon,
    });
  } catch (error: any) {
    console.error('Create coupon error:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'Coupon code already exists',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create coupon',
    });
  }
});

// Update coupon (admin only)
router.patch('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      code,
      type,
      value,
      minOrderAmount,
      maxDiscount,
      usageLimit,
      isActive,
      startsAt,
      expiresAt,
    } = req.body;

    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        ...(code && { code: code.toUpperCase() }),
        ...(type && { type }),
        ...(value !== undefined && { value }),
        ...(minOrderAmount !== undefined && { minOrderAmount }),
        ...(maxDiscount !== undefined && { maxDiscount }),
        ...(usageLimit !== undefined && { usageLimit }),
        ...(isActive !== undefined && { isActive }),
        ...(startsAt && { startsAt: new Date(startsAt) }),
        ...(expiresAt && { expiresAt: new Date(expiresAt) }),
      },
    });

    res.json({
      success: true,
      data: coupon,
    });
  } catch (error) {
    console.error('Update coupon error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update coupon',
    });
  }
});

// Delete coupon (admin only)
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.coupon.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Coupon deleted successfully',
    });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete coupon',
    });
  }
});

export default router;
