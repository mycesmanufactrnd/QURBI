// TypeORM throws on `undefined` values inside a `where` clause (as opposed to
// `null`, which is a valid "IS NULL" filter). Optional query-param filters
// naturally come through as undefined when omitted, so controllers pass their
// filter objects through this before handing them to a service/repository.
export function stripUndefined<T extends object>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}
