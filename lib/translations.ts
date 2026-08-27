import type { LanguageCode } from './languages';

// Static UI-string dictionary — authored directly rather than fetched from
// a translation API, since this covers a fixed, known set of interface
// text (not user-generated content). Zero runtime cost, zero network
// calls, works identically in every browser. Kali AI's actual chat
// *responses* are handled differently (see app/api/ai-one-chat/route.ts's
// language-aware system prompt) since those are open-ended generated
// content, not a fixed string a dictionary could cover.
//
// Brand/product names stay in English in every language per policy: Ai
// One, Star Tracker, NOAA Telemetry, Kali AI, Earth Hub, Radio Hub, Audio
// & Content Pods, Vault. Interface instructions/descriptions/tooltips/
// buttons around them are translated.
export type TranslationKey =
  | 'kali.greeting'
  | 'kali.mode.cosmic.label'
  | 'kali.mode.cosmic.title'
  | 'kali.mode.synthesis.label'
  | 'kali.mode.synthesis.title'
  | 'kali.mode.quantum.label'
  | 'kali.mode.quantum.title'
  | 'kali.tooltip.reasoningMode'
  | 'kali.tooltip.newChat'
  | 'kali.tooltip.history'
  | 'kali.tooltip.images'
  | 'kali.tooltip.export'
  | 'kali.tooltip.attachImage'
  | 'kali.tooltip.voiceInputStart'
  | 'kali.tooltip.voiceInputStop'
  | 'kali.placeholder.ask'
  | 'kali.placeholder.listening'
  | 'kali.send'
  | 'kali.error.unreachable'
  | 'kali.error.fileTooLarge'
  | 'kali.you';

