import { Request, Response, NextFunction } from 'express'; //Resolver este problema******
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        rolId: string;
        sedeId?: string;
    };
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFuntion) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if(!token){
        return res.status(401).json({status: 'error', message: 'Access denied: no token provied'})
    }

    try{
        const secret = process.env.JWT_SECRET || 'secret';
        const decode = jwt.verify(token, secret) as AuthenticatedRequest['user'];
        req.user = decode;
        next();
    } catch (error) {
        return res.status(403).json({
            status: 'error', message: 'Token expired or invalid'
        })
    };
}