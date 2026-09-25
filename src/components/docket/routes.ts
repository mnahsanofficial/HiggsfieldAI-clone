// Where Docket's pages live. /make, /log and /log/<id> are already their final paths; home and
// credits sit under /next while the old UI still owns / and /credits. Switch-over edits this
// file and moves two folders, and nothing else.
export const ROUTES = {
  home: "/next",
  make: "/make",
  log: "/log",
  entry: (id: string) => `/log/${id}`,
  credits: "/next/credits",
  signIn: "/sign-in",
  signUp: "/sign-up",
} as const;
