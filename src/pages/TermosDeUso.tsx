import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

const TermosDeUso = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-6 hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </button>

        <h1 className="text-2xl font-bold mb-1">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mb-6">Última atualização: Fevereiro de 2025</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-base font-bold mb-2">1. Aceitação dos Termos</h2>
            <p>Ao acessar e usar este site, você aceita e concorda em cumprir estes Termos de Uso. Se você não concordar com qualquer parte destes termos, não deve usar nosso site.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">2. Uso do Site</h2>
            <p>Você concorda em usar este site apenas para fins legais e de maneira que não:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Viole qualquer lei ou regulamento aplicável</li>
              <li>Infrinja os direitos de terceiros</li>
              <li>Interfira no funcionamento adequado do site</li>
              <li>Tente acessar áreas restritas do site sem autorização</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">3. Produtos e Preços</h2>
            <p>Nos esforçamos para garantir que as informações sobre produtos e preços sejam precisas. No entanto, erros podem ocorrer. Reservamo-nos o direito de corrigir quaisquer erros e alterar preços a qualquer momento sem aviso prévio.</p>
            <p className="mt-2">Todas as ofertas estão sujeitas à disponibilidade de estoque. Reservamo-nos o direito de limitar quantidades ou recusar pedidos a nosso critério.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">4. Propriedade Intelectual</h2>
            <p>Todo o conteúdo deste site, incluindo textos, imagens, logotipos e design, é propriedade da RCS Sports Management & Solutions LTDA e está protegido por leis de direitos autorais.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">5. Limitação de Responsabilidade</h2>
            <p>Não seremos responsáveis por quaisquer danos indiretos, incidentais, especiais ou consequenciais decorrentes do uso ou incapacidade de uso deste site.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">6. Modificações dos Termos</h2>
            <p>Podemos modificar estes Termos de Uso a qualquer momento. As alterações entrarão em vigor imediatamente após a publicação no site. O uso contínuo do site após as alterações constitui sua aceitação dos novos termos.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">7. Lei Aplicável</h2>
            <p>Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. Qualquer disputa será resolvida nos tribunais da cidade do Rio de Janeiro, RJ.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">8. Contato</h2>
            <p>Para dúvidas sobre estes termos, entre em contato:</p>
            <p className="mt-2">E-mail: contato@mesamaleta.com</p>
            <p>RCS Sports Management & Solutions LTDA</p>
            <p>CNPJ: 64.657.491/0001-20</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermosDeUso;
