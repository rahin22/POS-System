import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, requireRole } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createModifierSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  price: z.number().min(0, 'Price must be positive'),
  groupId: z.string().min(1, 'Group is required'),
  isAvailable: z.boolean().optional().default(true),
});

const updateModifierSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  price: z.number().min(0).optional(),
  groupId: z.string().optional(),
  isAvailable: z.boolean().optional(),
});

// Get all modifiers
router.get('/', async (req, res) => {
  try {
    const modifiers = await prisma.modifier.findMany({
      include: {
        group: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.json({
      success: true,
      data: modifiers,
    });
  } catch (error) {
    console.error('Get modifiers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get modifiers',
    });
  }
});

// Get single modifier
router.get('/:id', async (req, res) => {
  try {
    const modifier = await prisma.modifier.findUnique({
      where: { id: req.params.id },
      include: {
        group: true,
      },
    });

    if (!modifier) {
      return res.status(404).json({
        success: false,
        error: 'Modifier not found',
      });
    }

    res.json({
      success: true,
      data: modifier,
    });
  } catch (error) {
    console.error('Get modifier error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get modifier',
    });
  }
});

// Create modifier (admin/manager only)
router.post('/', authenticate, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const validation = createModifierSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
    }

    const modifier = await prisma.modifier.create({
      data: validation.data,
      include: {
        group: true,
      },
    });

    res.status(201).json({
      success: true,
      data: modifier,
    });
  } catch (error) {
    console.error('Create modifier error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create modifier',
    });
  }
});

// Update modifier (admin/manager only)
router.put('/:id', authenticate, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const validation = updateModifierSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
    }

    const modifier = await prisma.modifier.update({
      where: { id: req.params.id },
      data: validation.data,
      include: {
        group: true,
      },
    });

    res.json({
      success: true,
      data: modifier,
    });
  } catch (error) {
    console.error('Update modifier error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update modifier',
    });
  }
});

// Delete modifier (admin only)
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    // Check if modifier is used in any orders
    const orderItemsWithModifier = await prisma.orderItemModifier.count({
      where: { modifierId: req.params.id },
    });

    if (orderItemsWithModifier > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete modifier: it is used in ${orderItemsWithModifier} order item(s). Consider marking it as unavailable instead.`,
      });
    }

    await prisma.modifier.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: 'Modifier deleted',
    });
  } catch (error) {
    console.error('Delete modifier error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete modifier',
    });
  }
});

export default router;
