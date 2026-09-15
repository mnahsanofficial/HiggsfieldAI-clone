import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ffmpeg-installer resolves its platform binary package with a dynamic require, which
  // the bundler can't follow. Load it with Node's require at runtime instead...
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg"],
  // ...and make sure the Linux binary is traced into the functions that render video.
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/@ffmpeg-installer/linux-x64/**/*", "./node_modules/@ffmpeg-installer/ffmpeg/**/*"],
  },
};

export default nextConfig;
