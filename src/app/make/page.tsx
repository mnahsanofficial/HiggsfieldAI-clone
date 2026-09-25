import { MakePage } from "@/components/docket/make/make-page";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getMakeData } from "@/lib/docket/make-data";
import { clientIp, hashIp } from "@/lib/jobs/image-quota";
import { headers } from "next/headers";

export const metadata = { title: "Make" };

// /make?mode=move&still=<assetId>&move=<presetId>&prompt=... so any page can hand off into the
// loop: "move the camera over this image", or "make this again".
export default async function Make({ searchParams }: PageProps<"/make">) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);
  const data = await getMakeData(await getCurrentUser(), hashIp(clientIp(await headers())));
  const stillId = one(q.still);
  // With no images left today, open where the page can still do something: camera moves, as home
  // does. An explicit ?mode=image or a prompt to make again still opens the image form.
  const outOfImages = Math.min(data.quota.siteLeft, data.quota.yoursLeft) === 0;
  return (
    <MakePage
      data={data}
      initialMode={one(q.mode) === "move" || stillId || (outOfImages && one(q.mode) !== "image" && !one(q.prompt)) ? "move" : "image"}
      initialStillId={stillId && data.stills.some((s) => s.id === stillId) ? stillId : null}
      initialMoveId={one(q.move)}
      initialPrompt={(one(q.prompt) ?? "").slice(0, 2000)}
    />
  );
}
