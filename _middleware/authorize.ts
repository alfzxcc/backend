import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../_helpers/db';

export function authorize(roles: string | string[] = []) {
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return [
    // Authenticate JWT token
    (req: Request, res: Response, next: NextFunction) => {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      try {
        const jwtSecret = process.env.JWT_SECRET || 'WALA_RA_GD';
        const decoded = jwt.verify(token, jwtSecret) as any;
        (req as any).user = { id: decoded.id };
        next();
      } catch {
        return res.status(401).json({ message: 'Unauthorized' });
      }
    },
    // Authorize role
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const account = await db.Account.findByPk((req as any).user.id);
        if (!account || (roles.length && !(roles as string[]).includes(account.role))) {
          return res.status(401).json({ message: 'Unauthorized' });
        }
        (req as any).user.role = account.role;
        (req as any).user.ownsToken = (token: string) =>
          !!account.refreshTokens?.find((x: any) => x.token === token);
        next();
      } catch (err) {
        next(err);
      }
    }
  ];
}
