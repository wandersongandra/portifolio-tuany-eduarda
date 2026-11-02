/** Serviços do flyer oficial — sem inventar escopo, preços ou resultados. */
export const services = [
  {
    slug: 'fisioterapia-para-idosos',
    title: 'Fisioterapia para idosos',
    short: 'Mobilidade, equilíbrio e autonomia, com olhar de gerontologia.',
    text: 'Acompanhamento voltado a idosos, com atenção a mobilidade, equilíbrio, prevenção de quedas e continuidade do cuidado no dia a dia. Formação com pós-graduação em Geriatria e Gerontologia.',
    points: [
      'Equilíbrio e prevenção de quedas',
      'Mobilidade e autonomia funcional',
      'Plano alinhado à rotina em casa',
    ],
    icon: 'elder' as const,
  },
  {
    slug: 'treino-funcional',
    title: 'Treino funcional',
    short: 'Exercícios para força, estabilidade e desempenho nas atividades do dia a dia.',
    text: 'Programa de exercícios funcionais, individualizado após avaliação, para reforçar força, estabilidade e segurança nos movimentos do cotidiano.',
    points: [
      'Avaliação e progressão individual',
      'Força e estabilidade',
      'Orientação para a rotina',
    ],
    icon: 'strength' as const,
  },
  {
    slug: 'pilates',
    title: 'Pilates',
    short: 'Trabalho de controle, postura e consciência corporal no domicílio.',
    text: 'Sessões de pilates adaptadas ao ambiente domiciliar e às condições de cada pessoa, com foco em controle motor, postura e consciência corporal.',
    points: [
      'Adaptação ao espaço de casa',
      'Controle e postura',
      'Progressão conforme avaliação',
    ],
    icon: 'mat' as const,
  },
  {
    slug: 'drenagem-linfatica',
    title: 'Drenagem linfática',
    short: 'Técnica manual delicada, indicada conforme avaliação clínica.',
    text: 'Drenagem linfática manual aplicada quando clinicamente indicada, com avaliação prévia e orientação sobre cuidados. Não substitui avaliação médica quando necessária.',
    points: [
      'Indicação após avaliação',
      'Técnica manual cuidadosa',
      'Orientações de continuidade',
    ],
    icon: 'lymph' as const,
  },
  {
    slug: 'tratamento-dtm',
    title: 'Tratamento para DTM',
    short: 'Disfunção temporomandibular e dor orofacial.',
    text: 'Abordagem fisioterapêutica para disfunção temporomandibular (DTM) e dor orofacial, com avaliação da articulação e plano de tratamento individualizado.',
    points: [
      'Avaliação da articulação temporomandibular',
      'Atenção à dor orofacial',
      'Orientação sobre hábitos e cuidados',
    ],
    icon: 'jaw' as const,
  },
] as const;

export type Service = (typeof services)[number];
