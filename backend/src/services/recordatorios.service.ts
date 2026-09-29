import type { Evento } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { plantillaRecordatorioEvento } from "../templates/mail.templates.js";
import { encargadosDeAlumnos, enviarADestinatarios, type Destinatario } from "./notificacion.service.js";

// Se leen al usarse (no al importar) porque dotenv.config() corre despues de los imports en server.ts
const zonaHoraria = () => process.env.COLEGIO_ZONA_HORARIA || "America/Guatemala";
const horaEnvio = () => Number(process.env.RECORDATORIOS_HORA ?? 7);
const INTERVALO_REVISION_MS = 30 * 60 * 1000;
const UN_DIA_MS = 24 * 60 * 60 * 1000;

// Fecha de hoy (YYYY-MM-DD) en la zona del colegio, como medianoche UTC igual que las columnas @db.Date
const hoyEnZonaColegio = (): Date => {
    const fecha = new Intl.DateTimeFormat("en-CA", {
        timeZone: zonaHoraria(),
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
    return new Date(`${fecha}T00:00:00.000Z`);
};

const horaEnZonaColegio = (): number =>
    Number(
        new Intl.DateTimeFormat("en-US", { timeZone: zonaHoraria(), hour: "2-digit", hourCycle: "h23" }).format(new Date())
    );

// Los recordatorios van a los encargados de la sede del evento (o de todas si el evento es general)
export const destinatariosDeEvento = (evento: Pick<Evento, "sedeId">): Promise<Destinatario[]> =>
    encargadosDeAlumnos(evento.sedeId ? { seccion: { sedeId: evento.sedeId } } : {});

export const enviarRecordatorioEvento = (evento: Evento, destinatarios: Destinatario[]) => {
    const manana = new Date(hoyEnZonaColegio().getTime() + UN_DIA_MS);
    const esManana = new Date(evento.fecha).getTime() === manana.getTime();

    return enviarADestinatarios(
        destinatarios,
        (d) =>
            plantillaRecordatorioEvento({
                nombreDestinatario: d.nombre,
                nombreEvento: evento.nombre,
                fecha: evento.fecha,
                descripcion: evento.descripcion,
                esManana,
            }),
        "Evento"
    );
};

// Busca los eventos de mañana que aun no tienen recordatorio y los envia
export const procesarRecordatoriosPendientes = async () => {
    const manana = new Date(hoyEnZonaColegio().getTime() + UN_DIA_MS);
    const pasadoManana = new Date(manana.getTime() + UN_DIA_MS);

    const eventos = await prisma.evento.findMany({
        where: {
            fecha: { gte: manana, lt: pasadoManana },
            enviarRecordatorio: true,
            recordatorioEnviadoEn: null,
        },
    });

    for (const evento of eventos) {
        // Se "reserva" el evento antes de enviar para no mandarlo dos veces si otra revision corre a la vez
        const { count } = await prisma.evento.updateMany({
            where: { eventoId: evento.eventoId, recordatorioEnviadoEn: null },
            data: { recordatorioEnviadoEn: new Date() },
        });
        if (count === 0) continue;

        const destinatarios = await destinatariosDeEvento(evento);
        const { enviados, fallidos } = await enviarRecordatorioEvento(evento, destinatarios);
        console.log(`📅 Recordatorio "${evento.nombre}": ${enviados} enviados, ${fallidos} fallidos.`);
    }
};

// Revisa cada 30 minutos; a partir de la hora configurada envia los recordatorios del dia siguiente.
// Si el servidor estuvo apagado a esa hora, los envia en cuanto vuelve a levantar.
export const iniciarRecordatoriosEventos = () => {
    const revisar = () => {
        if (horaEnZonaColegio() < horaEnvio()) return;
        procesarRecordatoriosPendientes().catch((error) => {
            console.error("❌ Error al procesar los recordatorios de eventos:", error);
        });
    };

    revisar();
    setInterval(revisar, INTERVALO_REVISION_MS).unref();
    console.log(`⏰ Recordatorios de eventos activos (a partir de las ${horaEnvio()}:00, ${zonaHoraria()}).`);
};
