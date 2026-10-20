# Deploy: banco, funções e app

Siga **na ordem**. As telas novas do app dependem das funções novas do banco, então o banco vai primeiro.

## 0. Pré-requisitos

- Node.js LTS e `npm ci` rodado na raiz do projeto
- Acesso de administrador ao projeto no [Supabase](https://supabase.com/dashboard)
- Conta no [Expo/EAS](https://expo.dev) com acesso ao projeto
- `npm run check` passando, ou seja, o app compila e os testes do banco passam

## 1. Conferir o esquema real (somente leitura)

As migrations foram escritas a partir do código do app. O esquema real do banco **ainda não está versionado**.

1. No Supabase, abra o **SQL Editor** e rode `supabase/scripts/inspecionar_esquema.sql`.
2. Salve o resultado de **todas** as consultas, principalmente a 4, que é o backup das policies atuais.
3. Compare com `supabase/tests/esquema-presumido.sql`. Se houver diferença de colunas ou tipos, atualize o esquema presumido e rode `npm run test:db` de novo antes de seguir.

> **Melhor ainda:** versionar o esquema real com `npx supabase db pull` (exige Docker). Isso gera a migration base, e os testes passam a usar o esquema de produção.

## 2. Backup

No Supabase, vá em **Database → Backups** e confira se existe um backup recente. No plano gratuito não há backup automático: nesse caso, exporte os dados das tabelas pelo Table Editor (CSV).

## 3. Aplicar as migrations

No SQL Editor, rode **em ordem**, um arquivo por vez:

1. `supabase/migrations/20261019000000_seguranca.sql`
2. `supabase/migrations/20261020000000_exclusao_conta.sql`

Se o esquema for diferente do esperado, o primeiro arquivo para logo no início com `Colunas ausentes: ...`, sem alterar nada.

Com o projeto vinculado à CLI (`npx supabase link`), dá para usar `npx supabase db push` no lugar.

## 4. Publicar as Edge Functions

```bash
npx supabase functions deploy delete-account
```

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

1. Rode `supabase/scripts/rollback_seguranca.sql`.
2. Em seguida, rode o SQL do backup de policies salvo no passo 1. **Sem esse passo, o app fica sem acesso aos dados.**
3. Volte o app para a versão anterior.
