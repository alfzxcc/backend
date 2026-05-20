import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  switch (true) {
    case typeof err === 'string': {
      // Custom application error
      const is404 = err.toLowerCase().endsWith('not found');
      const statusCode = is404 ? 404 : 400;
      return res.status(statusCode).json({ message: err });
    }

    case err.name === 'UnauthorizedError':
      // JWT auth error
      return res.status(401).json({ message: 'Unauthorized' });

    case err.name === 'ValidationError':
      // Sequelize validation error
      return res.status(400).json({ message: err.message });

    default:
      return res.status(500).json({ message: err.message });
  }
}
