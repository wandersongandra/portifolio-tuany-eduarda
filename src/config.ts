/**
 * Dados reais confirmados + placeholders marcados (somente no código).
 * Substitua os PLACEHOLDERs quando a cliente enviar os dados.
 */

export const site = {
  name: 'Tuany Eduarda',
  title: 'Tuany Eduarda | Fisioterapeuta — Atendimento Domiciliar em BH',
  description:
    'Fisioterapeuta em Belo Horizonte (CREFITO 361871-F), pós-graduada em Geriatria e Gerontologia. Atendimento domiciliar, fisioterapia em idosos, DTM e DOF.',
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
  /**
   * PLACEHOLDER — número real ainda não informado pela cliente.
   * Formato E.164 sem + (ex.: 5531999999999).
   * Enquanto for placeholder, CTAs de WhatsApp caem no Instagram (silencioso).
   */
  whatsapp: '55319XXXXXXXX',
  whatsappIsPlaceholder: true,
  whatsappDefaultMessage:
    'Olá, Tuany! Vi seu site e gostaria de saber mais sobre o atendimento domiciliar.',
  keywords: [
    'fisioterapeuta domiciliar BH',
    'fisioterapia para idosos BH',
    'fisioterapia DTM BH',
    'fisioterapeuta Belo Horizonte',
    'fisioterapia geriátrica BH',
    'dor orofacial BH',
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
