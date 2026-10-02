import type { Request, Response, NextFunction } from 'express'; //Resolver este problema******
import jwt from 'jsonwebtoken';

//Una simple interface
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        rolId: string;
        sedeId?: string;
    };
}


//Metodo que autentifica el token generado
export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if(!token){
        return res.status(401).json({status: 'error', message: 'Access denied: no token provied'})
    }

    try{
        const secret = process.env.JWT_SECRET || 'secret';
        const decode = jwt.verify(token, secret) as NonNullable<AuthenticatedRequest['user']> & { usuarioId?: number };
        // El JWT trae usuarioId; se expone tambien como id, que es lo que usan los controladores
        req.user = { ...decode, id: String(decode.usuarioId ?? decode.id) };
        next();
    } catch (error) {
        return res.status(403).json({
            status: 'error', message: 'Token expired or invalid'
        })
    };
}