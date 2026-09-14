import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

//Get All
export const getRoles = async (_req: Request, res: Response) => {
    try {
        const roles = await prisma.rol.findMany();

        return res.json({ status: 'success', data: roles })
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener los roles.', error})
    }
}

//Get by ID
export const getRolById = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const rol = await prisma.rol.findUnique({
            where: { rolId: Number(id) }
        });

        if(!rol){
            return res.status(404).json({ status: 'error', message: `Rol con ID: ${id} no encontrado` })
        }

        return res.json({ status: 'success', data: rol });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al obtener el rol con ID: ${id}.`, error})
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
        return res.status(500).json({ status: 'error', message: 'Error al crear el rol.', error})
    }
}

//Put
export const updateRol = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { nombre } = req.body;

    try {
        if(nombre) {
            const existingRol = await prisma.rol.findUnique({
                where: { nombre: nombre }
            })
            if(existingRol && existingRol.rolId !== Number(id)){
                return res.status(400).json({ status: 'error', message: `El rol ${nombre} ya está registrado. Ingrese otro nombre` })
            }
        }

        const dataToUpdate: any = {};
        if(nombre) dataToUpdate.nombre = nombre;

        const updatedRol = await prisma.rol.update({
            where: { rolId: Number(id) },
            data: dataToUpdate
        });

        return res.json({ status: 'success', data: updatedRol })
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al actualizar el rol con ID ${id}.`, error})
    };
}

//Delete
export const deleteRolById = async (req: Request, res: Response ) => {
    const { id } = req.params;

    try {
        const usuariosConRol = await prisma.usuario.count({
            where: { rolId: Number(id) }
        });

        if(usuariosConRol > 0){
            return res.status(409).json({ status: 'error', message: `No se puede eliminar el rol con ID: ${id} porque existen ${usuariosConRol} usuario(s) asignado(s) a este rol.` });
        }

        await prisma.rol.delete({
            where: { rolId: Number(id) }
        })

        return res.json({ status: 'success', message: `Se eliminó el rol con ID: ${id} correctamente.`});
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al eliminar el rol con ID: ${id}.`, error});
    }
}
