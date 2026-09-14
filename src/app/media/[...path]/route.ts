import { readMedia } from "@/lib/storage";

// Serves private Blob media. Pathnames carry a random suffix and are never reused, so the
// response is immutable and cached at the CDN for a year; the function only runs on a miss.
export async function GET(_request: Request, { params }: RouteContext<"/media/[...path]">) {
  const { path } = await params;
  const media = await readMedia(path.join("/"));
  if (!media) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
  return new Response(media.stream, {
    headers: {
      "Content-Type": media.contentType,
      "Content-Length": String(media.size),
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
