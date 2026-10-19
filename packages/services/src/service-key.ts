// A key is its name. Workspace packages are bundled into every app, so an object or Symbol key created in
// one app's bundle is a different value in another app's bundle; a string is equal everywhere.
// The phantom type parameter only carries the service type for resolve().
export type ServiceKey<Service> = string & { readonly __service?: Service };

export function defineServiceKey<Service>(name: string): ServiceKey<Service> {
  return name;
}
