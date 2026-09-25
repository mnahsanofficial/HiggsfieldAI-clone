import "server-only";
import { ImageResponse } from "next/og";
import { readMedia } from "@/lib/storage";

// The share card: the real frame (an image, or a video's poster frame) beside what it is,
// in Docket's colours. 1200x630, the size every major preview uses.
export const OG_SIZE = { width: 1200, height: 630 };

export async function frameDataUri(mediaUrl: string | null | undefined): Promise<string | null> {
  if (!mediaUrl?.startsWith("/media/")) return null;
  const media = await readMedia(mediaUrl.replace(/^\/media\//, ""));
  if (!media) return null;
  const bytes = Buffer.from(await new Response(media.stream).arrayBuffer());
  return `data:${media.contentType};base64,${bytes.toString("base64")}`;
}

export function shareCard({ frames, title, lines }: { frames: (string | null)[]; title: string; lines: string[] }) {
  const shown = frames.filter((f): f is string => !!f);
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#fcfcfa", color: "#14161a", padding: 40, gap: 36 }}>
        <div style={{ display: "flex", width: 560, height: 550, gap: 8, flexShrink: 0 }}>
          {shown.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img>
            <img key={i} src={src} alt="" width={shown.length === 1 ? 560 : 276} height={550} style={{ objectFit: "cover", borderRadius: 18 }} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, paddingTop: 8, paddingBottom: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 50, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1 }}>{title}</div>
            {lines.map((l) => (
              <div key={l} style={{ fontSize: 26, color: "#595e66", lineHeight: 1.35 }}>
                {l}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>Docket</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
