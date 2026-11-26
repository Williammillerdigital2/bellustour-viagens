# Premissas e Diretrizes do Projeto — Bellustour (Matheus Viagens)

## 1. Visão Geral do Projeto & Identidade
- **Marca / Agência:** **Bellustour** (Especialista: Matheus).
- **Produto:** Landing Page de Viagens interativa de alto impacto visual, com foco principal em **Cruzeiros**, mas exibindo também o portfólio completo da agência e convertendo leads via WhatsApp.
- **Categorias Principais (Estrutura do Carousel / Filtros Interativos):**
  1. 🛳️ **Cruzeiros** *(Foco principal da agência)*
  2. 🇧🇷 **Viagens Nacionais**
  3. 🌍 **Viagens Internacionais**
  4. 🔥 **Pacotes Promocionais**
  5. ⏳ **Últimas Ofertas / Últimas Vagas**
- **Referências Visuais & Interatividade:**
  - `https://promptmotionsite.com/msp-future-carousel` — Conceito principal de Carousel futurista/imersivo adaptado para viagens.
  - `https://promptmotionsite.com/msp-skyway` — Atmosfera aérea/horizonte, profundidade e movimento fluido.
  - `https://promptmotionsite.com/album-release` — Tipografia expressiva, vitrine visual em destaque e transições de cena.
  - `https://promptmotionsite.com/supplement-shop` — Cards de produto/pacote com forte apelo de conversão e micro-interações.
  - **Diretriz de UI/UX:** Alta interatividade com a tela (transições suaves no carousel, efeito parallax/profundidade sutil, troca dinâmica de categorias e destaque visual cinematográfico das fotos dos destinos/navios).
- **Painel Administrador (`/admin`):** Interface simples, intuitiva e protegida para gerenciamento completo do site (categorias, pacotes, imagens, preços, selos de "Últimas Vagas", textos, número de WhatsApp, SEO e itens do formulário) sem mexer no código.

---

## 2. Fluxo de Cotação (Pacotes -> Popup -> WhatsApp)
1. Cada card de pacote de viagem (foco em **Cruzeiros**) terá o botão **"Faça sua cotação"**.
2. Ao clicar, abre-se um **Modal / Popup** identificando automaticamente o pacote selecionado e exibindo a mensagem de boas-vindas do Matheus:
   > *"Olá! Seja muito bem-vindo(a)! Aqui é o Matheus, seu especialista em cruzeiros 😎✨ Vou te ajudar a encontrar a melhor viagem com o melhor preço — aquela experiência perfeita que você merece! 🛳️🌅"*
3. **Campos do Formulário no Popup (editáveis também via Admin):**
   - 📍 **Porto de saída:** (`De qual porto você gostaria de sair?` — ex: Santos, Rio de Janeiro, Salvador, Maceió, Itajaí, Outro)
   - 👨‍👩‍👧‍👦 **Quantidade de passageiros:** (`Quantas pessoas vão viajar?`)
   - 🔞 **Faixa etária:** (`Todos são adultos?` — Sim / Não, há crianças ou adolescentes)
   - 📅 **Mês da viagem:** (`Qual mês você pretende viajar?`)
   - ⏳ **Duração preferida:** (`Qual duração você prefere?`)
     - *Regra condicional/informativa:* Saindo de Santos: opções de `3/4 dias` ou `7/8 dias` | Outros portos: roteiros de `7/8 dias`.
4. Ao clicar no botão **"Cotação"**, os dados preenchidos + o nome do pacote clicado são formatados na mensagem do Matheus e enviados diretamente para o **WhatsApp** configurado no painel Admin (`https://wa.me/...`).

---

## 3. Arquitetura & Economia de Tokens
Para manter o consumo de tokens mínimo, alta velocidade de manutenção e compatibilidade total com Cloudflare e Google:

- **Stack Escolhida:** HTML5 Semântico + Tailwind CSS (ou CSS modular enxuto) + Vanilla JS modular + **Cloudflare Pages / Workers & KV (ou D1)** para persistência dos dados do Admin em tempo real sem precisar de servidor externo pago.
- **Separação Modular Rígida (Economia de Tokens):**
  - `data/site-config.json` (ou API KV `/api/config`): Concentra **todos** os textos, pacotes, imagens e número de WhatsApp. Quando for necessário alterar conteúdo padrão, edita-se apenas este arquivo.
  - `public/index.html`: Estrutura enxuta e semântica da Landing Page + SEO.
  - `public/js/app.js`: Apenas renderização dinâmica dos pacotes e lógica do Popup -> WhatsApp.
  - `public/admin.html` & `public/js/admin.js`: Isolados exclusivamente para o painel administrativo (não precisam ser lidos durante ajustes visuais na Landing Page).
  - `functions/api/`: Cloudflare Pages Functions para salvar/carregar alterações feitas no painel Admin.
- **Regra para o Agente:** Nunca ler todos os arquivos do projeto sem necessidade. Consultar apenas o módulo específico da tarefa solicitada.

---

## 4. Diretrizes Google (SEO, Performance & Google Ads)
Como o site será publicado e divulgado no Google, todas as entregas devem seguir:
- **Core Web Vitals:** Imagens otimizadas (`WebP`, `loading="lazy"` abaixo da dobra, `fetchpriority="high"` no Hero), zero layout shift (CLS) e carregamento instantâneo via CDN da Cloudflare.
- **SEO Técnico:** Meta tags completas (`title`, `description`, Open Graph), HTML5 semântico (`header`, `main`, `section`, `footer`), `sitemap.xml`, `robots.txt` e Schema.org (`TravelAgency` / `TouristTrip`).
- **Conformidade Google Ads:** Links claros para Política de Privacidade / Termos de Uso no rodapé, CNPJ/dados de contato editáveis via Admin, transparência na coleta de dados do popup e ausência de redirecionamentos automáticos sem ação do usuário.
- **Design Qualidade (`design-taste-frontend`):** Aplicar as diretrizes da skill `taste-skill` instalada para garantir acabamento visual de alto nível e não-genérico.

---

## 5. Hospedagem, Deploy e Credenciais
- **GitHub:** Usuário `williammillerdigital2`.
- **Cloudflare:** Deploy automatizado via Cloudflare Pages / Wrangler.
- **Segurança das Credenciais:** O token da API da Cloudflare (`CLOUDFLARE_API_TOKEN`) e o usuário do GitHub estão salvos localmente no arquivo `.env` (que está listado no `.gitignore` para **nunca** vazar no repositório público do GitHub).
- **Domínio:** Inicialmente utilizará o subdomínio padrão `.pages.dev` da Cloudflare. Quando o domínio próprio for enviado, serão configurados DNS, SSL/TLS e redirecionamentos via API da Cloudflare.

---

## 6. Regra de Fluxo de Trabalho (Workflow) & Testes Automatizados
1. **Não iniciar o código do site** antes de receber as referências do usuário.
2. **Testes Automatizados & Regressão (`tests/regression.test.mjs`):**
   - O projeto possui uma suíte de testes automatizados (`node tests/regression.test.mjs`).
   - **Regra obrigatória:** Toda vez que um bug for corrigido ou um ajuste de layout/funcionalidade for feito, deve-se adicionar um **teste de regressão** correspondente e rodar a suíte antes de entregar.
3. **Ciclo de Alteração e Deploy:**
   - Fazer a alteração solicitada localmente e validar nos testes automatizados.
   - Aguardar o **"OK"** explícito do usuário.
   - Após o "OK", executar o commit/push para o GitHub (`williammillerdigital2`) e validar o deploy/configurações na Cloudflare via API/Wrangler.
