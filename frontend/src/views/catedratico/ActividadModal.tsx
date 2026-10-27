import { useEffect, useState } from "react";
import { Modal, Btn, AlertBanner, Input, Select, Textarea } from "../../components/Ui";
import { createActividad, updateActividad, type ActividadDto, type LibretaDto, type TipoActividad } from "../../lib/api";
import { PUNTEO_POR_TIPO, TIPO_LABEL, UNIDAD_LABEL, actividadesPorTipo, errorMsg, hoyISO, isoALocal, limitePorDefecto, redondear, sumaPuntos } from "./shared";

// Qué se abre: una actividad nueva en una unidad (con tipo sugerido) o una existente para editar.
// enLinea marca de entrada la opción de recibir entregas en línea.
export type ActividadEnEdicion =
  | { unidadId: number; tipo: TipoActividad; actividad?: undefined; enLinea?: boolean }
  | { unidadId: number; actividad: ActividadDto; tipo?: undefined; enLinea?: boolean };

interface Form {
  nombre: string;
  tipo: TipoActividad;
  puntosMaximos: string;
  fecha: string;
  aceptaEntregas: boolean;
  instrucciones: string;
  fechaLimite: string; // "YYYY-MM-DDTHH:mm" en hora local
  permiteAtrasadas: boolean;
}

export default function ActividadModal({ libreta, edicion, onClose, onGuardado }: {
  libreta: LibretaDto;
  edicion: ActividadEnEdicion | null;
  onClose: () => void;
  onGuardado: () => Promise<void> | void;
}) {
  const [form, setForm] = useState<Form | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    if (!edicion) return setForm(null);
    const a = edicion.actividad;
    setForm(a
      ? {
        nombre: a.nombre, tipo: a.tipo, puntosMaximos: String(a.puntosMaximos), fecha: a.fecha ?? hoyISO(),
        aceptaEntregas: a.aceptaEntregas || !!edicion.enLinea, instrucciones: a.instrucciones ?? "",
        fechaLimite: a.fechaLimite ? isoALocal(a.fechaLimite) : limitePorDefecto(), permiteAtrasadas: a.permiteAtrasadas,
      }
      : {
        nombre: edicion.tipo === "Examen" ? "Examen de unidad" : "", tipo: edicion.tipo, puntosMaximos: "", fecha: hoyISO(),
        aceptaEntregas: !!edicion.enLinea, instrucciones: "", fechaLimite: limitePorDefecto(), permiteAtrasadas: true,
      });
  }, [edicion]);

  if (!edicion || !form) return null;

  const unidad = libreta.unidades.find((u) => u.unidadId === edicion.unidadId);
  const otras = (unidad?.actividades ?? []).filter((a) => a.actividadId !== edicion.actividad?.actividadId);
  const disponible = redondear(PUNTEO_POR_TIPO[form.tipo] - sumaPuntos(actividadesPorTipo(otras, form.tipo)));

  async function handleGuardar() {
    if (!form || !edicion) return;
    const puntos = Number(form.puntosMaximos);
    if (!form.nombre.trim() || !form.fecha || !puntos || puntos <= 0) {
      setError("Complete el nombre, la fecha y un punteo mayor a 0.");
      return;
    }
    if (form.aceptaEntregas && !form.fechaLimite) {
      setError("Indique la fecha y hora límite de entrega.");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      // En una tarea en línea la fecha de la actividad es el día de la fecha límite
      const datos = {
        nombre: form.nombre.trim(), tipo: form.tipo, puntosMaximos: puntos,
        fecha: form.aceptaEntregas ? form.fechaLimite.slice(0, 10) : form.fecha,
        aceptaEntregas: form.aceptaEntregas,
        ...(form.aceptaEntregas ? {
          instrucciones: form.instrucciones.trim() || null,
          fechaLimite: new Date(form.fechaLimite).toISOString(),
          permiteAtrasadas: form.permiteAtrasadas,
        } : {}),
      };
      if (edicion.actividad) await updateActividad(edicion.actividad.actividadId, datos);
      else await createActividad({ ...datos, unidadId: edicion.unidadId });
      await onGuardado();
      onClose();
    } catch (err) {
      setError(errorMsg(err, "No se pudo guardar la actividad."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${edicion.actividad ? "Editar" : "Nueva"} actividad — ${unidad ? UNIDAD_LABEL[unidad.numero] ?? `Unidad ${unidad.numero}` : ""}`}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" loading={guardando} onClick={handleGuardar}>Guardar</Btn>
        </>
      }
    >
      <div className="space-y-4">
        {error && <AlertBanner type="error" message={error} />}
        <Select label="Tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoActividad })}>
          {(Object.keys(PUNTEO_POR_TIPO) as TipoActividad[]).map((t) => (
            <option key={t} value={t}>{TIPO_LABEL[t]} (hasta {PUNTEO_POR_TIPO[t]} pts por unidad)</option>
          ))}
        </Select>
        <Input
          label="Nombre"
          value={form.nombre}
          maxLength={100}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          placeholder={form.tipo === "Examen" ? "Ej. Examen de unidad" : "Ej. Tarea 1, Proyecto, Laboratorio"}
        />
        <Input
          label="Punteo"
          type="number" min="0.5" step="0.5"
          value={form.puntosMaximos}
          onChange={(e) => setForm({ ...form, puntosMaximos: e.target.value })}
          hint={`Disponibles en ${form.tipo === "Zona" ? "la zona" : "el examen"} de esta unidad: ${Math.max(0, disponible)} de ${PUNTEO_POR_TIPO[form.tipo]} puntos`}
        />
        <label className="flex items-start gap-3 rounded-2xl border-[1.5px] border-stone-200 p-3.5 cursor-pointer has-[:checked]:border-primary-600 has-[:checked]:bg-primary-50/50">
          <input type="checkbox" className="w-4 h-4 mt-0.5 accent-primary-700" checked={form.aceptaEntregas}
            onChange={(e) => setForm({ ...form, aceptaEntregas: e.target.checked })} />
          <span>
            <span className="block text-sm font-semibold text-stone-900">Recibir entregas en línea</span>
            <span className="block text-[13px] text-stone-500">Los alumnos suben su trabajo desde el portal (en Primaria, su encargado) y usted lo califica desde "Tareas y entregas".</span>
          </span>
        </label>
        {form.aceptaEntregas ? (
          <>
            <Input label="Fecha y hora límite" type="datetime-local" value={form.fechaLimite}
              onChange={(e) => setForm({ ...form, fechaLimite: e.target.value })} />
            <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-primary-700" checked={form.permiteAtrasadas}
                onChange={(e) => setForm({ ...form, permiteAtrasadas: e.target.checked })} />
              Aceptar entregas después de la fecha límite (quedan marcadas como tarde)
            </label>
            <Textarea label="Instrucciones" rows={4} maxLength={4000} value={form.instrucciones}
              onChange={(e) => setForm({ ...form, instrucciones: e.target.value })}
              placeholder="Qué deben hacer, formato de entrega, criterios de calificación..." />
            <p className="text-[13px] text-stone-500">Los archivos de apoyo (guías, lecturas) se agregan desde "Tareas y entregas" después de guardar.</p>
          </>
        ) : (
          <Input label="Fecha" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
        )}
      </div>
    </Modal>
  );
}
