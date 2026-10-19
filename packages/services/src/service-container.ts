import type { ServiceKey } from './service-key';

export interface ServiceContainer {
  register<Service>(key: ServiceKey<Service>, instance: Service): void;
  resolve<Service>(key: ServiceKey<Service>): Service;
}

// Holds instances, never creates them: the shell's bootstrap (or a standalone remote's) builds each service
// and registers it once.
export function createServiceContainer(): ServiceContainer {
  const instances = new Map<string, unknown>();

  return {
    register(key, instance) {
      instances.set(key, instance);
    },
    resolve<Service>(key: ServiceKey<Service>) {
      if (!instances.has(key)) throw new Error(`Service "${key}" is not registered`);
      // Safe by construction: register() stored a value of the type carried by this key.
      return instances.get(key) as Service;
    },
  };
}
