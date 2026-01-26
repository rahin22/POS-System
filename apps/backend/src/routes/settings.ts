import { Router } from 'express';
import { prisma } from '../index';
import { settingsSchema } from '@kebab-pos/shared';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Get settings
router.get('/', async (req, res) => {
  try {
    let settings = await prisma.settings.findUnique({
      where: { id: 'default' },
    });

    // Create default settings if not exists
    if (!settings) {
      settings = await prisma.settings.create({
        data: { id: 'default' },
      });
    }

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
