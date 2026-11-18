import { Suspense } from "react";
import { GroupScreen } from "@/components/GroupPage";
import { Splash } from "@/components/SignedIn";

export default function Page() {
  return (
    <Suspense fallback={<Splash />}>
      <GroupScreen />
    </Suspense>
  );
}
