// Shape of the runtime share scope: package name → version → entry.
// webpack/module.d.ts types it one level too shallow, so it is declared here.
interface SharedVersionEntry {
  from: string;
  eager?: boolean;
  loaded?: 1;
}

type ShareScope = Record<string, Record<string, SharedVersionEntry>>;

declare const __webpack_share_scopes__: Record<string, ShareScope | undefined>;

interface SharedModuleRow {
  package: string;
  version: string;
  providedBy: string;
  loaded: boolean;
  eager: boolean;
}

declare global {
  interface Window {
    __mfDebug?: () => void;
  }
}

function getSharedModuleRows(scopeName: string): SharedModuleRow[] {
  const scope = __webpack_share_scopes__[scopeName] ?? {};

  return Object.entries(scope).flatMap(([packageName, versions]) =>
    Object.entries(versions).map(([version, entry]) => ({
      package: packageName,
      version,
      providedBy: entry.from,
      loaded: Boolean(entry.loaded),
      eager: Boolean(entry.eager),
    })),
  );
}

export function installMfDebug() {
  window.__mfDebug = () => console.table(getSharedModuleRows('default'));
}
