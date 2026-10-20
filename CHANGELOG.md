# Histórico de mudanças

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Não publicado]

### Adicionado
- Tela **Minha Conta**, com exclusão de conta (exigida pela Apple e pelo Google Play) e link para a política de privacidade.
- Tela **Loja** para o cliente.
- Desbloqueio de horários na tela de bloqueio de agenda.
- Prazo mínimo para o cliente cancelar pelo app.
- Tabela `business_settings` com horário de funcionamento e prazo de cancelamento.
- Registro de auditoria das exclusões de conta (`account_deletions`).
- Testes automatizados do banco (`npm run test:db`) e CI no GitHub Actions.
- Scripts de inspeção do esquema e de rollback; guia de deploy.

### Alterado
- Pontos de fidelidade calculados no banco, junto com a finalização do atendimento.
- Horários livres consultados por `get_busy_slots`, sem expor dados de outros clientes.
- Exclusão de conta feita numa única transação.
- Build: iPad desativado, versão incrementada automaticamente pelo EAS, ícone de notificação próprio.

### Corrigido
- Avatar da Home levava a uma tela inexistente.
- Agendamentos recusados continuavam ocupando o horário.
- Dois clientes podiam reservar o mesmo horário.
- Bloquear um horário disparava a notificação de "Novo agendamento" para o barbeiro.
- Cliente conseguia se tornar admin ou alterar os próprios pontos (dependendo das policies existentes).
- Dependências nativas obrigatórias ausentes (`expo-font`, `react-native-gesture-handler`), que podiam fazer o app fechar sozinho no build de produção.

### Removido
- Foto de banco de imagens e avaliações fictícias na Home.
- Permissões de armazenamento e mídia no Android.

### Problemas conhecidos
- O cliente ainda define preço e duração ao agendar. O barbeiro aprova cada pedido, mas o ideal é o banco calcular esses valores.
- O esquema real do banco ainda não está versionado (veja `docs/DEPLOY.md`, passo 1).
