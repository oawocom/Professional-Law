// ============================================================
// TASK STATUS CONSTANTS — Vahid status sistemi
// ============================================================

export interface TaskSubStatus {
  key: string;
  label: string;
  group: 'waiting' | 'in_progress' | 'completed';
}

export interface CompletionOption {
  key: string;
  label: string;
}

export var STATUS_GROUPS = {
  waiting: { key: 'waiting', label: 'Gözləyir', color: 'bg-yellow-100 text-yellow-800', borderColor: 'border-yellow-400' },
  in_progress: { key: 'in_progress', label: 'İcrada', color: 'bg-blue-100 text-blue-800', borderColor: 'border-blue-400' },
  completed: { key: 'completed', label: 'Yekunlaşdı', color: 'bg-green-100 text-green-800', borderColor: 'border-green-400' },
};

// Əsas statuslar
export var ALL_STATUSES: TaskSubStatus[] = [
  // Gözləyir
  { key: 'tehkim_gozleyir', label: 'Təhkim gözləyir', group: 'waiting' },
  { key: 'tehkim_olundu', label: 'Vəkil təhkim edildi', group: 'waiting' },
  // İcrada
  { key: 'mehkemeye_gonderildi', label: 'Məhkəməyə göndərildi', group: 'in_progress' },
  // Yekunlaşdı
  { key: 'is_yekunlasdi', label: 'İş yekunlaşdı', group: 'completed' },
];

// Vəkilin seçə biləcəyi əsas statuslar
export var LAWYER_STATUSES = [
  { key: 'mehkemeye_gonderildi', label: 'Məhkəməyə göndərildi' },
  { key: 'is_yekunlasdi', label: 'İş yekunlaşdı' },
];

// İş yekunlaşdıqda seçilən nəticə variantları
export var COMPLETION_OPTIONS: CompletionOption[] = [
  { key: 'iddia_temin_edildi', label: 'İddia tam təmin edildi' },
  { key: 'iddia_qismen_temin', label: 'İddia qismən təmin edildi' },
  { key: 'iddia_redd_edildi', label: 'İddia rədd edildi' },
  { key: 'barisiq', label: 'Barışıq razılaşması' },
  { key: 'diger_yekun', label: 'Digər' },
];

// Digər statuslar — vəkil istəsə bu qrupdan da seçə bilər
export var OTHER_STATUSES = [
  { key: 'pretenziya_gonderildi', label: 'Pretenziya göndərildi' },
  { key: 'mehkeme_qebul_etdi', label: 'Məhkəmə icraata qəbul etdi' },
  { key: 'mehkeme_yolverilmezlik', label: 'İddianın yolverilməzliyi' },
  { key: 'mehkeme_geri_qaytardi', label: 'İddia ərizəsi geri qaytarıldı' },
  { key: 'barisiq_erizesi', label: 'Barışıq ərizəsi' },
  { key: 'apellyasiya_gonderildi', label: 'Apellyasiya şikayəti göndərildi' },
  { key: 'kassasiya_gonderildi', label: 'Kassasiya şikayəti göndərildi' },
  { key: 'icra_meqamina_gonderildi', label: 'İcra məqamına göndərildi' },
  { key: 'diger', label: 'Digər' },
];

export function getStatusLabel(status: string): string {
  // Check all lists
  var all = ALL_STATUSES.concat(
    OTHER_STATUSES.map(function(s) { return { ...s, group: 'in_progress' as const }; })
  );
  var found = all.find(function(s) { return s.key === status; });
  if (found) return found.label;
  // Legacy mapping
  switch (status) {
    case 'new': return 'Yeni';
    case 'assigned': case 'tehkim_olundu': return 'Vəkil təhkim edildi';
    case 'in-progress': case 'in_progress': return 'İcrada';
    case 'completed': return 'Tamamlandı';
    case 'cancelled': return 'Ləğv edildi';
    case 'rejected': return 'Rədd edildi';
    case 'pending': return 'Gözləyir';
    default: return status || 'Naməlum';
  }
}

export function getStatusColor(status: string): string {
  // BUG DÜZƏLİŞİ (2026-09): "rejected"/"cancelled" üçün qırmızı rəng sətri
  // əvvəllər HEÇ VAXT işə düşmürdü (əlçatmaz/dead kod) — çünki `getStatusGroup`
  // bu statusları artıq "completed" qrupuna aid edir (bu, "aktiv deyil" filtrasiyası
  // üçün düzgündür və toxunulmayıb), amma aşağıdakı qrup-yoxlaması bu sətirdən
  // ƏVVƏL gəldiyi üçün həmişə "yaşıl" (uğur) rənglə qarşılaşırdı. Nəticədə
  // rədd edilmiş/ləğv edilmiş tapşırıqlar bütün 3 interfeysdə (16 fayl bu
  // funksiyadan istifadə edir) yaşıl "uğurlu" nişanla göstərilirdi.
  if (status === 'rejected' || status === 'cancelled') return 'bg-red-100 text-red-800';
  var group = getStatusGroup(status);
  if (group === 'waiting') return 'bg-yellow-100 text-yellow-800';
  if (group === 'in_progress') return 'bg-blue-100 text-blue-800';
  if (group === 'completed') return 'bg-green-100 text-green-800';
  return 'bg-gray-100 text-gray-800';
}

export function getStatusGroup(status: string): string {
  var found = ALL_STATUSES.find(function(s) { return s.key === status; });
  if (found) return found.group;
  // Legacy
  if (['new', 'pending', 'tehkim_gozleyir'].includes(status)) return 'waiting';
  if (['tehkim_olundu', 'assigned'].includes(status)) return 'waiting';
  if (['completed', 'is_yekunlasdi', 'is_tamamlandi', 'is_tehvil_verildi'].includes(status)) return 'completed';
  if (['rejected', 'cancelled'].includes(status)) return 'completed';
  return 'in_progress';
}

// ============================================================
// isCompletedStatus / isTerminalStatus — VAHİD "tamamlanma" yoxlaması.
// Sistemin müxtəlif hissələrində (Vəkil/Müştəri/Menecer panelləri) tapşırığın
// "tamamlanıb-tamamlanmadığı" hər dəfə fərqli, natamam siyahılarla (bəziləri
// həqiqi kodu "is_yekunlasdi" belə daxil etmirdi) yoxlanılırdı — nəticədə
// tamamlanmış işlər "aktiv" kimi sayılır, statistikalar səhv çıxırdı.
// Bundan sonra HƏR YERDƏ bu iki funksiya istifadə edilməlidir.
// ============================================================
export function isCompletedStatus(status: string): boolean {
  return ['completed', 'is_yekunlasdi', 'is_tamamlandi', 'is_tehvil_verildi', 'icra_olundu'].includes(status);
}

export function isTerminalStatus(status: string): boolean {
  return isCompletedStatus(status) || status === 'cancelled' || status === 'rejected' || status === 'withdrawn';
}