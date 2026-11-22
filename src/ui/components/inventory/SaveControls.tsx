import { useState } from "react";
import { useGameStore } from "../../../store/useGameStore";
import { FIELD, HEADING, ROW, SMALL_BUTTON, TEXT_KO, TEXT_OK } from "./inventoryTheme";

interface ImportState {
  raw: string;
  ok: boolean | null;
}

interface ImportApi {
  state: ImportState;
  onChange: (raw: string) => void;
  submit: () => void;
}

function noticeClass(ok: boolean): string {
  return ok ? TEXT_OK : TEXT_KO;
}

/** Retour visuel booléen : « réussie » / « refusée », rien avant le premier essai. */
function BoolNotice({ ok, label }: { ok: boolean | null; label: string }) {
  if (ok === null) return null;
  return <p className={`text-[10px] ${noticeClass(ok)}`}>{label} {ok ? "réussie" : "refusée"}</p>;
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={SMALL_BUTTON}>{label}</button>;
}

function ExportArea({ json }: { json: string }) {
  if (json === "") return null;
  return <textarea readOnly rows={3} value={json} aria-label="Sauvegarde exportée" className={FIELD} />;
}

function ExportControl() {
  const exportJson = useGameStore((state) => state.exportJson);
  const [exported, setExported] = useState("");
  return (
    <div className={ROW}>
      <ActionButton label="Exporter" onClick={() => setExported(exportJson() ?? "")} />
      <ExportArea json={exported} />
    </div>
  );
}

function useImport(): ImportApi {
  const importJson = useGameStore((state) => state.importJson);
  const [state, setState] = useState<ImportState>({ raw: "", ok: null });
  const onChange = (raw: string) => setState({ raw, ok: null });
  const submit = () => setState((current) => ({ ...current, ok: importJson(current.raw) }));
  return { state, onChange, submit };
}

function ImportArea({ value, onChange }: { value: string; onChange: (raw: string) => void }) {
  return (
    <textarea rows={3} value={value} aria-label="Sauvegarde à importer" placeholder="Colle un export JSON" className={FIELD} onChange={(event) => onChange(event.target.value)} />
  );
}

function ImportControl() {
  const { state, onChange, submit } = useImport();
  return (
    <div className={ROW}>
      <ImportArea value={state.raw} onChange={onChange} />
      <ActionButton label="Importer" onClick={submit} />
      <BoolNotice ok={state.ok} label="Import" />
    </div>
  );
}

function SaveControl() {
  const saveGame = useGameStore((state) => state.saveGame);
  const [ok, setOk] = useState<boolean | null>(null);
  return (
    <div className={ROW}>
      <ActionButton label="Sauvegarder" onClick={() => setOk(saveGame())} />
      <BoolNotice ok={ok} label="Sauvegarde" />
    </div>
  );
}

/** Exporter (JSON en lecture), importer (colle + valide) et sauvegarder le slot. */
export default function SaveControls() {
  return (
    <section aria-label="Sauvegarde" className="flex flex-col gap-1">
      <h3 className={HEADING}>Sauvegarde</h3>
      <ExportControl />
      <ImportControl />
      <SaveControl />
    </section>
  );
}
