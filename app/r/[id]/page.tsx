import { Suspense } from "react";
import { RestaurantScreen } from "@/components/RestaurantPage";
import { Splash } from "@/components/SignedIn";

export default function Page() {
  return (
    <Suspense fallback={<Splash />}>
      <RestaurantScreen />
    </Suspense>
  );
}
