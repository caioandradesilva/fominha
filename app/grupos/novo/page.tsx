"use client";

import { NewGroup } from "@/components/NewGroup";
import { SignedIn } from "@/components/SignedIn";

export default function Page() {
  return <SignedIn>{(profile) => <NewGroup profile={profile} />}</SignedIn>;
}
