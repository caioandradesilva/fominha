import type { Metadata } from "next";
import { CONTACT_EMAIL, CONTACT_INSTAGRAM, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Política de Privacidade · Rodizium" };

export default function Page() {
  return (
    <LegalPage title="Política de Privacidade" updated="27 de novembro de 2026">
      <p>
        O Rodizium é um app para grupos de amigos registrarem quantas peças cada um come no rodízio e verem o placar. Esta página explica,
        de forma direta, quais dados usamos, para quê e quais são os seus direitos pela Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).
      </p>

      <h2>Quais dados coletamos</h2>
      <ul>
        <li><strong>Conta:</strong> o apelido que você escolhe. Se entrar com e-mail, o seu e-mail. Se entrar com Google, o nome, o e-mail e a foto do perfil que o Google compartilha.</li>
        <li><strong>Uso do app:</strong> grupos que você cria ou entra, eventos (nome, restaurante, data), registros de peças, correções e quem as fez.</li>
        <li><strong>Fotos:</strong> as fotos de pratos e barcas que você tira no app para a contagem.</li>
        <li><strong>Lista de espera</strong> (site rodizium.com.br): nome, e-mail, telefone (opcional), cidade, estado, rodízios preferidos e o recorde que você informar.</li>
      </ul>

      <h2>Para que usamos</h2>
      <ul>
        <li>Fazer o app funcionar: entrar na sua conta, montar os grupos, contar as peças e mostrar o placar.</li>
        <li>Contar as peças das fotos com inteligência artificial.</li>
        <li>Enviar o código de acesso por e-mail quando você pede para entrar.</li>
        <li>Avisar quem está na lista de espera sobre o lançamento e novidades do Rodizium.</li>
        <li>Melhorar o app a partir de dados de uso agregados.</li>
      </ul>
      <p>Não vendemos seus dados e não mostramos anúncios.</p>

      <h2>Quem vê o quê</h2>
      <p>
        Os membros de um grupo veem o apelido, os registros, as correções e as fotos dos eventos desse grupo. Pessoas de fora do grupo não
        veem nada disso.
      </p>

      <h2>Empresas que tratam dados para nós</h2>
      <p>Usamos serviços de terceiros que processam dados em nosso nome, alguns com servidores fora do Brasil (principalmente nos Estados Unidos):</p>
      <ul>
        <li><strong>Supabase:</strong> banco de dados, login e armazenamento das fotos.</li>
        <li><strong>Vercel:</strong> hospedagem do app e do site.</li>
        <li><strong>Anthropic:</strong> a inteligência artificial que recebe a foto para contar as peças.</li>
        <li><strong>Resend:</strong> envio dos e-mails com o código de acesso.</li>
        <li><strong>Google:</strong> apenas se você escolher entrar com a conta Google.</li>
      </ul>

      <h2>Por quanto tempo guardamos</h2>
      <p>
        Enquanto sua conta existir ou enquanto você estiver na lista de espera. Se pedir a exclusão, apagamos sua conta, seus registros e suas
        fotos, salvo o que a lei obrigar a manter.
      </p>

      <h2>Seus direitos</h2>
      <p>
        Você pode pedir a qualquer momento: confirmação e acesso aos seus dados, correção, exclusão, portabilidade, informações sobre com quem
        compartilhamos e a revogação do consentimento (por exemplo, sair da lista de espera).
      </p>

      <h2>Contato</h2>
      <p>
        Para qualquer pedido sobre seus dados, escreva para <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Também
        respondemos pelo Instagram <a href={CONTACT_INSTAGRAM}>@rodizium.app</a>.
      </p>

      <h2>Mudanças nesta política</h2>
      <p>Se esta política mudar, atualizamos a data no topo da página e avisamos no app quando a mudança for relevante.</p>
    </LegalPage>
  );
}
