// ============================================================
// Mərkəzləşdirilmiş tarix formatlaşdırma — bütün sistemdə YALNIZ bu
// funksiyalar istifadə olunmalıdır. Intl.toLocaleDateString('az-AZ', {month:'short'})
// kimi lokal-asılı formatlar bəzi mühitlərdə gözlənilməz qısaltmalar
// (məs. "MO07") göstərə bilir — buna görə tarix əl ilə, rəqəmsal
// gün/ay/il formatında qurulur.
// ============================================================

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toDate(d: any): Date | null {
  if (!d) return null;
  try {
    var dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return null;
    return dt;
  } catch (e) {
    return null;
  }
}

// 13.07.2026
export function formatDate(d: any, fallback: string = '-'): string {
  var dt = toDate(d);
  if (!dt) return fallback;
  return pad2(dt.getDate()) + '.' + pad2(dt.getMonth() + 1) + '.' + dt.getFullYear();
}

// 13.07.2026 17:05
export function formatDateTime(d: any, fallback: string = '-'): string {
  var dt = toDate(d);
  if (!dt) return fallback;
  return formatDate(dt) + ' ' + pad2(dt.getHours()) + ':' + pad2(dt.getMinutes());
}

// 17:05
export function formatTime(d: any, fallback: string = ''): string {
  var dt = toDate(d);
  if (!dt) return fallback;
  return pad2(dt.getHours()) + ':' + pad2(dt.getMinutes());
}

// "13.07.2026" görəndə "bugün" / "sabah" / "dünən" kimi göstərmək faydalı olan yerlər üçün
export function formatDateRelative(d: any, fallback: string = '-'): string {
  var dt = toDate(d);
  if (!dt) return fallback;
  var now = new Date();
  var startOfDay = function(x: Date) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
  var diffDays = Math.round((startOfDay(dt) - startOfDay(now)) / 86400000);
  if (diffDays === 0) return 'Bugün';
  if (diffDays === 1) return 'Sabah';
  if (diffDays === -1) return 'Dünən';
  return formatDate(dt, fallback);
}
