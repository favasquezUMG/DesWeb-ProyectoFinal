import { useState } from "react";
import { Plus, Edit, Users, GraduationCap, ShieldAlert, Inbox } from "lucide-react";
import { Card, Btn, Badge, AlertBanner, Input, Select, Textarea, Toggle, EmptyState } from "../../../components/Ui";
import {
  createProgramaBeca,
  updateProgramaBeca,
  type ProgramaBecaDto,
  type ProgramaBecaInput,
  type TipoProgramaBeca,
} from "../../../lib/api";
import { TIPOS_PROGRAMA, TIPO_PROGRAMA_LABEL, formatQ } from "../../../lib/becas";

interface FormPrograma {
  nombre: string;
  tipo: TipoProgramaBeca;
  descripcion: string;
  porcentaje: string;
  cupos: string;
  promedioMinimo: string;
  pierdePorConductaGrave: boolean;
  permiteSolicitud: boolean;
  activo: boolean;
}

function formVacio(): FormPrograma {
  return {
    nombre: "", tipo: "Merito", descripcion: "", porcentaje: "25", cupos: "", promedioMinimo: "",
    pierdePorConductaGrave: true, permiteSolicitud: true, activo: true,
  };
}

function formDesde(p: ProgramaBecaDto): FormPrograma {
  return {
    nombre: p.nombre,
    tipo: p.tipo,
    descripcion: p.descripcion ?? "",
    porcentaje: String(Number(p.porcentaje)),
    cupos: p.cupos === null ? "" : String(p.cupos),
    promedioMinimo: p.promedioMinimo === null ? "" : String(Number(p.promedioMinimo)),
    pierdePorConductaGrave: p.pierdePorConductaGrave,
    permiteSolicitud: p.permiteSolicitud,
    activo: p.activo,
  };
}

