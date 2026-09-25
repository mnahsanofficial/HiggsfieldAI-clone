import { homePair } from "@/lib/docket/home-pair";
import { frameDataUri, OG_SIZE, shareCard } from "@/lib/og/card";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "A frame from a camera move Docket rendered over a library image";

// Home's share image: the poster frame of a real camera move from the library, beside the headline.
export default async function Image() {
  const pair = await homePair();
  return shareCard({
    frames: pair ? [await frameDataUri(pair.take.posterUrl)] : [],
    title: "Docket makes an image, then moves the camera over it.",
    lines: ["Every run stays on the record: the model that ran, what it cost, and any refund."],
  });
}
