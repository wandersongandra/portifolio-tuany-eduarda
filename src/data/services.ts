/** Serviços reais — sem inventar escopo além do confirmado. */
export const services = [
  {
    slug: 'atendimento-domiciliar',
    title: 'Atendimento domiciliar',
    short: 'Fisioterapia no ambiente da pessoa atendida, com plano alinhado à rotina.',
    text: 'Sessões de fisioterapia no ambiente da pessoa atendida, com avaliação individualizada e plano de cuidado alinhado à rotina e às condições de saúde.',
    points: [
      'Avaliação inicial no domicílio',
      'Orientação a familiares e cuidadores',
      'Continuidade do cuidado no dia a dia',
    ],
    icon: 'home' as const,
  },
  {
    slug: 'fisioterapia-geriatrica',
    title: 'Fisioterapia geriátrica',
    short: 'Mobilidade, equilíbrio e autonomia para idosos, com olhar de gerontologia.',
    text: 'Acompanhamento voltado a idosos, com atenção a mobilidade, equilíbrio, prevenção de quedas, readaptação após períodos de internação ou cirurgia, e manejo de dores crônicas. Formação com pós-graduação em Geriatria e Gerontologia.',
    points: [
      'Equilíbrio e prevenção de quedas',
      'Mobilidade e autonomia funcional',
      'Pós-operatório e dor crônica',
    ],
    icon: 'elder' as const,
  },
  {
    slug: 'dtm',
    title: 'DTM',
    short: 'Abordagem fisioterapêutica para disfunção temporomandibular.',
    text: 'Abordagem fisioterapêutica para disfunção temporomandibular (DTM), com foco em avaliação da articulação, educação e recursos clínicos adequados a cada caso.',
    points: [
      'Avaliação da articulação temporomandibular',
      'Orientação sobre hábitos e cuidados',
      'Plano individualizado de acompanhamento',
    ],
    icon: 'jaw' as const,
  },
  {
    slug: 'dof',
    title: 'DOF — dor orofacial',
    short: 'Cuidado fisioterapêutico para dor orofacial.',
    text: 'Abordagem fisioterapêutica para dor orofacial (DOF), com avaliação, educação e acompanhamento clínico individualizado.',
    points: [
      'Avaliação da dor orofacial',
      'Orientação sobre hábitos e cuidados',
      'Plano individualizado de acompanhamento',
    ],
    icon: 'face' as const,
  },
] as const;

export type Service = (typeof services)[number];
