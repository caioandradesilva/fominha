import { Suspense } from "react";
import { NewEventScreen } from "@/components/NewEvent";
import { Splash } from "@/components/SignedIn";

export default function Page() {
  return (
    <Suspense fallback={<Splash />}>
      <NewEventScreen />
    </Suspense>
  );
}
