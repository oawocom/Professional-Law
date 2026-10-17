// Super admin panelinin bu tətbiqə aid sözləri və imkanları.
// page.tsx Education Center və Professional Law-da eynidir; fərq yalnız bu fayldadır.

export const CONFIG = {
  product: 'Professional Law',
  accent: '#8A2D3F',
  accentHover: '#722436',
  accentSoft: '#F7EAED',

  unit: 'Büro',
  unitPl: 'Bürolar',
  unitLower: 'büro',
  unitPlLower: 'bürolar',
  unitGen: 'Büronun', // "Büronun adı"
  unitDat: 'büroya', // "büroya menecer əlavə et"
  newUnit: 'Yeni büro',
  created: 'Büro yaradıldı',

  admin: 'Menecer',
  adminGen: 'Menecerin',
  addAdmin: 'Menecer əlavə et',
  firstAdmin: 'İlk menecer',

  // e-poçt qurulmayanda nə işləmir
  mailMissing: 'Yeni vəkil və müştərilərin e-poçt təsdiq kodları, parol kodları getmir.',

  minPassword: 6,
  domainExample: 'buro.az',

  // kartdakı saylar: backend-in counts açarları
  counts: [
    { key: 'users', label: 'Hesab' },
    { key: 'managers', label: 'Menecer' },
    { key: 'lawyers', label: 'Vəkil' },
    { key: 'clients', label: 'Müştəri' },
    { key: 'contracts', label: 'Müqavilə' },
    { key: 'tasks', label: 'Tapşırıq' },
  ],
  // siyahıdakı və yuxarıdakı əsas saylar
  mainCounts: [
    { key: 'users', label: 'Hesab' },
    { key: 'lawyers', label: 'Vəkil' },
    { key: 'clients', label: 'Müştəri' },
    { key: 'contracts', label: 'Müqavilə' },
  ],
  roles: { manager: 'Menecer', lawyer: 'Vəkil', client: 'Müştəri' } as Record<string, string>,

  // bu tətbiqdə olan əlavə imkanlar (məktub jurnalı, audit, bərpa linki hələ yoxdur)
  features: { resetLink: false, mailLog: false, audit: false },
};
