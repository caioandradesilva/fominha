import type { Metadata } from "next";
import { Waitlist } from "@/components/Waitlist";

export const metadata: Metadata = {
  title: "Rodizium · Lista de espera",
  description: "Rodízio agora tem placar. Tira foto do prato, a IA conta as peças e o ranking mostra quem mandou melhor.",
  openGraph: {
    title: "Rodizium · Rodízio agora tem placar",
    description: "Entra na lista de espera e seja dos primeiros a desafiar seus amigos.",
    siteName: "Rodizium",
    locale: "pt_BR",
    type: "website",
  },
};

export default function Page() {
  return <Waitlist />;
}
