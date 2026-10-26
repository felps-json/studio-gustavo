# Histórico de mudanças

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Não publicado]

### Adicionado
- Esquema completo do banco versionado (`20261018000000_esquema_inicial.sql`), para recriar o projeto do Supabase do zero.
- Notificações de agendamento e lembretes configurados por migration (gatilhos com `pg_net` e job do `pg_cron`), em vez de ajustes manuais no painel.
- E-mail do cliente no perfil, copiado do login (usado na tela Clientes do admin).
- Tela **Minha Conta**, com exclusão de conta (exigida pela Apple e pelo Google Play) e link para a política de privacidade.
- Tela **Loja** para o cliente.
- Desbloqueio de horários na tela de bloqueio de agenda.
- Prazo mínimo para o cliente cancelar pelo app.
- Tabela `business_settings` com horário de funcionamento e prazo de cancelamento.
- Registro de auditoria das exclusões de conta (`account_deletions`).
- Testes automatizados do banco (`npm run test:db`) e CI no GitHub Actions.
- Scripts de inspeção do esquema e de rollback; guia de deploy.
- Política de privacidade completa em HTML, pronta para hospedar, e respostas para os formulários de privacidade da App Store e do Google Play.

### Alterado
- Pontos de fidelidade calculados no banco, junto com a finalização do atendimento.
- Horários livres consultados por `get_busy_slots`, sem expor dados de outros clientes.
- Exclusão de conta feita numa única transação.
- Build: iPad desativado, versão incrementada automaticamente pelo EAS, ícone de notificação próprio.
- Ícone de notificação trocado por uma tesoura branca, legível em tamanho pequeno.
- Sem foto de perfil, o app mostra as iniciais do nome geradas localmente.

### Corrigido
- Avatar da Home levava a uma tela inexistente.
- Agendamentos recusados continuavam ocupando o horário.
- Dois clientes podiam reservar o mesmo horário.
- Bloquear um horário disparava a notificação de "Novo agendamento" para o barbeiro.
- O cadastro enviava o nome do cliente para um site externo (ui-avatars.com) para gerar o avatar.
- Imagens de avatar vinham de um site que saiu do ar (via.placeholder.com).
- Cliente conseguia se tornar admin ou alterar os próprios pontos (dependendo das policies existentes).
- Dependências nativas obrigatórias ausentes (`expo-font`, `react-native-gesture-handler`), que podiam fazer o app fechar sozinho no build de produção.

### Removido
- Foto de banco de imagens e avaliações fictícias na Home.
- Permissões de armazenamento e mídia no Android.

### Problemas conhecidos
- O cliente ainda define preço e duração ao agendar. O barbeiro aprova cada pedido, mas o ideal é o banco calcular esses valores.
- Os gatilhos de notificação e o job de lembretes não rodam nos testes locais (o PostgreSQL embutido não tem `pg_net` nem `pg_cron`). Conferir no projeto real (`docs/DEPLOY.md`, passos 3 e 5).
