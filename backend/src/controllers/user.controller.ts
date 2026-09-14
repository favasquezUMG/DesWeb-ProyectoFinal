import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

//Get All
export const getUsers = async (_req: Request, res: Response) => {
    try {
        const users = await prisma.usuario.findMany({
            where: { deletedAt: null },
            select: {
                usuarioId: true,
                nombres: true,
                apellidos: true,
                email: true,
                rolId: true,
                sedeId: true,
                rol: {
                    select: { nombre: true}
                },
                sede: {
                    select: { nombre: true}
                }
            }
        });

        return res.json({ status: 'success', data: users })
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener los usuarios.', error})
    }
}

//Get by ID
export const getUserById = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const user = await prisma.usuario.findFirst({
            where: { 
                usuarioId: Number(id),
                deletedAt: null
            },
            include: { rol: true, sede: true }
        });

        if(!user){
            return res.status(404).json({ status: 'error', message: `Usuario con ID: ${id} no encontrado` })
        }

        return res.json({ status: 'success', data: user });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al obtener el usuario con ID: ${id}.`, error})
    }
}

//Post create
export const createUser = async (req: Request, res: Response ) => {
    const { nombres, apellidos, email, password, rolId, sedeId } = req.body;

    if(!nombres || !apellidos || !email || !password || !rolId) {
        return res.status(400).json({ status: 'error', message: 'Faltan campos obligatorios para crear un usuario' });
    }

    try {
        const existingEmail = await prisma.usuario.findFirst({
            where: { email: email }
        })
        if(existingEmail){
            return res.status(400).json({ status: 'error', message: `El correo ${email} ya está registrado. Ingrese otro correo` })
        }

        const passwordHash = await bcrypt.hash(password, 10);
        
        const newUser = await prisma.usuario.create({
            data: {
                nombres,
                apellidos,
                email,
                passwordHash,
                rolId: Number(rolId),
                sedeId: sedeId ? Number(sedeId) : null 
            }
        });

        return res.status(200).json({
            status: 'success',
            data: {
                id: newUser.usuarioId,
                email: newUser.email,
                password: ':D'
            }
        })
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al crear el usuario.', error})
    }
}

//Put
export const updateUser = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { nombres, apellidos, email, password, rolId, sedeId } = req.body;

    try {
        const dataToUpdate: any = {};
        if(nombres) dataToUpdate.nombres = nombres;
        if(apellidos) dataToUpdate.apellidos = apellidos;
        if(email) dataToUpdate.email = email;
        if(rolId) dataToUpdate.rolId = Number(rolId);
        if(sedeId !== undefined) dataToUpdate.sedeId = sedeId ? Number(sedeId) : null;
        if(password) dataToUpdate.passwordHash = await bcrypt.hash(password, 10);

        const updatedUser = await prisma.usuario.update({
            where: { usuarioId: Number(id) },
            data: dataToUpdate
        });

        return res.json({ status: 'success', data: updatedUser })
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al actualizar el usuario con ID ${id}.`, error})
    };
}

//Delete
export const deleteUserById = async (req: Request, res: Response ) => {
    const { id } = req.params;

    try {
        //No se elimina como tal, solo se le hace un soft-delete
        await prisma.usuario.update({
            where: { usuarioId: Number(id) },
            data: { deletedAt: new Date() }
        })

        return res.json({ status: 'success', message: `Se eliminó el usuario con ID: ${id} correctamente.`});
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al eliminnar al usuario con ID: ${id}.`, error});
    }
}