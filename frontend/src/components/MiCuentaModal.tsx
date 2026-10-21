import { useState } from "react";
import { KeyRound } from "lucide-react";
import type { AppUser } from "../types";
import { Modal, Btn, Input, AlertBanner } from "./Ui";
import { cambiarPassword } from "../lib/api";

const vacio = { actual: "", nueva: "", confirmar: "" };

// Datos de la cuenta en solo lectura (los corrige la administración de la sede)
// y cambio de la propia contraseña.
export default function MiCuentaModal({ open, onClose, user, rol }: {
  open: boolean;
  onClose: () => void;
  user: AppUser;
  rol: string;
}) {
  const [form, setForm] = useState(vacio);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [guardando, setGuardando] = useState(false);

  function cerrar() {
    if (guardando) return;
    setForm(vacio);
    setError("");
    setExito("");
    onClose();
  }

  async function handleGuardar() {
    setError("");
    setExito("");
    if (!form.actual || !form.nueva) {
      setError("Complete la contraseña actual y la nueva.");
      return;
    }
    if (form.nueva.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (form.nueva !== form.confirmar) {
      setError("La confirmación no coincide con la nueva contraseña.");
      return;
    }

    setGuardando(true);
    try {
      const res = await cambiarPassword(form.actual, form.nueva);
      setExito(res.message);
      setForm(vacio);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setGuardando(false);
    }
  }

  const datos: Array<[string, string | undefined]> = [
    ["Nombre", user.name],
    ["Correo", user.email],
    ["Rol", rol],
    ["Sede", user.sede],
  ];

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title="Mi cuenta"
      footer={
        <>
          <Btn variant="outline" size="sm" onClick={cerrar} disabled={guardando}>Cerrar</Btn>
          <Btn variant="primary" size="sm" loading={guardando} icon={<KeyRound className="w-4 h-4" />} onClick={handleGuardar}>
            Cambiar contraseña
          </Btn>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {datos.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-stone-500">{k}</dt>
                <dd className="text-stone-900 font-medium break-all">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-stone-500 mt-3">
            Para corregir sus datos personales comuníquese con la administración de su sede.
          </p>
        </div>

        <div className="border-t border-stone-100 pt-4 space-y-3">
          <h3 className="font-semibold text-stone-800 text-sm">Cambiar contraseña</h3>
          {error && <AlertBanner type="error" message={error} />}
          {exito && <AlertBanner type="success" message={exito} />}
          <Input label="Contraseña actual" type="password" autoComplete="current-password" value={form.actual}
            onChange={(e) => setForm((f) => ({ ...f, actual: e.target.value }))} />
          <Input label="Nueva contraseña" type="password" autoComplete="new-password" hint="Mínimo 8 caracteres." value={form.nueva}
            onChange={(e) => setForm((f) => ({ ...f, nueva: e.target.value }))} />
          <Input label="Confirmar nueva contraseña" type="password" autoComplete="new-password" value={form.confirmar}
            onChange={(e) => setForm((f) => ({ ...f, confirmar: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter") handleGuardar(); }} />
        </div>
      </div>
    </Modal>
  );
}
