import { Suspense } from "react";
import { EventScreen } from "@/components/EventPage";
import { Splash } from "@/components/SignedIn";

export default function Page() {
  return (
    <Suspense fallback={<Splash />}>
      <EventScreen />
    </Suspense>
  );
}
