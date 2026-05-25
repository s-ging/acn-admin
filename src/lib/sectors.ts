// src/lib/sectors.ts
// ACN Newswire sector taxonomy — static master list
// Source: ACN internal sector classification
// Structure: Category (sector_type) → Sector (sector_name) with multilingual names

export interface Sector {
  id: number
  sector_type: string       // The category grouping e.g. "Technology", "Financial"
  sector_name: string       // Internal name / English display name
  name_en: string
  name_ja: string | null
  name_zh_hans: string | null
  name_zh_hant: string | null
  name_ko: string | null
}

export const SECTORS: Sector[] = [
  // Communications
  { id: 209, sector_type: 'Communications', sector_name: 'Advertising', name_en: 'Advertising', name_ja: '広告', name_zh_hans: 'Advertising & Media', name_zh_hant: 'Advertising & Media', name_ko: 'Advertising & Media' },
  { id: 184, sector_type: 'Communications', sector_name: 'Broadcast Film & Sat', name_en: 'Broadcast Film & Sat', name_ja: '放送', name_zh_hans: '广播', name_zh_hant: '廣播 電視及衛星', name_ko: '방송 TV 및 위성' },
  { id: 103, sector_type: 'Communications', sector_name: 'Media & Marketing', name_en: 'Media & Marketing', name_ja: 'メディア', name_zh_hans: '通讯', name_zh_hant: '通訊', name_ko: '커뮤니케이션' },
  { id: 26, sector_type: 'Communications', sector_name: 'Telecoms 5G', name_en: 'Telecoms 5G', name_ja: '通信', name_zh_hans: '电信运营商', name_zh_hant: 'Telecom Carriers', name_ko: null },
  { id: 183, sector_type: 'Communications', sector_name: 'Wireless Apps', name_en: 'Wireless Apps', name_ja: 'モバイル', name_zh_hans: '无线', name_zh_hant: '無線', name_ko: '무선' },

  // Technology
  { id: 261, sector_type: 'Technology', sector_name: 'Artificial Intel [AI]', name_en: 'Artificial Intel [AI]', name_ja: 'AI', name_zh_hans: 'Artificial Intel [AI]', name_zh_hant: 'Artificial Intel [AI]', name_ko: 'Artificial Intel [AI]' },
  { id: 262, sector_type: 'Technology', sector_name: 'Automation [IoT]', name_en: 'Automation [IoT]', name_ja: 'IoT', name_zh_hans: 'Automation [IoT]', name_zh_hant: 'Automation [IoT]', name_ko: 'Automation [IoT]' },
  { id: 243, sector_type: 'Technology', sector_name: 'CyberSecurity', name_en: 'CyberSecurity', name_ja: 'セキュリティ', name_zh_hans: 'CyberSecurity', name_zh_hant: 'CyberSecurity', name_ko: 'CyberSecurity' },
  { id: 240, sector_type: 'Technology', sector_name: 'Datacenter & Cloud', name_en: 'Datacenter & Cloud', name_ja: 'Datacenter & Cloud', name_zh_hans: 'Datacenter & Cloud', name_zh_hant: 'Datacenter & Cloud', name_ko: 'Datacenter & Cloud' },
  { id: 239, sector_type: 'Technology', sector_name: 'Digitalization', name_en: 'Digitalization', name_ja: 'デジタル', name_zh_hans: '数字', name_zh_hant: '數字', name_ko: '디지털' },
  { id: 86, sector_type: 'Technology', sector_name: 'Electronics', name_en: 'Electronics', name_ja: 'エレクトロニクス', name_zh_hans: '电子产品', name_zh_hant: '電子產品', name_ko: '전자제품' },
  { id: 30, sector_type: 'Technology', sector_name: 'Engineering', name_en: 'Engineering', name_ja: 'エンジニアリング', name_zh_hans: 'Engineering', name_zh_hant: 'Engineering', name_ko: 'Engineering' },
  { id: 190, sector_type: 'Technology', sector_name: 'Enterprise IT', name_en: 'Enterprise IT', name_ja: 'Enterprise IT', name_zh_hans: 'Enterprise IT', name_zh_hant: 'Enterprise IT', name_ko: 'Enterprise IT' },
  { id: 203, sector_type: 'Technology', sector_name: 'Materials & Nanotech', name_en: 'Materials & Nanotech', name_ja: 'ナノテクノロジー', name_zh_hans: '纳米技术', name_zh_hant: '納米技術', name_ko: '나노 기술' },

  // Sustainability
  { id: 244, sector_type: 'Sustainability', sector_name: 'Agritech', name_en: 'Agritech', name_ja: 'アグリテック', name_zh_hans: '能源', name_zh_hant: 'Energy General', name_ko: 'Energy General' },
  { id: 232, sector_type: 'Sustainability', sector_name: 'Alternative Energy', name_en: 'Alternative Energy', name_ja: '代替エネルギー', name_zh_hans: '替代能源', name_zh_hant: '替代能源', name_ko: '대체 에너지' },
  { id: 43, sector_type: 'Sustainability', sector_name: 'Energy Alternatives', name_en: 'Energy Alternatives', name_ja: 'エネルギー', name_zh_hans: '能源', name_zh_hant: 'Energy', name_ko: 'Energy' },
  { id: 250, sector_type: 'Sustainability', sector_name: 'Environment ESG', name_en: 'Environment ESG', name_ja: '環境 ESG', name_zh_hans: '环境 ESG', name_zh_hant: '環境 ESG', name_ko: '환경 ESG' },
  { id: 245, sector_type: 'Sustainability', sector_name: 'EVs Transportation', name_en: 'EVs Transportation', name_ja: 'EV', name_zh_hans: 'EVs Transportation', name_zh_hant: 'EVs Transportation', name_ko: 'EVs Transportation' },
  { id: 247, sector_type: 'Sustainability', sector_name: 'Smart Cities', name_en: 'Smart Cities', name_ja: 'Smart Cities', name_zh_hans: 'Smart Cities', name_zh_hant: 'Smart Cities', name_ko: 'Smart Cities' },
  { id: 212, sector_type: 'Sustainability', sector_name: 'Water', name_en: 'Water', name_ja: '水', name_zh_hans: 'Water', name_zh_hant: 'Water', name_ko: 'Water' },

  // Financial
  { id: 215, sector_type: 'Financial', sector_name: 'Banking & Insurance', name_en: 'Banking & Insurance', name_ja: '銀行', name_zh_hans: 'Banking & Insurance', name_zh_hant: 'Banking & Insurance', name_ko: 'Banking & Insurance' },
  { id: 94, sector_type: 'Financial', sector_name: 'Cards & Payments', name_en: 'Cards & Payments', name_ja: 'キャッシュレス', name_zh_hans: '信用卡和付款', name_zh_hant: '信用卡和付款', name_ko: '신용 카드 및 결제' },
  { id: 108, sector_type: 'Financial', sector_name: 'Daily Finance', name_en: 'Daily Finance', name_ja: '金融', name_zh_hans: '金融', name_zh_hant: '金融', name_ko: '금융' },
  { id: 92, sector_type: 'Financial', sector_name: 'Exchanges & Software', name_en: 'Exchanges & Software', name_ja: '取引所', name_zh_hans: 'Exchanges & Software', name_zh_hant: 'Exchanges & Software', name_ko: 'Exchanges & Software' },
  { id: 257, sector_type: 'Financial', sector_name: 'FinTech', name_en: 'FinTech', name_ja: 'FinTech', name_zh_hans: 'FinTech', name_zh_hant: 'FinTech', name_ko: 'FinTech' },
  { id: 213, sector_type: 'Financial', sector_name: 'Funds & Equities', name_en: 'Funds & Equities', name_ja: 'ファンド', name_zh_hans: 'Funds & Equities', name_zh_hant: 'Funds & Equities', name_ko: 'Funds & Equities' },
  { id: 233, sector_type: 'Financial', sector_name: 'Legal & Compliance', name_en: 'Legal & Compliance', name_ja: 'コンプライアンス', name_zh_hans: 'Legal & Compliance', name_zh_hant: 'Legal & Compliance', name_ko: 'Legal & Compliance' },
  { id: 216, sector_type: 'Financial', sector_name: 'PE VC & Alternatives', name_en: 'PE VC & Alternatives', name_ja: 'アントレプレナー', name_zh_hans: 'Venture Capital & PE', name_zh_hant: 'Venture Capital & PE', name_ko: 'Venture Capital & PE' },
  { id: 113, sector_type: 'Financial', sector_name: 'Real Estate & REIT', name_en: 'Real Estate & REIT', name_ja: '不動産', name_zh_hans: 'Real Estate & REIT', name_zh_hant: 'Real Estate & REIT', name_ko: 'Real Estate & REIT' },
  { id: 248, sector_type: 'Financial', sector_name: 'Trade Finance', name_en: 'Trade Finance', name_ja: 'トレードファイナンス', name_zh_hans: 'Trade Finance', name_zh_hant: 'Trade Finance', name_ko: 'Trade Finance' },

  // Industrial
  { id: 211, sector_type: 'Industrial', sector_name: 'Aerospace & Defence', name_en: 'Aerospace & Defence', name_ja: '宇宙・防衛', name_zh_hans: '航空航天和国防', name_zh_hant: '航空航天和國防', name_ko: '항공 우주 및 방위' },
  { id: 171, sector_type: 'Industrial', sector_name: 'Airlines', name_en: 'Airlines', name_ja: '航空', name_zh_hans: '监管', name_zh_hant: '監管', name_ko: '규제' },
  { id: 123, sector_type: 'Industrial', sector_name: 'Automotive', name_en: 'Automotive', name_ja: '自動車', name_zh_hans: '通用汽车', name_zh_hant: '通用汽車', name_ko: '자동차' },
  { id: 204, sector_type: 'Industrial', sector_name: 'Chemicals Spec.Chem', name_en: 'Chemicals Spec.Chem', name_ja: '化学', name_zh_hans: '化学', name_zh_hant: '化學', name_ko: '화학' },
  { id: 33, sector_type: 'Industrial', sector_name: 'Construct Engineering', name_en: 'Construct Engineering', name_ja: '建設', name_zh_hans: 'Construction', name_zh_hant: 'Construction', name_ko: 'Construction' },
  { id: 256, sector_type: 'Industrial', sector_name: 'Cosmetics Spec.Chem', name_en: 'Cosmetics Spec.Chem', name_ja: '化粧品素材', name_zh_hans: '化妆品', name_zh_hant: '化妝品', name_ko: '화장품 / 제원' },
  { id: 77, sector_type: 'Industrial', sector_name: 'Food & Beverage', name_en: 'Food & Beverage', name_ja: '食品・飲料', name_zh_hans: '食品', name_zh_hant: 'Food', name_ko: 'Food' },
  { id: 91, sector_type: 'Industrial', sector_name: 'Manufacturing', name_en: 'Manufacturing', name_ja: '製造', name_zh_hans: 'Manufacturing', name_zh_hant: 'Manufacturing', name_ko: 'Manufacturing' },
  { id: 185, sector_type: 'Industrial', sector_name: 'Marine & Offshore', name_en: 'Marine & Offshore', name_ja: '海洋・オフショア', name_zh_hans: '海洋/近海', name_zh_hant: '海洋/近海', name_ko: '해양 / 해양' },
  { id: 99, sector_type: 'Industrial', sector_name: 'Metals & Mining', name_en: 'Metals & Mining', name_ja: '金属・鉱業', name_zh_hans: '金属', name_zh_hant: 'Metals', name_ko: 'Metals' },
  { id: 101, sector_type: 'Industrial', sector_name: 'Oil & Gas', name_en: 'Oil & Gas', name_ja: '石油・ガス', name_zh_hans: 'Oil & Gas', name_zh_hant: 'Oil & Gas', name_ko: 'Oil & Gas' },
  { id: 157, sector_type: 'Industrial', sector_name: 'Print & Package', name_en: 'Print & Package', name_ja: 'パッケージング', name_zh_hans: '纸及纸浆', name_zh_hant: '紙及紙漿', name_ko: '종이 및 펄프' },
  { id: 152, sector_type: 'Industrial', sector_name: 'Transport & Logistics', name_en: 'Transport & Logistics', name_ja: '輸送', name_zh_hans: 'Transport & Logistics', name_zh_hant: 'Transport & Logistics', name_ko: 'Transport & Logistics' },

  // Medicine
  { id: 196, sector_type: 'Medicine', sector_name: 'Alternative', name_en: 'Alternative', name_ja: 'カンナビス', name_zh_hans: 'Alternative', name_zh_hant: 'Alternative', name_ko: 'Alternative' },
  { id: 176, sector_type: 'Medicine', sector_name: 'BioTech', name_en: 'BioTech', name_ja: 'バイオテック', name_zh_hans: '制药及生物技术', name_zh_hant: '製藥及生物技術', name_ko: 'Biotech' },
  { id: 249, sector_type: 'Medicine', sector_name: 'Clinical Trials', name_en: 'Clinical Trials', name_ja: '臨床試験', name_zh_hans: 'Clinical Trials', name_zh_hant: 'Clinical Trials', name_ko: 'Clinical Trials' },
  { id: 97, sector_type: 'Medicine', sector_name: 'Healthcare & Pharm', name_en: 'Healthcare & Pharm', name_ja: 'ヘルスケア', name_zh_hans: '健康与医药', name_zh_hant: 'Healthcare & Pharm', name_ko: 'Healthcare & Pharm' },
  { id: 246, sector_type: 'Medicine', sector_name: 'MedTech', name_en: 'MedTech', name_ja: 'メドテック', name_zh_hans: 'MedTech', name_zh_hant: 'MedTech', name_ko: 'MedTech' },

  // Lifestyle
  { id: 207, sector_type: 'Lifestyle', sector_name: 'Art Music & Design', name_en: 'Art Music & Design', name_ja: 'アート・デザイン', name_zh_hans: 'Design & Art', name_zh_hant: 'Design & Art', name_ko: 'Design & Art' },
  { id: 255, sector_type: 'Lifestyle', sector_name: 'Beauty & Skin Care', name_en: 'Beauty & Skin Care', name_ja: '美容・スキンケア', name_zh_hans: '美容/护肤', name_zh_hant: '美容/護膚', name_ko: '스킨케어' },
  { id: 241, sector_type: 'Lifestyle', sector_name: 'Boating', name_en: 'Boating', name_ja: 'ボート', name_zh_hans: 'Boating', name_zh_hant: 'Boating', name_ko: 'Boating' },
  { id: 122, sector_type: 'Lifestyle', sector_name: 'Education', name_en: 'Education', name_ja: '教育', name_zh_hans: '教育', name_zh_hant: '教育', name_ko: '교육' },
  { id: 252, sector_type: 'Lifestyle', sector_name: 'eSports Gaming', name_en: 'eSports Gaming', name_ja: 'ゲーム', name_zh_hans: '运动会', name_zh_hant: '運動會', name_ko: '게임' },
  { id: 208, sector_type: 'Lifestyle', sector_name: 'Fashion & Apparel', name_en: 'Fashion & Apparel', name_ja: 'ファッション', name_zh_hans: '时尚服装', name_zh_hant: '時尚服裝', name_ko: '패션 의류' },
  { id: 174, sector_type: 'Lifestyle', sector_name: 'Hospitality', name_en: 'Hospitality', name_ja: 'ホスピタリティ', name_zh_hans: '酒店', name_zh_hant: '酒店', name_ko: '환대' },
  { id: 242, sector_type: 'Lifestyle', sector_name: 'Motorsports', name_en: 'Motorsports', name_ja: 'モーターサイクル', name_zh_hans: 'Motorsports', name_zh_hant: 'Motorsports', name_ko: 'Motorsports' },
  { id: 253, sector_type: 'Lifestyle', sector_name: 'Regional', name_en: 'Regional', name_ja: 'ローカル', name_zh_hans: '本地', name_zh_hant: '本地', name_ko: '노동 조합 지부' },
  { id: 206, sector_type: 'Lifestyle', sector_name: 'Retail & eCommerce', name_en: 'Retail & eCommerce', name_ja: 'eコマース', name_zh_hans: '消费者', name_zh_hant: '消費者', name_ko: '소비자' },
  { id: 191, sector_type: 'Lifestyle', sector_name: 'Sports', name_en: 'Sports', name_ja: 'スポーツ', name_zh_hans: 'Sports', name_zh_hant: 'Sports', name_ko: 'Sports' },
  { id: 155, sector_type: 'Lifestyle', sector_name: 'Travel & Tourism', name_en: 'Travel & Tourism', name_ja: 'トラベル', name_zh_hans: '旅游观光', name_zh_hant: 'Travel & Tourism', name_ko: 'Travel & Tourism' },
  { id: 254, sector_type: 'Lifestyle', sector_name: 'Watches & Jewelry', name_en: 'Watches & Jewelry', name_ja: '時計・ジュエリー', name_zh_hans: '手表/珠宝', name_zh_hant: '手錶/珠寶', name_ko: '시계 / 쥬얼리' },

  // Business
  { id: 223, sector_type: 'Business', sector_name: 'ASEAN', name_en: 'ASEAN', name_ja: '東南アジア', name_zh_hans: 'ASEAN', name_zh_hant: 'ASEAN', name_ko: 'ASEAN' },
  { id: 187, sector_type: 'Business', sector_name: 'Daily News', name_en: 'Daily News', name_ja: 'ビジネス', name_zh_hans: '业务', name_zh_hant: '業務', name_ko: 'Business' },
  { id: 238, sector_type: 'Business', sector_name: 'Government', name_en: 'Government', name_ja: '政府', name_zh_hans: 'Government', name_zh_hant: 'Government', name_ko: 'Government' },
  { id: 200, sector_type: 'Business', sector_name: 'HR', name_en: 'HR', name_ja: '人事', name_zh_hans: '人力资源', name_zh_hant: '人力資源', name_ko: '인적 자원' },
  { id: 234, sector_type: 'Business', sector_name: 'Local Biz', name_en: 'Local Biz', name_ja: 'ローカルビジネス', name_zh_hans: 'Local Biz', name_zh_hant: 'Local Biz', name_ko: 'Local Biz' },
  { id: 263, sector_type: 'Business', sector_name: 'SMEs', name_en: 'SMEs', name_ja: 'SMEs', name_zh_hans: 'SMEs', name_zh_hant: 'SMEs', name_ko: 'SMEs' },
  { id: 251, sector_type: 'Business', sector_name: 'Startups', name_en: 'Startups', name_ja: 'スタートアップ', name_zh_hans: 'Startups', name_zh_hant: 'Startups', name_ko: 'Startups' },
  { id: 28, sector_type: 'Business', sector_name: 'Trade Shows', name_en: 'Trade Shows', name_ja: 'トレードショー', name_zh_hans: '展会', name_zh_hant: 'Trade Show', name_ko: 'Trade Show' },

  // CryptoCurrency
  { id: 214, sector_type: 'CryptoCurrency', sector_name: 'Blockchain Technology', name_en: 'Blockchain Technology', name_ja: 'フィンテック', name_zh_hans: 'Blockchain Technology', name_zh_hant: 'Blockchain Technology', name_ko: 'Blockchain Technology' },
  { id: 202, sector_type: 'CryptoCurrency', sector_name: 'Crypto Exchange', name_en: 'Crypto Exchange', name_ja: 'Crypto Exchange', name_zh_hans: 'Crypto Exchange', name_zh_hant: 'Crypto Exchange', name_ko: 'Crypto Exchange' },
  { id: 237, sector_type: 'CryptoCurrency', sector_name: 'ICOs & Tokens', name_en: 'ICOs & Tokens', name_ja: 'ICO', name_zh_hans: 'ICO', name_zh_hant: 'ICO', name_ko: 'ICO' },
  { id: 260, sector_type: 'CryptoCurrency', sector_name: 'Metaverse Games', name_en: 'Metaverse Games', name_ja: 'Metaverse Games', name_zh_hans: 'Metaverse Games', name_zh_hant: 'Metaverse Games', name_ko: 'Metaverse Games' },
  { id: 258, sector_type: 'CryptoCurrency', sector_name: 'Mining & Staking', name_en: 'Mining & Staking', name_ja: 'Mining & Staking', name_zh_hans: 'Mining & Staking', name_zh_hant: 'Mining & Staking', name_ko: 'Mining & Staking' },
  { id: 259, sector_type: 'CryptoCurrency', sector_name: 'NFTs', name_en: 'NFTs', name_ja: 'NFTs', name_zh_hans: 'NFTs', name_zh_hant: 'NFTs', name_ko: 'NFTs' },
]

// All unique sector types for grouping in the UI
export const SECTOR_TYPES = [...new Set(SECTORS.map(s => s.sector_type))]

// Search helper — searches sector_name and sector_type, case-insensitive
export function searchSectors(query: string): Sector[] {
  if (!query.trim()) return SECTORS
  const q = query.toLowerCase()
  return SECTORS.filter(
    s =>
      s.sector_name.toLowerCase().includes(q) ||
      s.sector_type.toLowerCase().includes(q) ||
      s.name_en.toLowerCase().includes(q)
  )
}

// Get all sectors for a given type
export function getSectorsByType(type: string): Sector[] {
  return SECTORS.filter(s => s.sector_type === type)
}