export default function ProgramasBeca({ programas, anioLectivo, colegiatura, onCambio }: {
  programas: ProgramaBecaDto[];
  anioLectivo: number;
  colegiatura: number;
  onCambio: (mensaje: string) => Promise<void>;
}) {
  const [editando, setEditando] = useState<ProgramaBecaDto | "nuevo" | null>(null);
  const [form, setForm] = useState<FormPrograma>(formVacio());
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  function abrir(p: ProgramaBecaDto | "nuevo") {
    setEditando(p);
    setForm(p === "nuevo" ? formVacio() : formDesde(p));
    setError("");
  }

  async function guardar() {
    if (!form.nombre.trim()) {
      setError("El nombre del programa es obligatorio.");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      const input: ProgramaBecaInput = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        descripcion: form.descripcion.trim() || null,
        porcentaje: Number(form.porcentaje),
        cupos: form.cupos === "" ? null : Number(form.cupos),
        promedioMinimo: form.promedioMinimo === "" ? null : Number(form.promedioMinimo),
        pierdePorConductaGrave: form.pierdePorConductaGrave,
        permiteSolicitud: form.permiteSolicitud,
        activo: form.activo,
      };
      if (editando === "nuevo") {
        await createProgramaBeca({ ...input, anioLectivo });
        await onCambio(`Programa "${input.nombre}" creado.`);
      } else if (editando) {
        await updateProgramaBeca(editando.programaId, input);
        await onCambio(`Programa "${input.nombre}" actualizado.`);
      }
      setEditando(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el programa.");
    } finally {
      setGuardando(false);
    }
  }

  const set = <K extends keyof FormPrograma>(k: K, v: FormPrograma[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-500 max-w-2xl">
          Cada programa define el descuento, cuántos cupos hay en el ciclo {anioLectivo} y qué se exige para obtener y mantener la beca.
          Cambiar el porcentaje no altera las becas ya otorgadas.
        </p>
        <Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => abrir("nuevo")}>Nuevo programa</Btn>
      </div>

      {editando && (
        <Card className="p-5 border-2 border-primary-200">
          <h3 className="font-semibold text-stone-800 mb-4">{editando === "nuevo" ? `Nuevo programa — ciclo ${anioLectivo}` : `Editar "${editando.nombre}"`}</h3>
          {error && <div className="mb-4"><AlertBanner type="error" message={error} /></div>}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Input label="Nombre" value={form.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Excelencia académica" />
            </div>
            <Select label="Tipo" value={form.tipo} onChange={(e) => set("tipo", e.target.value as TipoProgramaBeca)}>
              {TIPOS_PROGRAMA.map((t) => <option key={t} value={t}>{TIPO_PROGRAMA_LABEL[t]}</option>)}
            </Select>
            <Input label="Descuento" type="number" min="1" max="100" value={form.porcentaje}
              onChange={(e) => set("porcentaje", e.target.value)} suffix={<span className="text-sm">%</span>} />
            <Input label="Cupos del ciclo" type="number" min="1" value={form.cupos}
              onChange={(e) => set("cupos", e.target.value)} placeholder="Sin límite" />
            <Input label="Promedio mínimo" type="number" min="0" max="100" value={form.promedioMinimo}
              onChange={(e) => set("promedioMinimo", e.target.value)} placeholder="No exige" />
            <div className="md:col-span-2">
              <Textarea label="Descripción / requisitos" rows={2} value={form.descripcion}
                onChange={(e) => set("descripcion", e.target.value)} placeholder="A quién va dirigido y qué documentos se piden" />
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-3 mt-4">
            <Toggle checked={form.pierdePorConductaGrave} onChange={(v) => set("pierdePorConductaGrave", v)} label="Se suspende por conducta grave" />
            <Toggle checked={form.permiteSolicitud} onChange={(v) => set("permiteSolicitud", v)} label="Los encargados pueden solicitarla" />
            {editando !== "nuevo" && <Toggle checked={form.activo} onChange={(v) => set("activo", v)} label="Programa abierto" />}
          </div>

          <div className="flex gap-2 justify-end mt-5">
            <Btn variant="outline" size="sm" onClick={() => setEditando(null)} disabled={guardando}>Cancelar</Btn>
            <Btn variant="primary" size="sm" loading={guardando} onClick={guardar}>Guardar programa</Btn>
          </div>
        </Card>
      )}

      {programas.length === 0 && !editando ? (
        <EmptyState icon={<Inbox className="w-10 h-10" />} title={`Sin programas para ${anioLectivo}`}
          description="Cree los programas de beca del ciclo para poder asignar becas y recibir solicitudes." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {programas.map((p) => {
            const porcentaje = Number(p.porcentaje);
            const ocupacion = p.cupos ? Math.min(p.cuposUsados / p.cupos, 1) : 0;
            const lleno = p.cupos !== null && p.cuposUsados >= p.cupos;
            return (
              <Card key={p.programaId} className={`p-5 flex flex-col ${p.activo ? "" : "opacity-60"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-stone-900">{p.nombre}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge variant="primary">{TIPO_PROGRAMA_LABEL[p.tipo]}</Badge>
                      {!p.activo && <Badge variant="neutral">Cerrado</Badge>}
                    </div>
                  </div>
                  <button onClick={() => abrir(p)} className="p-1.5 text-stone-400 hover:text-primary-700 rounded" aria-label="Editar programa">
                    <Edit className="w-4 h-4" />
                  </button>
                </div>

                <p className="font-display text-3xl font-semibold text-primary-700 mt-3">{porcentaje}%</p>
                <p className="text-xs text-stone-500">{formatQ(colegiatura * porcentaje / 100)} de descuento al mes</p>

                <div className="mt-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-stone-500 flex items-center gap-1"><Users className="w-3.5 h-3.5" />Cupos</span>
                    <span className={`font-mono-data ${lleno ? "text-danger-700 font-semibold" : "text-stone-700"}`}>
                      {p.cupos === null ? `${p.cuposUsados} / sin límite` : `${p.cuposUsados} / ${p.cupos}`}
                    </span>
                  </div>
                  {p.cupos !== null && (
                    <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                      <div className={`h-full rounded-full ${lleno ? "bg-danger-600" : "bg-primary-500"}`} style={{ width: `${ocupacion * 100}%` }} />
                    </div>
                  )}
                </div>

                <ul className="mt-4 space-y-1.5 text-xs text-stone-600">
                  <li className="flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5 text-stone-400" />
                    {p.promedioMinimo === null ? "Sin promedio mínimo" : `Promedio mínimo ${Number(p.promedioMinimo)}`}
                  </li>
                  <li className="flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5 text-stone-400" />
                    {p.pierdePorConductaGrave ? "Se suspende con reporte de conducta grave" : "No se afecta por conducta"}
                  </li>
                  <li className="flex items-center gap-1.5"><Inbox className="w-3.5 h-3.5 text-stone-400" />
                    {p.permiteSolicitud ? "Recibe solicitudes de encargados" : "Solo asignación directa"}
                  </li>
                </ul>
                {p.descripcion && <p className="text-xs text-stone-500 mt-3 pt-3 border-t border-stone-100">{p.descripcion}</p>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
