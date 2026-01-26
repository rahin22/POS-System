import { Request, Response, NextFunction } from 'express';
import { verifySupabaseToken } from '../lib/supabase';
import { prisma } from '../index';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    supabaseId?: string;
  };
  // For customer auth - just Supabase user info, no staff User record
  customer?: {
    supabaseId: string;
    email: string;
  };
}

/**
 * Staff/Admin authentication middleware.
 * User MUST exist in the User table (manually created).
 * Does NOT auto-create users - customers can't become staff.
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
      });
    }

    const token = authHeader.substring(7);
    
    // Verify token with Supabase
    const supabaseUser = await verifySupabaseToken(token);
    
    if (!supabaseUser) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
      });
    }

    // Find user in our database - must already exist (manually created)
    const user = await prisma.user.findFirst({
      where: { email: supabaseUser.email },
      select: { id: true, email: true, role: true, isActive: true },
    });

    // If user doesn't exist in User table, they're not staff/admin
    if (!user) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Staff account required.',
      });
    }

    // Check if is_super_admin and update role if needed
    const isSuperAdmin = supabaseUser.user_metadata?.is_super_admin === true ||
                         supabaseUser.app_metadata?.is_super_admin === true;

    let finalUser = user;
    if (isSuperAdmin && user.role !== 'admin') {
      // Update role to admin if user is super admin but wasn't set as admin yet
      finalUser = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'admin' },
        select: { id: true, email: true, role: true, isActive: true },
      });
    }

    if (!finalUser.isActive) {
      return res.status(401).json({
        success: false,
        error: 'User account is inactive',
      });
    }

    req.user = {
      id: finalUser.id,
      email: finalUser.email,
      role: finalUser.role,
      supabaseId: supabaseUser.id,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
    });
  }
};

/**
 * Customer authentication middleware.
 * Just validates Supabase token - doesn't require User table entry.
 * Use for customer-facing endpoints like order tracking.
 */
export const customerAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
      });
    }

    const token = authHeader.substring(7);
    const supabaseUser = await verifySupabaseToken(token);
    
    if (!supabaseUser) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
      });
    }

    req.customer = {
      supabaseId: supabaseUser.id,
      email: supabaseUser.email!,
    };

    next();
  } catch (error) {
    console.error('Customer auth error:', error);
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
    });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const supabaseUser = await verifySupabaseToken(token);
    
    if (supabaseUser) {
      const user = await prisma.user.findFirst({
        where: { email: supabaseUser.email },
        select: { id: true, email: true, role: true, isActive: true },
      });

      if (user && user.isActive) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          supabaseId: supabaseUser.id,
        };
      }
    }

    next();
  } catch (error) {
    next();
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
    }

    next();
  };
};
