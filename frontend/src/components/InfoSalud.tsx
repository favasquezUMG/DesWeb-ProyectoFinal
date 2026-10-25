import { useEffect, useState } from "react";
import { Heart } from "./Iconos";
import { Badge, Btn, Modal, Textarea, AlertBanner } from "./Ui";
import type { DatosSaludDto } from "../lib/api";

export const SALUD_VACIA: DatosSaludDto = { necesidadesApoyo: null, alergias: null, medicamentos: null };

const CAMPOS: { campo: keyof DatosSaludDto; label: string; placeholder: string }[] = [
  {
    campo: "necesidadesApoyo",
    label: "Discapacidad, condición de salud o necesidad de apoyo",
    placeholder: "Ej. asma, diabetes, discapacidad auditiva, TDAH… y qué apoyo necesita",
  },
  { campo: "alergias", label: "Alergias", placeholder: "Ej. penicilina, maní, picadura de abeja" },
  { campo: "medicamentos", label: "Medicamentos", placeholder: "Ej. inhalador de salbutamol en crisis de asma" },
];

export const tieneSalud = (s?: Partial<DatosSaludDto> | null) =>
  !!s && CAMPOS.some(({ campo }) => !!s[campo]?.trim());

/** Marca junto al nombre del alumno cuando tiene información de salud registrada */
export function IndicadorSalud({ salud, onClick }: { salud: Partial<DatosSaludDto>; onClick?: () => void }) {
  if (!tieneSalud(salud)) return null;
  const resumen = CAMPOS.filter(({ campo }) => salud[campo]).map(({ label, campo }) => `${label}: ${salud[campo]}`).join("\n");
  const insignia = <Badge variant="danger"><Heart className="w-3 h-3" />Salud</Badge>;
  if (!onClick) return <span title={resumen}>{insignia}</span>;
  return (
    <button type="button" onClick={onClick} title={resumen} aria-label="Ver información de salud" className="cursor-pointer">
      {insignia}
    </button>
  );
}

export function DetalleSalud({ salud }: { salud: Partial<DatosSaludDto> }) {
  return (
    <dl className="space-y-3">
      {CAMPOS.map(({ campo, label }) => (
        <div key={campo}>
          <dt className="text-[13px] font-semibold text-stone-500">{label}</dt>
          <dd className={`text-sm whitespace-pre-line ${salud[campo] ? "text-stone-900" : "text-stone-400"}`}>{salud[campo] || "No indicado"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CamposSalud({ valor, onChange }: { valor: DatosSaludDto; onChange: (v: DatosSaludDto) => void }) {
  return (
    <div className="space-y-4">
      {CAMPOS.map(({ campo, label, placeholder }) => (
        <Textarea key={campo} label={label} rows={2} maxLength={500} placeholder={placeholder}
          value={valor[campo] ?? ""} onChange={(e) => onChange({ ...valor, [campo]: e.target.value })} />
      ))}
    </div>
  );
}

const limpiar = (s: DatosSaludDto): DatosSaludDto => ({
  necesidadesApoyo: s.necesidadesApoyo?.trim() || null,
  alergias: s.alergias?.trim() || null,
  medicamentos: s.medicamentos?.trim() || null,
});

/** Ver la información de salud y, si se pasa onGuardar, editarla */
export function ModalSalud({ alumno, salud, onCerrar, onGuardar }: {
  alumno: string | null;
  salud: Partial<DatosSaludDto>;
  onCerrar: () => void;
  onGuardar?: (datos: DatosSaludDto) => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState<DatosSaludDto>(SALUD_VACIA);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setEditando(!!onGuardar && !tieneSalud(salud));
    setValor({ ...SALUD_VACIA, ...salud });
    setError("");
    // Se reinicia solo al abrir el modal de otro alumno, no en cada render del padre
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumno]);

  async function guardar() {
    if (!onGuardar) return;
    setGuardando(true);
    setError("");
    try {
      await onGuardar(limpiar(valor));
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la información de salud.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal open={!!alumno} onClose={() => !guardando && onCerrar()} title={`Salud de ${alumno ?? ""}`}
      footer={editando ? <>
        <Btn variant="ghost" onClick={onCerrar} disabled={guardando}>Cancelar</Btn>
        <Btn variant="primary" loading={guardando} onClick={guardar}>Guardar</Btn>
      </> : onGuardar ? <Btn variant="outline" onClick={() => setEditando(true)}>Editar</Btn> : undefined}>
      <div className="space-y-4">
        {editando ? <CamposSalud valor={valor} onChange={setValor} /> : <DetalleSalud salud={salud} />}
        <p className="text-xs text-stone-400">
          Esta información la ven la sede, los catedráticos del alumno y sus encargados, para atenderlo en clase y en una emergencia.
        </p>
        {error && <AlertBanner type="error" message={error} />}
      </div>
    </Modal>
  );
}
