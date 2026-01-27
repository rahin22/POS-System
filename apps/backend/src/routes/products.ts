import { Router } from 'express';
import { prisma } from '../index';
import { createProductSchema, updateProductSchema } from '@kebab-pos/shared';
import { authenticate, requireRole } from '../middleware/auth';
import { cachedQuery, CACHE_KEYS, invalidateProductCache } from '../services/cache';

const router = Router();

// Get all products
router.get('/', async (req, res) => {
  try {
    const { categoryId, available } = req.query;

    // Use cache for listing all available products (most common POS query)
    const cacheKey = categoryId 
      ? `${CACHE_KEYS.PRODUCTS}_${categoryId}_${available}` 
      : available === 'true' 
        ? CACHE_KEYS.PRODUCTS_WITH_MODIFIERS 
        : CACHE_KEYS.PRODUCTS;

    const transformedProducts = await cachedQuery(cacheKey, async () => {
      const products = await prisma.product.findMany({
        where: {
          ...(categoryId && { categoryId: categoryId as string }),
          ...(available === 'true' && { isAvailable: true }),
        },
        include: {
          category: true,
          modifierGroups: {
            include: {
              modifierGroup: {
                include: {
                  modifiers: {
                    where: { isAvailable: true },
                  },
                },
              },
            },
          },
        },
        orderBy: [
          { category: { sortOrder: 'asc' } },
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
      });

      // Transform modifier groups
      type ProductWithGroups = typeof products[number];
      type ModifierGroupJoin = ProductWithGroups['modifierGroups'][number];
      return products.map((product: ProductWithGroups) => ({
        ...product,
        modifierGroups: product.modifierGroups.map((pmg: ModifierGroupJoin) => pmg.modifierGroup),
      }));
    });

    res.json({
      success: true,
      data: transformedProducts,
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get products',
    });
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        modifierGroups: {
          include: {
            modifierGroup: {
              include: {
                modifiers: {
                  where: { isAvailable: true },
                },
              },
            },
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    type ModifierGroupJoin = typeof product.modifierGroups[number];
    res.json({
      success: true,
      data: {
        ...product,
        modifierGroups: product.modifierGroups.map((pmg: ModifierGroupJoin) => pmg.modifierGroup),
      },
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get product',
    });
  }
});

// Create product (admin/manager only)
router.post('/', authenticate, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const validation = createProductSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
    }

    const product = await prisma.product.create({
      data: validation.data,
      include: {
        category: true,
      },
    });

    // Invalidate product cache
    invalidateProductCache();

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create product',
    });
  }
});

// Update product (admin/manager only)
router.put('/:id', authenticate, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const validation = updateProductSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: validation.data,
      include: {
        category: true,
      },
    });

    // Invalidate product cache
    invalidateProductCache();

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update product',
    });
  }
});

// Delete product (admin only)
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    await prisma.product.delete({
      where: { id: req.params.id },
    });

    // Invalidate product cache
    invalidateProductCache();

    res.json({
      success: true,
      message: 'Product deleted',
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete product',
    });
  }
});

// Toggle availability
router.patch('/:id/availability', authenticate, requireRole('admin', 'manager', 'staff'), async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: { isAvailable: !product.isAvailable },
    });

    // Invalidate product cache
    invalidateProductCache();

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Toggle availability error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle availability',
    });
  }
});

// Update product modifier groups
router.put('/:id/modifier-groups', authenticate, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { modifierGroupIds } = req.body;

    if (!Array.isArray(modifierGroupIds)) {
      return res.status(400).json({
        success: false,
        error: 'modifierGroupIds must be an array',
      });
    }

    // Delete existing associations
    await prisma.productModifierGroup.deleteMany({
      where: { productId: req.params.id },
    });

    // Create new associations
    if (modifierGroupIds.length > 0) {
      await prisma.productModifierGroup.createMany({
        data: modifierGroupIds.map((groupId: string) => ({
          productId: req.params.id,
          modifierGroupId: groupId,
        })),
      });
    }

    // Get updated product with modifier groups
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        modifierGroups: {
          include: {
            modifierGroup: {
              include: {
                modifiers: true,
              },
            },
          },
        },
      },
    });

    // Invalidate product cache
    invalidateProductCache();

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Update modifier groups error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update modifier groups',
    });
  }
});

export default router;
