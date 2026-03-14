import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

const PoliticaPrivacidade = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-6 hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </button>

        <h1 className="text-2xl font-bold mb-1">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mb-6">Última atualização: Fevereiro de 2025</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-base font-bold mb-2">1. Informações que Coletamos</h2>
            <p>Coletamos informações que você nos fornece diretamente, como nome, endereço de e-mail, endereço de entrega, número de telefone e informações de pagamento quando você realiza uma compra.</p>
            <p className="mt-2">Também coletamos automaticamente certas informações quando você visita nosso site, incluindo seu endereço IP, tipo de navegador, páginas visitadas e tempo de permanência.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">2. Como Usamos suas Informações</h2>
            <p>Utilizamos as informações coletadas para:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Processar e entregar seus pedidos</li>
              <li>Enviar confirmações de pedidos e atualizações de envio</li>
              <li>Responder às suas perguntas e solicitações</li>
              <li>Melhorar nosso site e serviços</li>
              <li>Enviar comunicações de marketing (com seu consentimento)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">3. Compartilhamento de Informações</h2>
            <p>Não vendemos suas informações pessoais. Compartilhamos suas informações apenas com:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Processadores de pagamento para completar transações</li>
              <li>Empresas de logística para entrega de pedidos</li>
              <li>Prestadores de serviços que nos auxiliam na operação do site</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">4. Segurança dos Dados</h2>
            <p>Implementamos medidas de segurança técnicas e organizacionais para proteger suas informações contra acesso não autorizado, alteração, divulgação ou destruição.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">5. Seus Direitos</h2>
            <p>De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir dados incompletos ou incorretos</li>
              <li>Solicitar a exclusão de seus dados</li>
              <li>Revogar seu consentimento a qualquer momento</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">6. Contato</h2>
            <p>Para dúvidas sobre esta política ou para exercer seus direitos, entre em contato conosco:</p>
            <p className="mt-2">E-mail: contato@mesamaleta.com</p>
            <p>RCS Sports Management & Solutions LTDA</p>
            <p>CNPJ: 64.657.491/0001-20</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PoliticaPrivacidade;
