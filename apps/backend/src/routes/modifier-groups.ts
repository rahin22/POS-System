import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, requireRole } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createModifierGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  isRequired: z.boolean().optional().default(false),
  minSelections: z.number().int().min(0).optional().default(0),
  maxSelections: z.number().int().min(1).optional().default(1),
});

const updateModifierGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isRequired: z.boolean().optional(),
  minSelections: z.number().int().min(0).optional(),
  maxSelections: z.number().int().min(1).optional(),
});

// Get all modifier groups
router.get('/', async (req, res) => {
  try {
    const groups = await prisma.modifierGroup.findMany({
      include: {
        modifiers: {
          orderBy: {
            name: 'asc',
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.json({
      success: true,
      data: groups,
    });
  } catch (error) {
    console.error('Get modifier groups error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get modifier groups',
    });
  }
});

// Get single modifier group
router.get('/:id', async (req, res) => {
  try {
    const group = await prisma.modifierGroup.findUnique({
      where: { id: req.params.id },
      include: {
        modifiers: {
          orderBy: {
            name: 'asc',
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Modifier group not found',
      });
    }

    res.json({
      success: true,
      data: group,
    });
  } catch (error) {
    console.error('Get modifier group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get modifier group',
    });
  }
});

// Create modifier group (admin/manager only)
router.post('/', authenticate, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const validation = createModifierGroupSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
    }

    const group = await prisma.modifierGroup.create({
      data: validation.data,
      include: {
        modifiers: true,
      },
    });

    res.status(201).json({
      success: true,
      data: group,
    });
  } catch (error) {
    console.error('Create modifier group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create modifier group',
    });
  }
});

// Update modifier group (admin/manager only)
router.put('/:id', authenticate, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const validation = updateModifierGroupSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
    }

    const group = await prisma.modifierGroup.update({
      where: { id: req.params.id },
      data: validation.data,
      include: {
        modifiers: true,
      },
    });

    res.json({
      success: true,
      data: group,
    });
  } catch (error) {
    console.error('Update modifier group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update modifier group',
    });
  }
});

// Delete modifier group (admin only)
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    // Check if group has modifiers
    const group = await prisma.modifierGroup.findUnique({
      where: { id: req.params.id },
      include: { modifiers: true },
    });

    if (group && group.modifiers.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete group with modifiers',
      });
    }

    await prisma.modifierGroup.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: 'Modifier group deleted',
    });
  } catch (error) {
    console.error('Delete modifier group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete modifier group',
    });
  }
});

export default router;
