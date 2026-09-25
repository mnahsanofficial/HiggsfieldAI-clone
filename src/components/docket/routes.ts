// Where Docket's pages live. /make, /log and /log/<id> are already their final paths; home and
// credits sit under /next while the old UI still owns / and /credits. Switch-over edits this
// file and moves two folders, and nothing else.
// Until a page exists, its route points at the nearest live one, so nothing links to a 404:
// credits and sign-in fall back to the old pages. Each later branch
// points its route at the real page as it lands.
export const ROUTES = {
  home: "/next",
  make: "/make",
  log: "/log",
  entry: (id: string) => `/log/${id}`,
  credits: "/credits",
  signIn: "/login",
  signUp: "/signup",
} as const;
