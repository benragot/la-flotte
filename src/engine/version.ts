export function formatGameVersion(raw: string): string {
  const version = raw.trim();
  if (version.length === 0) throw new Error("Version vide.");
  return version.startsWith("v") ? version : `v${version}`;
}
