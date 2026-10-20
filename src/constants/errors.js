// Códigos de erro lançados pelo banco (supabase/migrations/20261019000000_seguranca.sql).
// Compare sempre por error.code, nunca pelo texto da mensagem.
export const DB_ERRORS = {
  SLOT_TAKEN: 'GS001',
  CANCELLATION_DEADLINE: 'GS002',
  NOT_ALLOWED: 'GS003',
};
