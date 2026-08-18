# EczaPlus Yönetim Paneli Kurulumu

Bu sürümde site içeriği Decap CMS panelinden düzenlenebilir.

## Panel adresi
Site yayınlandıktan sonra: `https://SITENIZ.netlify.app/admin/`

## Netlify kurulumu
1. Bu klasörü GitHub'a bir repository olarak yükleyin.
2. Netlify'da **Add new project > Import an existing project** ile GitHub reposunu bağlayın.
3. Build command boş bırakılabilir. Publish directory: `.`
4. Netlify panelinde **Project configuration > Identity** bölümünden Netlify Identity'yi etkinleştirin.
5. Registration ayarını güvenlik için **Invite only** yapın.
6. **Identity > Services > Git Gateway** bölümünden Git Gateway'i etkinleştirin.
7. Identity bölümünden kendi e-posta adresinizi kullanıcı olarak davet edin.
8. Davet e-postasındaki bağlantıyı açıp şifre oluşturun.
9. `https://SITENIZ.netlify.app/admin/` adresine girin.

## Panelden düzenlenebilen alanlar
- Ana sayfa metinleri ve butonlar
- Hakkımızda
- Etkinlik kartları
- Duyurular
- İçerikler
- Ekip üyeleri ve fotoğrafları
- Dergi bilgileri, arşiv ve PDF dosyaları
- Instagram ve e-posta
- Başvuru bölümünün açıklaması

Panelde **Publish** dediğinizde değişiklik GitHub reposuna kaydedilir ve Netlify siteyi otomatik günceller.
