"use client";

import { AccountPage } from "@/components/AccountPage";
import { SignedIn } from "@/components/SignedIn";

export default function Page() {
  return <SignedIn>{(profile) => <AccountPage profile={profile} />}</SignedIn>;
}
