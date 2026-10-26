# Formulários de privacidade das lojas

Respostas para a **Segurança dos dados** (Google Play Console) e a **Privacidade do app** (App Store Connect), de acordo com o que o app coleta hoje e com a [política de privacidade](politica-de-privacidade.html). Se o app passar a coletar algo novo, atualize os três: este arquivo, a política e os formulários.

## Google Play: Segurança dos dados

**Visão geral**

| Pergunta | Resposta |
|---|---|
| O app coleta ou compartilha algum dos tipos de dados exigidos? | Sim |
| Todos os dados coletados são criptografados em trânsito? | Sim |
| Você oferece uma forma de os usuários pedirem a exclusão dos dados? | Sim. No app (*Minha Conta → Excluir minha conta*) e pelo link `URL-DA-POLÍTICA#exclusao` |

**Tipos de dados.** Todos são *coletados*, *não compartilhados* (prestadores de serviço que agem em nome do app não contam como compartilhamento), *obrigatórios* e *não processados de forma efêmera*, exceto onde indicado.

| Categoria → tipo | Finalidades |
|---|---|
| Informações pessoais → Nome | Funcionalidade do app, Gerenciamento da conta |
| Informações pessoais → Endereço de e-mail | Gerenciamento da conta |
| Informações pessoais → Número de telefone | Funcionalidade do app, Comunicações do desenvolvedor |
| Informações financeiras → Histórico de compras (serviços agendados e valores) | Funcionalidade do app |
| Atividade no app → Outras ações (agendamentos e pontos de fidelidade) | Funcionalidade do app |
| IDs de dispositivo ou outros IDs → Token de notificação (**opcional**: só se o usuário permitir notificações) | Funcionalidade do app |

Não marque: localização, contatos, fotos e vídeos, áudio, arquivos, agenda do aparelho, dados de saúde, mensagens, navegação na web, informações e desempenho do app, publicidade.

## App Store: Privacidade do app

**Você ou seus parceiros coletam dados deste app?** Sim.

Para todos os tipos abaixo: **vinculado à identidade do usuário: sim**; **usado para rastreamento: não**.

| Tipo de dado | Finalidade |
|---|---|
| Informações de contato → Nome | Funcionalidade do app |
| Informações de contato → Endereço de e-mail | Funcionalidade do app |
| Informações de contato → Número de telefone | Funcionalidade do app |
| Compras → Histórico de compras | Funcionalidade do app |
| Identificadores → ID do usuário | Funcionalidade do app |

O token de notificação costuma ficar de fora, porque serve só para entregar as notificações do próprio app. Se o revisor questionar, declare-o em *Identificadores → ID do dispositivo*, com a finalidade *Funcionalidade do app*.

Em **App Privacy → Privacy Policy URL**, use a URL pública da política.

## Para os revisores das lojas

- Crie uma conta de cliente de teste e informe e-mail e senha no envio (Google: *Acesso ao app*; Apple: *Sign-In Information*).
- Na descrição para o revisor, explique que a área do barbeiro é restrita à equipe da barbearia e que a exclusão de conta fica em *Minha Conta*.
