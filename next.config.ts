import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ffmpeg-installer resolves its platform binary package with a dynamic require, which
  // the bundler can't follow. Load it with Node's require at runtime instead...
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg"],
  // ...and make sure the Linux binary is traced into the functions that render video.
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/@ffmpeg-installer/linux-x64/**/*", "./node_modules/@ffmpeg-installer/ffmpeg/**/*"],
  },
  // The app was a Higgsfield clone before it became Docket. Earlier submissions and walkthroughs
  // link to its URLs, so every one of them lands on the Docket page that does the same job.
  // Query strings carry over (?prompt= keeps working); specific rules come first.
  async redirects() {
    const q = (key: string) => [{ type: "query" as const, key, value: "(?<v>.+)" }];
    return [
      { source: "/ai/video", has: q("image"), destination: "/make?mode=move&still=:v", permanent: true },
      { source: "/ai/video", has: q("preset"), destination: "/make?mode=move&move=:v", permanent: true },
      { source: "/ai/video", destination: "/make?mode=move", permanent: true },
      { source: "/ai/image", destination: "/make", permanent: true },
      { source: "/ai/:path*", destination: "/make", permanent: true },
      { source: "/assets", destination: "/log", permanent: true },
      { source: "/pricing", destination: "/credits", permanent: true },
      { source: "/login", destination: "/sign-in", permanent: true },
      { source: "/signup", destination: "/sign-up", permanent: true },
      { source: "/explore", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
