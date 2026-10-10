import { useEffect, useState } from "react";
import { Modal, Btn, AlertBanner, Input, Select } from "../../components/Ui";
import { createActividad, updateActividad, type ActividadDto, type LibretaDto, type TipoActividad } from "../../lib/api";
import { PUNTEO_POR_TIPO, TIPO_LABEL, UNIDAD_LABEL, actividadesPorTipo, errorMsg, hoyISO, redondear, sumaPuntos } from "./shared";

// Qué se abre: una actividad nueva en una unidad (con tipo sugerido) o una existente para editar
export type ActividadEnEdicion =
  | { unidadId: number; tipo: TipoActividad; actividad?: undefined }
  | { unidadId: number; actividad: ActividadDto; tipo?: undefined };

interface Form {
  nombre: string;
  tipo: TipoActividad;
  puntosMaximos: string;
  fecha: string;
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
      ? { nombre: a.nombre, tipo: a.tipo, puntosMaximos: String(a.puntosMaximos), fecha: a.fecha ?? hoyISO() }
      : { nombre: edicion.tipo === "Examen" ? "Examen de unidad" : "", tipo: edicion.tipo, puntosMaximos: "", fecha: hoyISO() });
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
    setGuardando(true);
    setError("");
    try {
      const datos = { nombre: form.nombre.trim(), tipo: form.tipo, puntosMaximos: puntos, fecha: form.fecha };
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
        <Input label="Fecha" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
      </div>
    </Modal>
  );
}
