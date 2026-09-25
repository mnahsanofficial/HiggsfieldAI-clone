import { headers } from "next/headers";
import { HomePage } from "@/components/docket/home/home-page";
import { getCurrentUser } from "@/lib/auth/current-user";
import { liveRendersFor } from "@/lib/billing/limits";
import { homeData } from "@/lib/docket/home-data";
import { clientIp, hashIp } from "@/lib/jobs/image-quota";

const HOME_TITLE = "Docket: make an image, then move the camera over it";
const HOME_DESCRIPTION = "Images from FLUX.1 [schnell], camera moves rendered with ffmpeg, and every run on the record: the model that ran, what it cost, and any refund.";

export const metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  openGraph: { title: HOME_TITLE, description: HOME_DESCRIPTION, type: "website", siteName: "Docket", url: "/" },
  twitter: { card: "summary_large_image", title: HOME_TITLE, description: HOME_DESCRIPTION },
};

// No loading boundary here: home's first HTML is the page itself, headline first, so crawlers,
// share previews and screen readers get the real content, not a skeleton.

export default async function Home() {
  const user = await getCurrentUser();
  const data = await homeData(user, hashIp(clientIp(await headers())));
  return <HomePage data={data} signedIn={!!user} registered={user?.kind === "registered"} balanceTenths={user?.creditBalanceTenths ?? null} liveRendersWithAccount={liveRendersFor("registered")} />;
}
