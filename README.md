# Professional Law

Hüquq büroları üçün idarəetmə sistemi: müştərilər, müqavilələr, tapşırıqlar, vəkillər, təsdiqlər, sənədlər, çat, bildirişlər, avtomatlaşdırma qaydaları. Rollar: menecer, vəkil, müştəri.

Bir quraşdırma çox büroya xidmət edir:
- **Büro** öz domenində açılır.
- **Baza:** hər büronun öz bazası var (`<DB_NAME>_t<id>`).
- **Fayllar:** hər büronun öz fayl qovluğu var (`/data/files/<id>`).
- **E-poçt:** hər büronun öz e-poçt (SMTP) ayarı ola bilər.
- **Giriş token-i** yalnız verildiyi büroda keçərlidir.

| Hissə | Texnologiya |
|---|---|
| `backend/` | Go (gin, gorm), PostgreSQL |
| `frontend/` | Next.js 14, Tailwind, Radix |

## Serverə qurmaq (avtomatik yeniləmə ilə)

Təzə Ubuntu serverində root kimi işə salın:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/oawocom/professional-law/main/deploy/install.sh)
```

Skript bunları edir:
- Docker-i qurur;
- repo-nu `/home/professional-law`-ə köçürür, nginx və HTTPS (Let's Encrypt) qurur;
- domeni, super adminin e-poçtunu və parolunu soruşur, `.env`-i yaradır;
- tətbiqi işə salır.

`main` budağına edilən hər push bir neçə dəqiqəyə serverə özü gəlir (`deploy/update.sh`, hər dəqiqə). Gedişatı `journalctl -u professional-law-update` göstərir.

## İşə salmaq

```bash
cp .env.example .env      # parolları, JWT_SECRET-i və (istəsəniz) ümumi SMTP-ni doldurun
docker compose up -d --build
```

Veb tətbiq `127.0.0.1:3000`-də açılır. Qarşısına HTTPS ilə nginx qoyun. Bütün domenlər (büroların domenləri və super admin ünvanı) eyni yerə yönəlir:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 30m;
}
```

## Büro yaratmaq

1. `https://<SUPER_HOST>/super` ünvanını açın. İlk super admin `.env`-dəki `SUPERADMIN_EMAIL` və `SUPERADMIN_PASSWORD`-dan yaranır.
2. "Yeni büro" düyməsini basın və bunları yazın:
   - büronun adı;
   - domenləri;
   - ilk menecerin adı, e-poçtu və parolu.

   Büronun bazası və ilkin məlumatları avtomatik yaranır: tapşırıq növləri, kitabxana və alt-rollar.
3. "Dəyiş" pəncərəsində büronun öz SMTP ayarını yazın. Boş qalsa `.env`-dəki ümumi SMTP işləyir.
4. Domenin DNS-ini serverə yönəldin. Menecer `https://<domen>/login` ünvanında daxil olur.

## Köhnə quraşdırmadan məlumat köçürmək

1. Paneldə büronu yaradın. Bazanın adı və büronun nömrəsi paneldə görünür, məsələn `lawoffice_t1` və `1`.
2. Yeni bazanı boşaldın və köhnə bazanın `law_*` cədvəllərini, həm də `files` cədvəlini köçürün:

   ```bash
   docker compose exec -T postgres psql -U law -d lawoffice_t1 -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
   pg_dump --no-owner --no-privileges -t 'law_*' -t files <köhnə baza> | docker compose exec -T postgres psql -U law -d lawoffice_t1
   ```

3. Köhnə faylları büronun qovluğuna köçürün:

   ```bash
   docker compose cp <köhnə uploads>/project_<köhnə id>/. backend:/data/files/1/
   docker compose exec -u root backend chown -R nobody:nobody /data/files/1
   ```

4. Backend-i yenidən başladın (`docker compose restart backend`).

İlk sorğuda server bunları edir:
- cədvəlləri yeniləyir;
- istifadəçiləri bu büroya bağlayır (`project_id` sütunu `tenant_id` olur);
- köhnə fayl siyahısını götürür;
- məlumatdakı köhnə fayl linklərini yeni ünvana çevirir.

İstifadəçilərin köhnə parolları işləməyə davam edir.

## Testlər

```bash
cd backend && go test ./...    # PostgreSQL lazımdır: TEST_DATABASE_URL
cd frontend && npm run typecheck
```
