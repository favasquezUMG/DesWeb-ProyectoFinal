import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

//El JWT trae usuarioId (ver auth.controller); authenticateToken lo copia tambien en id
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        usuarioId?: number;
        email: string;
        rolId: string | number;
        sedeId?: string | number | null;
    };
}


export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if(!token){
        return res.status(401).json({status: 'error', message: 'Access denied: no token provied'})
    }

    try{
        const secret = process.env.JWT_SECRET || 'secret';
        const decode = jwt.verify(token, secret) as NonNullable<AuthenticatedRequest['user']> & { usuarioId?: number };
        req.user = { ...decode, id: String(decode.usuarioId ?? decode.id) };
        next();
    } catch (error) {
        return res.status(403).json({
            status: 'error', message: 'Token expired or invalid'
        })
    };
}