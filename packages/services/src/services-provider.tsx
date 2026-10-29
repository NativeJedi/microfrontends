import { createContext, type ReactNode, useContext } from 'react';
import type { ServiceContainer } from './service-container';
import type { ServiceKey } from './service-key';

// One context object for the whole page only because this package is an MF shared singleton.
// An app that bundles its own copy gets a different context and lands in the error below.
const ServicesContext = createContext<ServiceContainer | null>(null);

interface ServicesProviderProps {
  container: ServiceContainer;
  children: ReactNode;
}

export function ServicesProvider({ container, children }: ServicesProviderProps) {
  return <ServicesContext.Provider value={container}>{children}</ServicesContext.Provider>;
}

export function useService<Service>(key: ServiceKey<Service>): Service {
  const container = useContext(ServicesContext);
  if (!container) {
    throw new Error(
      `useService("${key}") has no <ServicesProvider> above it. Is @mf/services a shared singleton in this app?`,
    );
  }
  return container.resolve(key);
}
