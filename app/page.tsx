"use client";

import { Home } from "@/components/Home";
import { SignedIn } from "@/components/SignedIn";

export default function Page() {
  return <SignedIn>{(profile) => <Home profile={profile} />}</SignedIn>;
}
