import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const parseId = (id: unknown): number | null => {
    if (typeof id !== 'string' || !/^\d+$/.test(id)) return null;
    return Number(id);
};

const errorMessage = (error: unknown): string => {
    return error instanceof Error ? error.message : 'Error desconocido';
};

const handlePrismaError = (res: Response, error: unknown, notFoundMessage: string, serverMessage: string) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return res.status(404).json({ status: 'error', message: notFoundMessage });
    }
    return res.status(500).json({ status: 'error', message: serverMessage, error: errorMessage(error) });
};

//Get All
export const getRoles = async (_req: Request, res: Response) => {
    try {
        const roles = await prisma.rol.findMany();

        return res.json({ status: 'success', data: roles })
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener los roles.', error: errorMessage(error) })
    }
}

//Get by ID
export const getRolById = async (req: Request, res: Response) => {
    const { id } = req.params;

    const rolId = parseId(id);
    if(rolId === null){
        return res.status(400).json({ status: 'error', message: `El ID: ${id} no es un número válido` });
    }

    try {
        const rol = await prisma.rol.findUnique({
            where: { rolId }
        });

        if(!rol){
            return res.status(404).json({ status: 'error', message: `Rol con ID: ${id} no encontrado` })
        }

        return res.json({ status: 'success', data: rol });
    } catch (error) {
        return handlePrismaError(res, error, `Rol con ID: ${id} no encontrado`, `Error al obtener el rol con ID: ${id}.`);
    }
}

//Post create
export const createRol = async (req: Request, res: Response ) => {
    const { nombre } = req.body;

    if(!nombre) {
        return res.status(400).json({ status: 'error', message: 'Faltan campos obligatorios para crear un rol' });
    }

    try {
        const existingRol = await prisma.rol.findUnique({
            where: { nombre: nombre }
        })
        if(existingRol){
            return res.status(400).json({ status: 'error', message: `El rol ${nombre} ya está registrado. Ingrese otro nombre` })
        }

        const newRol = await prisma.rol.create({
            data: { nombre }
        });

        return res.status(200).json({ status: 'success', data: newRol })
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al crear el rol.', error: errorMessage(error) })
    }
}

//Put
export const updateRol = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { nombre } = req.body;

    const rolId = parseId(id);
    if(rolId === null){
        return res.status(400).json({ status: 'error', message: `El ID: ${id} no es un número válido` });
    }

    try {
        const existingRolById = await prisma.rol.findUnique({
            where: { rolId }
        });
        if(!existingRolById){
            return res.status(404).json({ status: 'error', message: `Rol con ID: ${id} no encontrado` });
        }

        if(nombre) {
            const existingRol = await prisma.rol.findUnique({
                where: { nombre: nombre }
            })
            if(existingRol && existingRol.rolId !== rolId){
                return res.status(400).json({ status: 'error', message: `El rol ${nombre} ya está registrado. Ingrese otro nombre` })
            }
        }

        const dataToUpdate: any = {};
        if(nombre) dataToUpdate.nombre = nombre;

        const updatedRol = await prisma.rol.update({
            where: { rolId },
            data: dataToUpdate
        });

        return res.json({ status: 'success', data: updatedRol })
    } catch (error) {
        return handlePrismaError(res, error, `Rol con ID: ${id} no encontrado`, `Error al actualizar el rol con ID ${id}.`);
    };
}

//Delete
export const deleteRolById = async (req: Request, res: Response ) => {
    const { id } = req.params;

    const rolId = parseId(id);
    if(rolId === null){
        return res.status(400).json({ status: 'error', message: `El ID: ${id} no es un número válido` });
    }

    try {
        const existingRol = await prisma.rol.findUnique({
            where: { rolId }
        });
        if(!existingRol){
            return res.status(404).json({ status: 'error', message: `Rol con ID: ${id} no encontrado` });
        }

        const usuariosConRol = await prisma.usuario.count({
            where: { rolId }
        });

        if(usuariosConRol > 0){
            return res.status(409).json({ status: 'error', message: `No se puede eliminar el rol con ID: ${id} porque existen ${usuariosConRol} usuario(s) asignado(s) a este rol.` });
        }

        await prisma.rol.delete({
            where: { rolId }
        })

        return res.json({ status: 'success', message: `Se eliminó el rol con ID: ${id} correctamente.`});
    } catch (error) {
        return handlePrismaError(res, error, `Rol con ID: ${id} no encontrado`, `Error al eliminar el rol con ID: ${id}.`);
    }
}
