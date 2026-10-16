// Azərbaycan Respublikası elektron məhkəmə sisteminə uyğun
// İddia istiqamətləri, növləri, alt başlıqlar və sənəd nümunələri

// ==================== İDDİA İSTİQAMƏTLƏRİ ====================
export var CLAIM_DIRECTIONS = [
  { key: "mehkeme", label: "Məhkəmə işləri" },
  { key: "dovlet_temsil", label: "Dövlət orqanlarında təmsilçilik" },
  { key: "korporativ", label: "Korporativ işlər" },
  { key: "huquqi_meslehet", label: "Hüquqi məsləhət və müqavilə işləri" },
  { key: "icra", label: "İcra icraatı" },
  { key: "beynelxalq", label: "Beynəlxalq arbitraj və münasibətlər" },
  { key: "notariat", label: "Notariat və sənəd təsdiqi" },
];

// ==================== İDDİA NÖVLƏRİ ====================
export var CLAIM_TYPES = [
  // Məhkəmə işləri
  { key: "mulki", label: "Mülki iddia", direction: "mehkeme", subs: [
    "Alqı-satqı müqaviləsi ilə bağlı mübahisə",
    "Borc tələbi (pul öhdəliyi)",
    "Zərərin ödənilməsi tələbi",
    "Əsassız varlanmadan yaranan tələb",
    "Podrat müqaviləsi ilə bağlı mübahisə",
    "Xidmət müqaviləsi ilə bağlı mübahisə",
    "Bağışlama müqaviləsinə etiraz",
    "Girov (ipoteka) müqaviləsi ilə bağlı mübahisə",
    "Zaminlik müqaviləsi ilə bağlı mübahisə",
    "Saxlama müqaviləsi ilə bağlı mübahisə",
    "Tapşırıq müqaviləsi ilə bağlı mübahisə",
    "Müqavilənin etibarsız sayılması",
    "Əqdlərin ləğvi",
    "Digər mülki mübahisə",
  ]},
  { key: "emek", label: "Əmək mübahisəsi", direction: "mehkeme", subs: [
    "İşə bərpa tələbi",
    "Əmək haqqının ödənilməsi tələbi",
    "Qanunsuz işdən çıxarma",
    "Əmək müqaviləsinin şərtlərinin pozulması",
    "İntizam tənbehinin ləğvi",
    "Kompensasiya tələbi",
    "İş şəraitinin dəyişdirilməsi ilə bağlı mübahisə",
    "Əlavə iş vaxtının ödənilməsi",
    "Məzuniyyət hesablanması mübahisəsi",
    "İşəgötürənin qərarına etiraz",
    "Ezamiyyə və yol xərclərinin ödənilməsi",
    "Digər əmək mübahisəsi",
  ]},
  { key: "aile", label: "Ailə mübahisəsi", direction: "mehkeme", subs: [
    "Boşanma tələbi",
    "Alimentin tutulması",
    "Uşaqların yaşayış yerinin müəyyən edilməsi",
    "Əmlakın bölünməsi",
    "Atalığın müəyyən edilməsi",
    "Atalığa etiraz",
    "Övladlığa götürmə",
    "Övladlığın ləğvi",
    "Nikahın etibarsız sayılması",
    "Valideyn hüquqlarının məhdudlaşdırılması",
    "Valideyn hüquqlarından məhrum etmə",
    "Uşaqla ünsiyyət qaydasının müəyyən edilməsi",
    "Digər ailə mübahisəsi",
  ]},
  { key: "emlak", label: "Əmlak mübahisəsi", direction: "mehkeme", subs: [
    "Mülkiyyət hüququnun tanınması",
    "Daşınmaz əmlak mübahisəsi",
    "Torpaq mübahisəsi",
    "Kirayə haqqı mübahisəsi",
    "Sərhəd mübahisəsi",
    "Tikili ilə bağlı mübahisə",
    "Qonşuluq hüququ mübahisəsi",
    "Servitut hüququ mübahisəsi",
    "Əmlakın müsadirəsinə etiraz",
    "Əmlak üzərində yüklülüyün aradan qaldırılması",
    "Digər əmlak mübahisəsi",
  ]},
  { key: "icare", label: "İcarə mübahisəsi", direction: "mehkeme", subs: [
    "İcarə haqqının ödənilməsi tələbi",
    "İcarə müqaviləsinin xitamı",
    "İcarəyə verilmiş əmlakın qaytarılması",
    "İcarəçinin hüquqlarının pozulması",
    "Digər icarə mübahisəsi",
  ]},
  { key: "lizinq", label: "Lizinq mübahisəsi", direction: "mehkeme", subs: [
    "Lizinq ödənişlərinin tələbi",
    "Lizinq müqaviləsinin pozulması",
    "Lizinq predmetinin qaytarılması",
    "Digər lizinq mübahisəsi",
  ]},
  { key: "sigorta", label: "Sığorta mübahisəsi", direction: "mehkeme", subs: [
    "Sığorta ödənişi tələbi",
    "Sığorta müqaviləsinin şərtlərinə etiraz",
    "Sığorta hadisəsinin tanınması",
    "Reqres tələbi",
    "Digər sığorta mübahisəsi",
  ]},
  { key: "miras", label: "Miras mübahisəsi", direction: "mehkeme", subs: [
    "Vərəsəlik şəhadətnaməsinə etiraz",
    "Vəsiyyətnamənin etibarsız sayılması",
    "Miras payının müəyyən edilməsi",
    "Vərəsəlik hüququnun tanınması",
    "Məcburi pay tələbi",
    "Mirasın qəbulu müddətinin bərpası",
    "Digər miras mübahisəsi",
  ]},
  { key: "istehlakci", label: "İstehlakçı hüquqları", direction: "mehkeme", subs: [
    "Malın qaytarılması/dəyişdirilməsi",
    "Xidmət keyfiyyətinə görə tələb",
    "Zərərin ödənilməsi",
    "İstehlakçı kreditindən yaranan mübahisə",
    "Digər istehlakçı mübahisəsi",
  ]},
  { key: "bank", label: "Bank və kredit mübahisəsi", direction: "mehkeme", subs: [
    "Kredit borcunun tələbi",
    "Kredit müqaviləsinə etiraz",
    "Faiz hesablamasına etiraz",
    "Girov əmlakının realizasiyası",
    "Bank hesabına həbs qoyulmasına etiraz",
    "Digər bank mübahisəsi",
  ]},
  // İnzibati işlər
  { key: "inzibati", label: "İnzibati iş", direction: "dovlet_temsil", subs: [
    "Dövlət orqanının qərarına etiraz",
    "İnzibati cərimənin ləğvi",
    "İcazənin verilməməsinə etiraz",
    "Qeydiyyatdan imtinaya etiraz",
    "Tender nəticəsinə etiraz",
    "Fəaliyyətin dayandırılmasına etiraz",
    "Digər inzibati iş",
  ]},
  { key: "vergi", label: "Vergi mübahisəsi", direction: "dovlet_temsil", subs: [
    "Vergi yoxlaması aktına etiraz",
    "Əlavə vergi hesablanmasına etiraz",
    "Vergi güzəştinin tətbiqi tələbi",
    "Cərimə və faizlərə etiraz",
    "Digər vergi mübahisəsi",
  ]},
  { key: "gomruk", label: "Gömrük mübahisəsi", direction: "dovlet_temsil", subs: [
    "Gömrük dəyərinin müəyyən edilməsinə etiraz",
    "Malların müsadirəsinə etiraz",
    "Gömrük rüsumuna etiraz",
    "Digər gömrük mübahisəsi",
  ]},
  // Korporativ işlər
  { key: "korporativ", label: "Korporativ mübahisə", direction: "korporativ", subs: [
    "Səhmdarlar arasında mübahisə",
    "Təsisçilər arasında mübahisə",
    "Şirkət rəhbərliyinin qərarına etiraz",
    "Dividendlərin ödənilməsi tələbi",
    "Şirkətin ləğvi tələbi",
    "Nizamnamə dəyişikliklərinə etiraz",
    "Digər korporativ mübahisə",
  ]},
  { key: "kommersiya", label: "Kommersiya mübahisəsi", direction: "korporativ", subs: [
    "Ticarət müqaviləsi mübahisəsi",
    "Əqli mülkiyyət hüquqlarının pozulması",
    "Rəqabət hüququnun pozulması",
    "Françayzinq mübahisəsi",
    "Distribyutor müqaviləsi mübahisəsi",
    "Digər kommersiya mübahisəsi",
  ]},
  { key: "iflas", label: "İflas işi", direction: "korporativ", subs: [
    "Müflisləşmə ərizəsi",
    "Kreditorların tələblərinin siyahısına etiraz",
    "İflas idarəçisinin hərəkətlərinə etiraz",
    "Borcun restrukturizasiyası",
    "Digər iflas işi",
  ]},
  // Xüsusi icraat
  { key: "xususi", label: "Xüsusi icraat", direction: "mehkeme", subs: [
    "Hüquqi faktın müəyyən edilməsi",
    "Ölmüş elan etmə",
    "İtkin düşmüş hesab etmə",
    "Fəaliyyət qabiliyyətinin məhdudlaşdırılması",
    "Sənədin bərpası",
    "Qeydiyyat aktlarına düzəliş",
    "Digər xüsusi icraat",
  ]},
  // İcra icraatı
  { key: "icra", label: "İcra icraatı işi", direction: "icra", subs: [
    "İcra sənədinin icrası",
    "İcra məmurunun hərəkətlərinə etiraz",
    "Əmlak üzərinə həbsin qoyulması",
    "Borcun hissə-hissə ödənilməsi barədə",
    "Digər icra icraatı işi",
  ]},
  // Hüquqi məsləhət
  { key: "muqavile", label: "Müqavilə hazırlanması", direction: "huquqi_meslehet", subs: [
    "Alqı-satqı müqaviləsi",
    "İcarə müqaviləsi",
    "Xidmət müqaviləsi",
    "Əmək müqaviləsi",
    "Kredit / Girov müqaviləsi",
    "Şəriklik müqaviləsi",
    "NDA / Məxfilik müqaviləsi",
    "Digər müqavilə",
  ]},
  { key: "meslehet", label: "Hüquqi rəy və məsləhət", direction: "huquqi_meslehet", subs: [
    "Hüquqi ekspertiza",
    "Qanunvericiliyin təhlili",
    "Risk qiymətləndirilməsi",
    "Digər məsləhət",
  ]},
  // Beynəlxalq
  { key: "arbitraj", label: "Beynəlxalq arbitraj", direction: "beynelxalq", subs: [
    "ICC arbitrajı",
    "LCIA arbitrajı",
    "Yerli arbitraj",
    "Arbitraj qərarının tanınması və icrası",
    "Digər arbitraj",
  ]},
];

