# Deploy: banco, funções e app

Siga **na ordem**. As telas novas do app dependem das funções novas do banco, então o banco vai primeiro.

## 0. Pré-requisitos

- Node.js LTS e `npm ci` rodado na raiz do projeto
- Conta no [Supabase](https://supabase.com/dashboard) **em nome da barbearia** (e-mail do Studio Gustavo), com quem cuida do app convidado como membro da organização. Assim o acesso não depende de uma pessoa só.
- Conta no [Expo/EAS](https://expo.dev) com acesso ao projeto
- `npm run check` passando, ou seja, o app compila e os testes do banco passam

## 1. Criar o projeto no Supabase

1. No painel, crie um projeto novo na região **South America (São Paulo)** e guarde a senha do banco num gerenciador de senhas.
2. Em **Project Settings → API Keys**, copie a URL do projeto, a chave **anon/publishable** e a chave **service_role**.
3. Em **Authentication → Sign In / Providers → Email**, decida se o cadastro exige confirmação de e-mail. Se exigir, configure o SMTP: o envio padrão do Supabase tem limite baixo de e-mails por hora.

> O plano gratuito **pausa o projeto depois de 7 dias sem uso**. Em uso diário isso não acontece; para garantir, o plano Pro (US$ 25/mês) não pausa e tem backup diário.

## 2. Criar o banco (migrations)

O esquema completo está versionado em `supabase/migrations/`. Com a CLI:

```bash
npx supabase login            # num terminal normal (abre o navegador)
npx supabase link --project-ref <ref-do-projeto>
npx supabase db push
```

Ou, no **SQL Editor**, rode **em ordem**, um arquivo por vez:

1. `20261018000000_esquema_inicial.sql`: tabelas e bucket de fotos
2. `20261019000000_seguranca.sql`: RLS, papéis, pontos e conflito de horários
3. `20261020000000_exclusao_conta.sql`: exclusão de conta com auditoria
4. `20261021000000_notificacoes_e_lembretes.sql`: notificações e lembretes

Depois, guarde a URL e a chave service_role no **Vault**, para que o banco consiga chamar as Edge Functions (SQL Editor):

```sql
select vault.create_secret('https://<ref-do-projeto>.supabase.co', 'project_url');
select vault.create_secret('<chave service_role>', 'service_role_key');
```

> **Não** crie "Database Webhooks" no painel para `appointments`: a migration 4 já faz isso, e as notificações chegariam em dobro.

## 3. Publicar as Edge Functions

```bash
npx supabase functions deploy push-notifications
npx supabase functions deploy cron-reminders
npx supabase functions deploy delete-account
```

Para conferir os lembretes: em **Integrations → Cron**, o job `lembretes-agendamentos` deve aparecer rodando de hora em hora.

## 4. Apontar o app para o projeto novo

1. Em `src/services/supabase.js`, troque `supabaseUrl` e `supabaseAnonKey` pelos valores do passo 1.
2. Crie a conta do barbeiro pelo próprio app (cadastro normal) e, no SQL Editor, promova-a a admin:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = '<email do Gustavo>');
   ```
3. Cadastre os serviços na tela **Gestão** do app.

## 5. Testar antes de publicar o app

Gere um build de teste com `eas build --profile preview` e confira:

**Como cliente**
- [ ] Cadastrar, agendar e ver o pedido como "Em análise"
- [ ] Tentar marcar o mesmo horário em dois celulares: o segundo recebe "horário indisponível"
- [ ] Cancelar com antecedência funciona; com menos de 2h, aparece a orientação para falar com a barbearia
- [ ] Minha Conta → Excluir minha conta: a conta some e o login deixa de funcionar

**Como admin**
- [ ] Aceitar e recusar um pedido (o horário recusado volta a ficar livre)
- [ ] Finalizar um atendimento: os pontos do cliente aumentam
- [ ] Bloquear e desbloquear horários
- [ ] Cadastrar um produto com foto

## 6. Publicar o app

```bash
eas build --platform all --profile production
eas submit --platform all --profile production
```

A versão do build sobe automaticamente (`autoIncrement` no `eas.json`). Para os revisores das lojas, crie uma **conta de cliente de teste** e informe e-mail e senha no formulário de envio.

## Desfazer (rollback)

Num projeto novo, sem clientes, o mais simples é apagar o projeto e começar de novo pelo passo 1.

Com dados reais, faça antes um backup (**Database → Backups** no plano Pro, ou exportação CSV pelo Table Editor). `supabase/scripts/rollback_seguranca.sql` remove as regras das migrations 2 e 3, mas deixa as tabelas **sem nenhuma policy**: o app fica sem acesso aos dados até que novas policies sejam criadas.
