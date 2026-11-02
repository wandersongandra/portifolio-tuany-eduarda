/**
 * Dados reais confirmados. Não inventar bairros, preços ou resultados.
 */

export const site = {
  name: 'Tuany Eduarda',
  title: 'Tuany Eduarda | Fisioterapeuta — Atendimento Domiciliar em BH',
  description:
    'Fisioterapeuta em Belo Horizonte (CREFITO 361871-F), pós-graduada em Geriatria e Gerontologia. Atendimento domiciliar: fisioterapia para idosos, treino funcional, pilates, drenagem linfática e tratamento para DTM.',
  locale: 'pt-BR',
  // Domínio provisório até a publicação — robots com noindex.
  url: 'https://tuanyeduarda.example.com',
  city: 'Belo Horizonte',
  state: 'MG',
  crefito: '361871-F',
  credentials: [
    'Fisioterapeuta — CREFITO 361871-F',
    'Pós-graduada em Geriatria e Gerontologia',
  ],
  instagram: {
    handle: '@fisiotuanyeduarda',
    url: 'https://www.instagram.com/fisiotuanyeduarda/',
  },
  /** E.164 sem +. Número real confirmado no flyer oficial. */
  whatsapp: '5537998350405',
  whatsappDisplay: '(37) 99835-0405',
  whatsappIsPlaceholder: false,
  whatsappDefaultMessage: 'Olá, Tuany! Gostaria de agendar um atendimento.',
  keywords: [
    'fisioterapeuta domiciliar BH',
    'fisioterapia para idosos BH',
    'fisioterapia DTM BH',
    'fisioterapeuta Belo Horizonte',
    'fisioterapia geriátrica BH',
    'treino funcional domiciliar BH',
    'pilates domiciliar BH',
    'drenagem linfática BH',
  ],
} as const;

/** WhatsApp real, ou Instagram se o número ainda for placeholder (sem aviso ao visitante). */
export function whatsappUrl(message = site.whatsappDefaultMessage): string {
  if (site.whatsappIsPlaceholder) return site.instagram.url;
  const text = encodeURIComponent(message);
  return `https://wa.me/${site.whatsapp}?text=${text}`;
}

export function primaryContactUrl(): string {
  return site.whatsappIsPlaceholder ? site.instagram.url : whatsappUrl();
}

export function primaryContactLabel(): string {
  return site.whatsappIsPlaceholder ? `Instagram ${site.instagram.handle}` : 'WhatsApp';
}

export function primaryContactIsWhatsApp(): boolean {
  return !site.whatsappIsPlaceholder;
}
