// Stand-in for @/lib/db in unit tests. The pure functions in lib/tola.ts
// never touch `db` at import time, so an empty stub keeps the tests fast
// and free of Prisma. Route/db behaviour is covered by scripts/check-routes.sh.
export const db = {} as never;
