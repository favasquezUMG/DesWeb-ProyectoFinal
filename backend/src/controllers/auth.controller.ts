import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if(!email || !password){
        return res.status(400).json({ status: 'error', message: 'Email and password are required'})
    }

    try{
        //Se busca al usuario
        const user = await prisma.usuario.findFirst({
            where:{
                email,
                deletedAt: null //Se hace por el soft-delete que se va a manejar
            },
            include: {rol: true}
        });

        if(!user){
            return res.status(404).json({ status: 'error', message: 'Invalid credentials'})
        }

        //Se verifica la contraseña
        const validPassword = await bcrypt.compare(password, user.passwordHash)
        if(!validPassword){
            return res.status(400).json({ status: 'error', message: 'Invalid credentials'})
        }

        //Se crea el JWT payload
        const payload = {
            usuarioId: user.usuarioId,
            email: user.email,
            rolId: user.rolId,
            sedeId: user.sedeId
        }

        const secret = process.env.JWT_SECRET || 'secret';
        const expiresIn = (process.env.JWT_EXPIRES_IN || '5m') as jwt.SignOptions['expiresIn'];

        const token = jwt.sign(payload, secret, { expiresIn });
        
        return res.json({
            status: 'success',
            token,
            usuario: {
                usuarioId: user.usuarioId,
                nombre: user.nombres,
                email: user.email,
                rol: user.rol.nombre
            }
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Internal error', error});
    }
}