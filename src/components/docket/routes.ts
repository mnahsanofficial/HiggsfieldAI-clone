// Where Docket's pages live. Every link in the app goes through here.
export const ROUTES = {
  home: "/",
  make: "/make",
  log: "/log",
  entry: (id: string) => `/log/${id}`,
  credits: "/credits",
  signIn: "/sign-in",
  signUp: "/sign-up",
} as const;
