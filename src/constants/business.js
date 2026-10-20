// Dados reais da barbearia exibidos no app.
// ATENÇÃO: revise estes textos com o Gustavo antes de publicar nas lojas.

export const BARBER = {
  name: 'Gustavo',
  bio: 'Barbeiro responsável pelo Studio Gustavo.',
  // Coloque a foto real em assets/ e troque por: require('../../assets/gustavo.jpg')
  photo: null,
};

// Valores usados enquanto a tabela business_settings não carrega (ou se falhar).
// A fonte oficial é o banco: altere lá, não aqui.
export const DEFAULT_SETTINGS = {
  cancellation_min_hours: 2,
  opening_hour: 9,
  closing_hour: 19,
  slot_interval: 30,
  work_on_sunday: false,
  work_on_monday: true,
};

// Link público da política de privacidade (obrigatório para Apple e Google).
// Hospede o texto de docs/politica-de-privacidade.md e cole a URL aqui.
export const PRIVACY_POLICY_URL = 'https://SEU-SITE/politica-de-privacidade';
