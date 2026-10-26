# Pendências para o Gustavo validar

Decisões de **negócio**, **marca** e **jurídico** que foram implementadas com um valor provisório. Nenhuma delas é técnica: basta responder e o ajuste é pequeno (a maioria é só mudar um valor no banco).

> Legenda: 🔴 bloqueia a publicação · 🟡 importante antes do lançamento · 🟢 pode ser ajustado depois

## Publicação nas lojas

- [ ] 🔴 **Conta de desenvolvedor em nome do Studio Gustavo.** A Apple rejeita apps de um negócio publicados por terceiros (regra 4.2.6). É preciso criar a conta Apple Developer (US$ 99/ano) e a Google Play Console (US$ 25, pagamento único) com o CNPJ/CPF da barbearia.
- [ ] 🔴 **Conta do Supabase (banco de dados) em nome da barbearia.** O projeto antigo foi perdido junto com o acesso à conta. O novo deve ser criado com um e-mail do Studio Gustavo, com quem cuida do app convidado como membro. Também é preciso decidir se vale o plano Pro (US$ 25/mês): ele não pausa por falta de uso e tem backup diário.
- [ ] 🔴 **Identificador do app.** Hoje é `com.felps.studiogustavo`, com o nome do desenvolvedor. **Depois da primeira publicação ele não pode mais ser trocado.** Sugestão: `br.com.studiogustavo.app`. Qual usar?
- [ ] 🟢 **Ícone de notificação.** Agora é uma tesoura branca sobre fundo transparente (`assets/notification-icon.png`), legível em tamanho pequeno. Se quiser a tesoura do logo, um designer pode desenhar uma versão no mesmo formato.

## Conteúdo exibido no app (`src/constants/business.js`)

- [ ] 🔴 **Nome, bio e foto do barbeiro.** Hoje estão "Gustavo", um texto genérico e o logo no lugar da foto. Precisa do texto real e de uma foto (com autorização de uso).
- [ ] 🟡 **Loja.** O app informa que os produtos são "disponíveis para compra diretamente na barbearia". É isso mesmo, ou haverá reserva pelo app?

## Regras da agenda (tabela `business_settings` no Supabase)

| Regra | Valor provisório | Valor do Gustavo |
|---|---|---|
| Antecedência mínima para o cliente cancelar pelo app | 2 horas | |
| Horário de abertura | 9h | |
| Horário de fechamento | 19h | |
| Intervalo entre horários | 30 min | |
| Abre domingo? | Não | |
| Abre segunda? | Sim | |

- [ ] 🟡 **Pedido pendente ocupa o horário?** Hoje, quando o cliente pede um horário, ele fica reservado até o Gustavo aceitar ou recusar. A alternativa é deixar o horário livre até a confirmação, com risco de dois pedidos para o mesmo horário.
- [ ] 🟢 **O que acontece fora do prazo de cancelamento?** Hoje o app só orienta "fale com a barbearia". Haverá alguma regra de falta, multa ou bloqueio?

## Programa de fidelidade

- [ ] 🟡 **Meta e prêmio.** O app mostra a meta de 100 pontos e "corte grátis", mas **não existe o resgate**: os pontos acumulam e nada acontece. Como deve funcionar? (Exemplo: o barbeiro zera os pontos ao dar o corte grátis.)
- [ ] 🟢 **Pontos por serviço.** Hoje são configurados pelo barbeiro na tela Gestão (padrão de 10 por serviço). Confirmar os valores.

## Privacidade e dados (de preferência com apoio jurídico)

- [ ] 🔴 **Política de privacidade.** O texto está pronto em `docs/politica-de-privacidade.html`. Falta preencher os campos destacados em amarelo (responsável, CNPJ/CPF, e-mail, telefone e endereço), revisar e publicar (`docs/DEPLOY.md`, passo 6). O e-mail de contato precisa ser lido com frequência: a lei dá 15 dias para responder.
- [ ] 🟡 **Idade mínima.** A política diz que o cadastro é para maiores de 18 anos e que o responsável agenda para os filhos na própria conta. Está ok?
- [ ] 🟡 **O que fazer com os dados quando o cliente exclui a conta.** Implementado hoje:
  - agendamentos futuros são **apagados**;
  - agendamentos passados ficam **sem identificação** ("Cliente excluído") para manter o faturamento;
  - fica um registro técnico da exclusão (data e um código interno do usuário, sem nome, telefone ou e-mail).

  Isso atende ao que a barbearia precisa e à LGPD?
- [ ] 🟢 **Conta do barbeiro.** A conta de administrador não pode ser excluída pelo app (para não perder o acesso ao painel). Se o Gustavo quiser excluí-la, isso é feito pelo suporte técnico. Está ok?
