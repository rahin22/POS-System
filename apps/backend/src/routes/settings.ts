import { Router } from 'express';
import { prisma } from '../index';
import { settingsSchema } from '@kebab-pos/shared';
import { authenticate, requireRole } from '../middleware/auth';
import { cachedQuery, cache, CACHE_KEYS } from '../services/cache';

const router = Router();

// Get settings
router.get('/', async (req, res) => {
  try {
    const settings = await cachedQuery(
      CACHE_KEYS.SETTINGS,
      async () => {
        let settings = await prisma.settings.findUnique({
          where: { id: 'default' },
        });

        // Create default settings if not exists
        if (!settings) {
          settings = await prisma.settings.create({
            data: { id: 'default' },
          });
        }

        return settings;
      },
      600 // Cache settings for 10 minutes
    );

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get settings',
    });
  }
});

// Update settings (admin only)
router.put('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const validation = settingsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
    }

    const settings = await prisma.settings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        ...validation.data,
      },
      update: validation.data,
    });

    // Invalidate settings cache
    cache.del(CACHE_KEYS.SETTINGS);
    console.log('[CACHE] Settings cache invalidated');

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings',
    });
  }
});

export default router;
