import type { Metadata } from "next";
import { Landing } from "@/components/Landing";

export const metadata: Metadata = {
  title: "Rodizium · Rodízio agora tem placar",
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
  return <Landing />;
}
