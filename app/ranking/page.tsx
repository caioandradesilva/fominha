import { Suspense } from "react";
import { RankingScreen } from "@/components/RankingPage";
import { Splash } from "@/components/SignedIn";

export default function Page() {
  return (
    <Suspense fallback={<Splash />}>
      <RankingScreen />
    </Suspense>
  );
}
