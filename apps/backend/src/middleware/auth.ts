import { Request, Response, NextFunction } from 'express';
import { verifySupabaseToken, type TokenCheck } from '../lib/supabase';
import { prisma } from '../index';

/**
 * Turn a refused token into a response, and say so in the log.
 *
 * Every rejection used to be a silent 401 "Invalid token", so a device quietly
 * sitting on an expired session looked identical to a Supabase outage and neither
 * left a trace to diagnose from.
 */
const rejectToken = (req: Request, res: Response, check: TokenCheck) => {
  const where = `${req.method} ${req.originalUrl}`;

  // Not the caller's fault - do not tell a device its session is bad when the real
  // problem is that we could not ask.
  if (check.reason === 'auth_unreachable') {
    console.error(`[auth] Supabase auth unreachable on ${where}: ${check.detail}`);
    return res.status(503).json({
      success: false,
      error: 'Authentication service unavailable. Please try again.',
      code: 'auth_unreachable',
    });
  }

  console.warn(`[auth] Rejected token on ${where} (${check.reason}): ${check.detail}`);

  return res.status(401).json({
    success: false,
    error: check.reason === 'token_expired' ? 'Session expired' : 'Invalid token',
    code: check.reason,
  });
};

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
    const check = await verifySupabaseToken(token);
    const supabaseUser = check.user;

    if (!supabaseUser) {
      return rejectToken(req, res, check);
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
    const check = await verifySupabaseToken(token);
    const supabaseUser = check.user;

    if (!supabaseUser) {
      return rejectToken(req, res, check);
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
    const { user: supabaseUser } = await verifySupabaseToken(token);

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
