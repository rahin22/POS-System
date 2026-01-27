import { Router } from 'express';
import { prisma } from '../index';
import { createCategorySchema, updateCategorySchema } from '@kebab-pos/shared';
import { authenticate, requireRole } from '../middleware/auth';
import { cachedQuery, cache, CACHE_KEYS } from '../services/cache';

const router = Router();

// Helper to invalidate category cache
const invalidateCategoryCache = () => {
  const keys = cache.keys();
  keys.forEach((key) => {
    if (key.startsWith('categories')) {
      cache.del(key);
    }
  });
  console.log('[CACHE] Category cache invalidated');
};

// Get all categories
router.get('/', async (req, res) => {
  try {
    const { active } = req.query;
    const cacheKey = active === 'true' ? `${CACHE_KEYS.CATEGORIES}_active` : CACHE_KEYS.CATEGORIES;

    const categories = await cachedQuery(cacheKey, () =>
      prisma.category.findMany({
        where: {
          ...(active === 'true' && { isActive: true }),
        },
        include: {
          _count: {
            select: { products: true },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      })
    );

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get categories',
    });
  }
});

// Get single category with products
router.get('/:id', async (req, res) => {
  try {
    const category = await prisma.category.findUnique({
      where: { id: req.params.id },
      include: {
        products: {
          where: { isAvailable: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      });
    }

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get category',
    });
  }
});

// Create category (admin/manager only)
router.post('/', authenticate, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const validation = createCategorySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
    }

    const category = await prisma.category.create({
      data: validation.data,
    });

    // Invalidate category cache
    invalidateCategoryCache();

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create category',
    });
  }
});

// Update category (admin/manager only)
router.put('/:id', authenticate, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const validation = updateCategorySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
    }

    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: validation.data,
    });

    // Invalidate category cache
    invalidateCategoryCache();

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update category',
    });
  }
});

// Delete category (admin only)
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    // Check if category has products
    const productCount = await prisma.product.count({
      where: { categoryId: req.params.id },
    });

    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete category with products. Move or delete products first.',
      });
    }

    await prisma.category.delete({
      where: { id: req.params.id },
    });

    // Invalidate category cache
    invalidateCategoryCache();

    res.json({
      success: true,
      message: 'Category deleted',
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete category',
    });
  }
});

export default router;
