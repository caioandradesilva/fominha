import { Suspense } from "react";
import { InviteScreen } from "@/components/InvitePage";
import { Splash } from "@/components/SignedIn";

export default function Page() {
  return (
    <Suspense fallback={<Splash />}>
      <InviteScreen />
    </Suspense>
  );
}