// ==================== SƏNƏD NÜMUNƏLƏRİ ====================
export var DOCUMENT_TEMPLATES = [
  { key: "iddia_erizesi", label: "İddia ərizəsi" },
  { key: "erizeci_sexsiyyet", label: "Ərizəçinin şəxsiyyət vəsiqəsinin surəti" },
  { key: "cavabdeh_sexsiyyet", label: "Cavabdehin şəxsiyyət vəsiqəsinin surəti" },
  { key: "etibarname", label: "Etibarnamə" },
  { key: "dovlet_rusumu", label: "Dövlət rüsumu qəbzi" },
  { key: "muqavile_sureti", label: "Müqavilənin surəti" },
  { key: "akt_protokol", label: "Akt / Protokol" },
  { key: "arayis", label: "Arayış" },
  { key: "cixaris", label: "Çıxarış (DSMF, vergi, daşınmaz əmlak və s.)" },
  { key: "qebz_odenis", label: "Qəbz / Ödəniş sənədi" },
  { key: "ekspertiza_reyi", label: "Ekspertiza rəyi" },
  { key: "mehkeme_qerari", label: "Məhkəmə qərarının surəti" },
  { key: "icra_senedi", label: "İcra sənədi" },
  { key: "vesiyyetname", label: "Vəsiyyətnamə" },
  { key: "vereslik_sehadetname", label: "Vərəsəlik şəhadətnaməsi" },
  { key: "nikah_sehadnamesi", label: "Nikah şəhadətnaməsi" },
  { key: "dogum_haqqinda", label: "Doğum haqqında şəhadətnamə" },
  { key: "olum_haqqinda", label: "Ölüm haqqında şəhadətnamə" },
  { key: "huquqi_sexs_senedleri", label: "Hüquqi şəxsin təsis sənədləri" },
  { key: "nizamname", label: "Nizamnamə" },
  { key: "vergi_senedi", label: "Vergi orqanından sənəd" },
  { key: "bank_senedi", label: "Bank sənədi / hesab çıxarışı" },
  { key: "emek_muqavilesi", label: "Əmək müqaviləsi" },
  { key: "emek_kitabcasi", label: "Əmək kitabçası" },
  { key: "torpaq_senedi", label: "Torpaq / Çıxarış (Daşınmaz Əmlak)" },
  { key: "foto_subut", label: "Foto / Video sübut materialı" },
  { key: "diger", label: "Digər sənəd" },
];

// ==================== HELPER FUNKSIYALAR ====================
export function getClaimLabel(key) {
  var found = CLAIM_TYPES.find(function(ct) { return ct.key === key; });
  return found ? found.label : key || "";
}

export function getDirectionLabel(key) {
  var found = CLAIM_DIRECTIONS.find(function(d) { return d.key === key; });
  return found ? found.label : key || "";
}

export function getDocLabel(key) {
  var found = DOCUMENT_TEMPLATES.find(function(d) { return d.key === key; });
  return found ? found.label : key || "";
}

export function getClaimTypesByDirection(directionKey) {
  return CLAIM_TYPES.filter(function(ct) { return ct.direction === directionKey; });
}