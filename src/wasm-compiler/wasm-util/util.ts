export const typedFromEntries = <
  const T extends readonly [PropertyKey, unknown][]
>(
  entries: T
) => Object.fromEntries(entries) as { [K in T[number] as K[0]]: K[1] };
