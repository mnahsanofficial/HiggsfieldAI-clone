import { readMedia } from "@/lib/storage";

// Serves private Blob media. Pathnames carry a random suffix and are never reused, so the
// response is immutable and cached at the CDN for a year; the function only runs on a miss.
// Byte ranges are supported because Safari (including iOS) won't play <video> without them.
const IMMUTABLE = "public, max-age=31536000, s-maxage=31536000, immutable";

export async function GET(request: Request, { params }: RouteContext<"/media/[...path]">) {
  const { path } = await params;
  const media = await readMedia(path.join("/"));
  if (!media) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=60" } });

  const range = request.headers.get("range");
  const match = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!match) {
    return new Response(media.stream, {
      headers: {
        "Content-Type": media.contentType,
        "Content-Length": String(media.size),
        "Accept-Ranges": "bytes",
        "Cache-Control": IMMUTABLE,
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  // Media here is small (images, and videos of a few MB), so slicing a buffered copy is fine.
  const body = Buffer.from(await new Response(media.stream).arrayBuffer());
  const size = body.length;
  let start = match[1] === "" ? size - Number(match[2]) : Number(match[1]);
  let end = match[1] !== "" && match[2] !== "" ? Number(match[2]) : size - 1;
  start = Math.max(0, start);
  end = Math.min(end, size - 1);
  if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  return new Response(new Uint8Array(body.subarray(start, end + 1)), {
    status: 206,
    headers: {
      "Content-Type": media.contentType,
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": IMMUTABLE,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
