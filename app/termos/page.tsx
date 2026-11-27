import type { Metadata } from "next";
import { CONTACT_EMAIL, CONTACT_INSTAGRAM, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Termos de Uso · Rodizium" };

export default function Page() {
  return (
    <LegalPage title="Termos de Uso" updated="27 de novembro de 2026">
      <p>Ao usar o Rodizium você concorda com estes termos. Eles são curtos de propósito.</p>

      <h2>O que é o Rodizium</h2>
      <p>
        Um app para grupos de amigos registrarem as peças que comem no rodízio e verem um placar. O app está em fase de testes: pode mudar,
        ficar fora do ar ou ter erros, e é oferecido como está, sem garantia.
      </p>

      <h2>Contagem por IA</h2>
      <p>
        A contagem das fotos é feita por inteligência artificial e pode errar. O placar é uma brincadeira entre amigos; os membros e admins do
        grupo podem corrigir os registros.
      </p>

      <h2>Coma com responsabilidade</h2>
      <p>O Rodizium não incentiva comer além do seu limite. Respeite o seu corpo e as regras do restaurante.</p>

      <h2>Sua conta e seu conteúdo</h2>
      <ul>
        <li>Você é responsável pelo que registra e pelas fotos que envia. Fotografe só a comida e não envie conteúdo ofensivo ou de terceiros sem permissão.</li>
        <li>Você nos autoriza a guardar e processar as fotos e registros para o app funcionar, como descrito na <a href="/privacidade">Política de Privacidade</a>.</li>
        <li>Podemos suspender contas que usem o app de forma abusiva.</li>
      </ul>

      <h2>Contato</h2>
      <p>
        Dúvidas sobre estes termos: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> ou Instagram{" "}
        <a href={CONTACT_INSTAGRAM}>@rodizium.app</a>.
      </p>
    </LegalPage>
  );
}