const TRANSLATIONS: Record<TranslationKey, Record<LanguageCode, string>> = {
  'kali.greeting': {
    en: "Welcome. I'm (Ai One) — I keep company with ancient technology, quantum physics, and the mysteries stitched between them. Ask me what's on your mind.",
    es: 'Bienvenido. Soy (Ai One) — convivo con la tecnología antigua, la física cuántica y los misterios que las entrelazan. Pregúntame lo que tengas en mente.',
    fr: 'Bienvenue. Je suis (Ai One) — je côtoie les technologies anciennes, la physique quantique et les mystères qui les relient. Demande-moi ce qui te préoccupe.',
    de: 'Willkommen. Ich bin (Ai One) — ich beschäftige mich mit alter Technologie, Quantenphysik und den Geheimnissen, die sie miteinander verweben. Frag mich, was dich beschäftigt.',
    pt: 'Bem-vindo. Eu sou (Ai One) — convivo com tecnologia antiga, física quântica e os mistérios que os entrelaçam. Pergunte-me o que tiver em mente.',
    ja: 'ようこそ。私は(Ai One)です — 古代のテクノロジー、量子物理学、そしてそれらを結ぶ謎とともにあります。気になることを何でも聞いてください。',
    zh: '欢迎。我是 (Ai One) — 我与古代科技、量子物理以及连接它们的谜团相伴。有什么想问的，尽管问我。',
  },
  'kali.mode.cosmic.label': {
    en: 'Cosmic', es: 'Cósmico', fr: 'Cosmique', de: 'Kosmisch', pt: 'Cósmico', ja: 'コズミック', zh: '宇宙',
  },
  'kali.mode.cosmic.title': {
    en: 'Cosmic / Ancient — archaeoastronomy, cycles, classical metaphysics',
    es: 'Cósmico / Antiguo — arqueoastronomía, ciclos, metafísica clásica',
    fr: 'Cosmique / Ancien — archéoastronomie, cycles, métaphysique classique',
    de: 'Kosmisch / Antik — Archäoastronomie, Zyklen, klassische Metaphysik',
    pt: 'Cósmico / Antigo — arqueoastronomia, ciclos, metafísica clássica',
    ja: 'コズミック / 古代 — 考古天文学、周期、古典形而上学',
    zh: '宇宙 / 古代 — 考古天文学、周期、古典形而上学',
  },
  'kali.mode.synthesis.label': {
    en: 'Synthesis', es: 'Síntesis', fr: 'Synthèse', de: 'Synthese', pt: 'Síntese', ja: 'シンセシス', zh: '综合',
  },
  'kali.mode.synthesis.title': {
    en: 'Synthesis / Discovery — bridges ancient and modern (default)',
    es: 'Síntesis / Descubrimiento — conecta lo antiguo con lo moderno (predeterminado)',
    fr: "Synthèse / Découverte — relie l'ancien et le moderne (par défaut)",
    de: 'Synthese / Entdeckung — verbindet Altes mit Modernem (Standard)',
    pt: 'Síntese / Descoberta — conecta o antigo e o moderno (padrão)',
    ja: 'シンセシス / 発見 — 古代と現代をつなぐ（デフォルト）',
    zh: '综合 / 探索 — 连接古代与现代（默认）',
  },
  'kali.mode.quantum.label': {
    en: 'Quantum', es: 'Cuántico', fr: 'Quantique', de: 'Quanten', pt: 'Quântico', ja: 'クオンタム', zh: '量子',
  },
  'kali.mode.quantum.title': {
    en: 'Quantum / Science — field theory, physics, consciousness models',
    es: 'Cuántico / Ciencia — teoría de campos, física, modelos de la conciencia',
    fr: 'Quantique / Science — théorie des champs, physique, modèles de la conscience',
    de: 'Quanten / Wissenschaft — Feldtheorie, Physik, Bewusstseinsmodelle',
    pt: 'Quântico / Ciência — teoria de campos, física, modelos da consciência',
    ja: 'クオンタム / 科学 — 場の理論、物理学、意識モデル',
    zh: '量子 / 科学 — 场论、物理学、意识模型',
  },
  'kali.tooltip.reasoningMode': {
    en: 'Reasoning mode', es: 'Modo de razonamiento', fr: 'Mode de raisonnement', de: 'Denkmodus',
    pt: 'Modo de raciocínio', ja: '推論モード', zh: '推理模式',
  },
  'kali.tooltip.newChat': {
    en: 'New chat', es: 'Nuevo chat', fr: 'Nouvelle discussion', de: 'Neuer Chat', pt: 'Nova conversa',
    ja: '新しいチャット', zh: '新对话',
  },
  'kali.tooltip.history': {
    en: 'History', es: 'Historial', fr: 'Historique', de: 'Verlauf', pt: 'Histórico', ja: '履歴', zh: '历史记录',
  },
  'kali.tooltip.images': {
    en: 'Images', es: 'Imágenes', fr: 'Images', de: 'Bilder', pt: 'Imagens', ja: '画像', zh: '图片',
  },
  'kali.tooltip.export': {
    en: 'Export conversation as Markdown',
    es: 'Exportar conversación como Markdown',
    fr: 'Exporter la conversation en Markdown',
    de: 'Unterhaltung als Markdown exportieren',
    pt: 'Exportar conversa como Markdown',
    ja: '会話をMarkdownでエクスポート',
    zh: '将对话导出为 Markdown',
  },
  'kali.tooltip.attachImage': {
    en: 'Attach an image', es: 'Adjuntar una imagen', fr: 'Joindre une image', de: 'Bild anhängen',
    pt: 'Anexar uma imagem', ja: '画像を添付', zh: '添加图片',
  },
  'kali.tooltip.voiceInputStart': {
    en: 'Voice input', es: 'Entrada de voz', fr: 'Saisie vocale', de: 'Spracheingabe', pt: 'Entrada de voz',
    ja: '音声入力', zh: '语音输入',
  },
  'kali.tooltip.voiceInputStop': {
    en: 'Stop voice input', es: 'Detener entrada de voz', fr: 'Arrêter la saisie vocale',
    de: 'Spracheingabe stoppen', pt: 'Parar entrada de voz', ja: '音声入力を停止', zh: '停止语音输入',
  },
  'kali.placeholder.ask': {
    en: 'ASK AI ONE...', es: 'PREGÚNTALE A AI ONE...', fr: 'DEMANDEZ À AI ONE...', de: 'FRAG AI ONE...',
    pt: 'PERGUNTE À AI ONE...', ja: 'AI ONEに質問する...', zh: '向 AI ONE 提问...',
  },
  'kali.placeholder.listening': {
    en: 'LISTENING…', es: 'ESCUCHANDO…', fr: 'ÉCOUTE EN COURS…', de: 'HÖRT ZU…', pt: 'OUVINDO…',
    ja: '聞き取り中…', zh: '正在聆听…',
  },
  'kali.send': {
    en: 'Send', es: 'Enviar', fr: 'Envoyer', de: 'Senden', pt: 'Enviar', ja: '送信', zh: '发送',
  },
  'kali.error.unreachable': {
    en: 'SIGNAL LOST. AI ONE IS UNREACHABLE.',
    es: 'SEÑAL PERDIDA. AI ONE NO ESTÁ DISPONIBLE.',
    fr: 'SIGNAL PERDU. AI ONE EST INJOIGNABLE.',
    de: 'SIGNAL VERLOREN. AI ONE IST NICHT ERREICHBAR.',
    pt: 'SINAL PERDIDO. AI ONE ESTÁ INACESSÍVEL.',
    ja: '信号が途絶えました。AI ONEに接続できません。',
    zh: '信号丢失。AI ONE 暂时无法连接。',
  },
  // Rendered as `${filename.toUpperCase()} ${t('kali.error.fileTooLarge')}`
  // — the filename itself is never translated.
  'kali.error.fileTooLarge': {
    en: 'IS TOO LARGE (5MB MAX).', es: 'ES DEMASIADO GRANDE (MÁX. 5MB).', fr: 'EST TROP VOLUMINEUX (5 MO MAX).',
    de: 'IST ZU GROSS (MAX. 5MB).', pt: 'É GRANDE DEMAIS (MÁX. 5MB).', ja: 'は大きすぎます（最大5MB）。',
    zh: '文件过大（最大 5MB）。',
  },
  'kali.you': {
    en: 'you', es: 'tú', fr: 'vous', de: 'du', pt: 'você', ja: 'あなた', zh: '你',
  },
};

export function translate(key: TranslationKey, language: LanguageCode): string {
  return TRANSLATIONS[key][language] ?? TRANSLATIONS[key].en;
}
