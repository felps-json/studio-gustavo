# Studio Gustavo — App da barbearia

App de agendamento para o Studio Gustavo Barber (iOS e Android).

- **Cliente:** agenda serviços, acompanha os pedidos, cancela, acumula pontos de fidelidade e vê a loja.
- **Barbeiro (admin):** aceita e recusa pedidos, bloqueia horários, gerencia serviços, produtos e clientes, e vê relatórios.

**Tecnologias:** Expo SDK 54 (React Native) · Supabase (Auth, Postgres, Storage, Edge Functions) · EAS Build

## Rodando localmente

```bash
npm ci          # instala as dependências
npm start       # abre o Expo (use o app Expo Go ou um emulador)
```

## Verificações

| Comando | O que faz |
|---|---|
| `npm run check` | Compila o app para Android e iOS e roda os testes do banco |
| `npm run test:db` | Testa as regras de segurança do banco num PostgreSQL embutido (sem Docker) |
| `npm run doctor` | Confere dependências e configuração do Expo |

O GitHub Actions roda `doctor` e `check` em todo push e pull request (`.github/workflows/ci.yml`).

## Estrutura

```
src/
  screens/          telas do cliente; screens/admin/ telas do barbeiro
  constants/        tema, dados da barbearia, códigos de erro do banco
  hooks/            useBusinessSettings (configurações vindas do banco)
  contexts/         autenticação e notificações push
supabase/
  migrations/       mudanças versionadas do banco (RLS, triggers, funções)
  functions/        Edge Functions (notificações, lembretes, exclusão de conta)
  scripts/          inspeção do esquema e rollback
  tests/            testes automatizados do banco
docs/               deploy, pendências de negócio e política de privacidade
```

## Regras importantes

- **As regras de negócio ficam no banco.** Horário de funcionamento, intervalo e prazo de cancelamento estão na tabela `business_settings`. Altere lá, não no código.
- **A segurança é garantida pelo banco**, não pelo app: as policies RLS e os triggers ficam em `supabase/migrations/`. Toda mudança nelas precisa de teste em `supabase/tests/`.
- **Erros do banco são tratados pelo código** (`src/constants/errors.js`), nunca pelo texto da mensagem.

## Documentação

- [Deploy passo a passo](docs/DEPLOY.md)
- [Pendências para o Gustavo validar](docs/PENDENCIAS-GUSTAVO.md)
- [Política de privacidade (rascunho)](docs/politica-de-privacidade.md)
- [Histórico de mudanças](CHANGELOG.md)
