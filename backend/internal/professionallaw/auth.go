package professionallaw

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"encoding/json"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"professionallaw/internal/security"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// The signing key of the law_token logins (/sf/*). It is derived from JWT_SECRET,
// so changing JWT_SECRET changes it as well; it is used only in this package.
func jwtSecret() []byte { return security.Key("professional-law-token") }

type LoginRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token string   `json:"token"`
	User  UserInfo `json:"user"`
}

type UserInfo struct {
	ID                   int        `json:"id"`
	Email                string     `json:"email"`
	Name                 string     `json:"name"`
	Phone                string     `json:"phone,omitempty"`
	Role                 string     `json:"role"`
	LawyerID             *int       `json:"lawyer_id,omitempty"`
	ClientID             *int       `json:"client_id,omitempty"`
	RestrictedContractID *uint      `json:"restricted_contract_id,omitempty"`
	EmailVerified        bool       `json:"email_verified"`
	LastLogin            *time.Time `json:"last_login,omitempty"`
	Avatar               string     `json:"avatar,omitempty"`
	Address              string     `json:"address,omitempty"`
	Bio                  string     `json:"bio,omitempty"`
	CompanyName          string     `json:"company_name,omitempty"`
}

type Claims struct {
	UserID   int    `json:"user_id"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	LawyerID *int   `json:"lawyer_id,omitempty"`
	ClientID *int   `json:"client_id,omitempty"`
	// TenantID - the office the token was issued in; it opens no other office.
	TenantID uint `json:"tid"`
	jwt.RegisteredClaims
}

type User struct {
	ID                   int        `gorm:"primaryKey" json:"id"`
	Email                string     `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash         string     `gorm:"column:password_hash;not null" json:"-"`
	Role                 string     `gorm:"not null" json:"role"`
	SubRoleID            *uint      `json:"sub_role_id"`
	// RestrictedContractID - əgər dolu isə, bu istifadəçi YALNIZ bu bir
	// müqavilə (və onun tapşırıqları) üzərində görə/işləyə bilər. Menecer
	// rol təyin edərkən istifadəçini konkret müqaviləyə bağlaya bilər.
	RestrictedContractID *uint `json:"restricted_contract_id" gorm:"index"`
	// PermissionOverrides - bu KONKRET istifadəçi üçün alt-rolun imtiyaz
	// matrisini "ötüb keçən" fərdi icazələr (məs: {"delete_clients": false}).
	// Burada olan açar həmişə üstünlük təşkil edir; olmayan açarlar üçün
	// istifadəçinin alt-rolunun (SubRole.Permissions) dəyəri istifadə olunur.
	PermissionOverrides  datatypes.JSON `json:"permission_overrides" gorm:"type:jsonb"`
	DisplayName          string     `gorm:"size:255" json:"display_name"`
	LawyerID             *int       `json:"lawyer_id,omitempty"`
	ClientID             *int       `json:"client_id,omitempty"`
	Name                 string     `gorm:"not null" json:"name"`
	IsActive             bool       `gorm:"default:true" json:"is_active"`
	LastLogin            *time.Time `json:"last_login,omitempty"`
	TenantID             int        `gorm:"not null" json:"tenant_id"`
	SetupToken           string     `gorm:"size:128;index" json:"-"`
	SetupTokenExpiry     *time.Time `json:"-"`
	// EmailVerified - yeni yaradılan vəkil/müştəri hesabları e-poçta göndərilən
	// kodla təsdiqlənənə qədər false qalır. Mövcud (əvvəldən olan) hesablar və
	// menecerlər üçün defolt true-dur ki, geriyə uyğunluq pozulmasın.
	EmailVerified           bool       `gorm:"default:true" json:"email_verified"`
	VerificationCode        string     `gorm:"size:16" json:"-"`
	VerificationCodeExpiry  *time.Time `json:"-"`
	// OtpCode/OtpCodeExpiry/OtpPurpose - Profil Tənzimləmələrindən şifrə/giriş
	// kodu dəyişikliyini təsdiqləmək üçün ayrıca (email-təsdiqindən müstəqil)
	// birdəfəlik kod mexanizmi. VerificationCode-dan fərqli saxlanılır ki,
	// bir OTP tələbi email_verified vəziyyətinə toxunmasın.
	OtpCode       string     `gorm:"size:16" json:"-"`
	OtpCodeExpiry *time.Time `json:"-"`
	OtpPurpose    string     `gorm:"size:32" json:"-"`
	// Phone - Profil Tənzimləmələrindən istifadəçinin özü redaktə edə bildiyi
	// əlaqə telefonu (login hesabına aiddir, Vəkil/Müştəri biznes profilindən ayrıdır).
	Phone                string     `gorm:"size:50" json:"phone"`
	// Profil Tənzimləmələri — özünə-xidmət sahələri (əvvəllər yalnız
	// brauzerin localStorage-də saxlanılırdı və heç vaxt serverə düşmürdü,
	// ona görə "hardcode" kimi hiss olunurdu və cihazlar arasında sinxron deyildi).
	Avatar               string     `gorm:"type:text" json:"avatar"`
	Address              string     `gorm:"type:text" json:"address"`
	Bio                  string     `gorm:"type:text" json:"bio"`
	CompanyName          string     `gorm:"size:255" json:"company_name"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

func (User) TableName() string {
	return "law_users"
}

// GenerateSetupToken creates a random hex token for password setup
func GenerateSetupToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// JWTAuthMiddleware validates the law_token JWT of the panel (/sf/*)
func JWTAuthMiddleware(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.JSON(401, gin.H{"detail": "Authorization token required"})
			c.Abort()
			return
		}

		tokenString := authHeader[7:]

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret(), nil
		})

		if err != nil || !token.Valid {
			c.JSON(401, gin.H{"detail": "Invalid or expired token"})
			c.Abort()
			return
		}

		// A token opens only the office it was issued in.
		if reqTenantIDVal, ok := c.Get("tenantID"); ok {
			if reqTenantID, ok2 := reqTenantIDVal.(uint); ok2 {
				if claims.TenantID != reqTenantID {
					c.JSON(401, gin.H{"detail": "Token bu büro üçün etibarlı deyil"})
					c.Abort()
					return
				}
			}
		}

		if len(allowedRoles) > 0 {
			roleAllowed := false
			for _, r := range allowedRoles {
				if claims.Role == r {
					roleAllowed = true
					break
				}
			}
			if !roleAllowed {
				c.JSON(403, gin.H{"detail": "Insufficient permissions"})
				c.Abort()
				return
			}
		}

		c.Set("userID", claims.UserID)
		c.Set("userEmail", claims.Email)
		c.Set("userRole", claims.Role)
		if claims.LawyerID != nil {
			c.Set("lawyerID", *claims.LawyerID)
		}
		if claims.ClientID != nil {
			c.Set("clientID", *claims.ClientID)
		}

		c.Next()
	}
}

// ==================== CONTRACT-BASED ACCESS RESTRICTION ====================
//
// Menecer "Rolların idarəedilməsi" bölməsindən bir istifadəçini konkret bir
// müqaviləyə bağlaya bilər (User.RestrictedContractID). Bağlanmış istifadəçi
// YALNIZ o müqaviləni və onun tapşırıqlarını görə/üzərində işləyə bilər.
// Bu funksiyalar həmin qaydanı handler-lərdə tətbiq etmək üçündür.

// getRestrictedContractID cari (JWT ilə giriş etmiş) istifadəçinin bağlı
// olduğu müqavilə ID-sini DB-dən oxuyur. Məhdudiyyət yoxdursa nil qaytarır.
func getRestrictedContractID(db *gorm.DB, c *gin.Context) *uint {
	userIDVal, exists := c.Get("userID")
	if !exists {
		return nil
	}
	var user User
	if err := db.Select("restricted_contract_id").First(&user, userIDVal).Error; err != nil {
		return nil
	}
	return user.RestrictedContractID
}

// contractAccessAllowed - restrictedID nil-dirsə (məhdudiyyət yoxdur) və ya
// contractID restrictedID ilə üst-üstə düşürsə true qaytarır.
func contractAccessAllowed(restrictedID *uint, contractID *uint) bool {
	if restrictedID == nil {
		return true
	}
	if contractID == nil {
		return false
	}
	return *restrictedID == *contractID
}

// denyContractAccess standart 403 cavabını göndərir
func denyContractAccess(c *gin.Context) {
	c.JSON(403, gin.H{"error": "Bu müqaviləyə giriş icazəniz yoxdur. Siz yalnız təyin edilmiş müqavilə üzərində işləyə bilərsiniz."})
}

// ==================== SAHİBLİK ƏSASLI MƏHDUDİYYƏT (ownership scoping) ====================
//
// requirePermission()/EffectivePerms yalnız "bu əməliyyata icazən var/yoxdur" sualına
// cavab verir — HANSI konkret sətirlərə (hansı müştəri/vəkilin öz məlumatı) çıxışın
// olduğuna baxmır. Defolt-icazəli (Restricted=false) hesablar üçün bu o deməkdir ki,
// icazə yoxlaması özlüyündə HEÇ NƏYİ məhdudlaşdırmır. Bu funksiyalar həmin boşluğu
// bağlayır: "client" rolu yalnız öz (və ona bağlı Fərdi hesabların) məlumatını,
// "lawyer" rolu yalnız özünə təhkim olunan tapşırıqlara aid müştəri/müqavilələri
// görə bilər — sub-rol/override-dən ASILI OLMAYARAQ.

func containsUint(list []uint, id uint) bool {
	for _, v := range list {
		if v == id {
			return true
		}
	}
	return false
}

// scopedClientIDs - "client" rolunda giriş etmiş istifadəçinin görə biləcəyi bütün
// Client ID-lərini qaytarır: öz ID-si + (Hüquqi şəxsdirsə) ona bağlı Fərdi hesabların ID-ləri.
func scopedClientIDs(db *gorm.DB, c *gin.Context) ([]uint, bool) {
	clientIDVal, exists := c.Get("clientID")
	if !exists {
		return nil, false
	}
	clientID, ok := clientIDVal.(int)
	if !ok || clientID <= 0 {
		return nil, false
	}
	ids := []uint{uint(clientID)}
	var childIDs []uint
	db.Model(&Client{}).Where("parent_client_id = ?", clientID).Pluck("id", &childIDs)
	ids = append(ids, childIDs...)
	return ids, true
}

// lawyerContractIDs - bu vəkilə təhkim olunmuş tapşırıqların aid olduğu unikal müqavilə ID-ləri.
func lawyerContractIDs(db *gorm.DB, lawyerID int) []uint {
	var ids []uint
	db.Model(&Task{}).Where("assigned_to = ? AND contract_id IS NOT NULL", lawyerID).Distinct("contract_id").Pluck("contract_id", &ids)
	return ids
}

// lawyerClientIDs - bu vəkilə təhkim olunmuş tapşırıqların aid olduğu unikal müştəri ID-ləri.
func lawyerClientIDs(db *gorm.DB, lawyerID int) []uint {
	var ids []uint
	db.Model(&Task{}).Where("assigned_to = ? AND client_id IS NOT NULL", lawyerID).Distinct("client_id").Pluck("client_id", &ids)
	return ids
}

// lawyerTaskIDs - bu vəkilə təhkim olunmuş bütün tapşırıq ID-ləri.
func lawyerTaskIDs(db *gorm.DB, lawyerID int) []uint {
	var ids []uint
	db.Model(&Task{}).Where("assigned_to = ?", lawyerID).Pluck("id", &ids)
	return ids
}

// currentUserRole - JWT-dəki rolu qaytarır ("manager"/"lawyer"/"client"/"").
func currentUserRole(c *gin.Context) string {
	roleVal, _ := c.Get("userRole")
	role, _ := roleVal.(string)
	return role
}

// ==================== İMTİYAZ (PERMISSION) MATRİSİ — FAKTİKİ TƏTBİQ ====================
//
// Menecer "Rolların idarəedilməsi" bölməsində alt-rollara (SubRole) imtiyaz
// matrisi təyin edir. Bu matris özlüyündə sadəcə məlumat idi (heç bir
// endpoint yoxlamırdı) — indi handler-lər EffectivePerms vasitəsilə real
// yoxlama edir.
//
// Qayda:
//   - İstifadəçinin SubRoleID-si YOXDUR və fərdi PermissionOverrides-i də
//     boşdur → məhdudiyyət yoxdur (leqasi davranış qorunur, heç kim
//     gözlənilmədən kilidlənmir).
//   - SubRoleID təyin edilibsə (və ya fərdi override varsa) → istifadəçi
//     "məhdudlaşdırılmış" sayılır: hər açar üçün əvvəlcə fərdi override-ə,
//     sonra SubRole.Permissions-a baxılır, heç birində yoxdursa YOX qəbul
//     edilir (təhlükəsiz defolt).

type EffectivePerms struct {
	Restricted bool
	perms      map[string]bool
	role       string
}

// Allowed - konkret imtiyaz açarına görə icazə var/yoxdur
//
// TƏHLÜKƏSİZLİK QEYDİ (2026-09): "Restricted=false" halı (istifadəçiyə heç bir
// SubRole/fərdi icazə təyin edilməyib) əvvəllər HƏR açar üçün icazəni avtomatik
// verirdi ("fail-open" defolt) — bu, funksional icazələr üçün məqsədli idi ki,
// SubRole sistemi hələ konfiqurasiya olunmayan hesablar birdən-birə kilidlənməsin.
// AMMA bunun nəticəsində, SubRole təyin edilməyən HƏR vəkil/müştəri hesabı
// maliyyə sahələrini (müqavilə/tapşırıq üzrə müştəridən alınan məbləğ və s.)
// DEFOLT OLARAQ görürdü — halbuki sistemdə artıq "view_amounts" adlı ayrıca
// icazə var məhz bunun üçün (bax: SeedDefaults-dakı "Vəkil - Köməkçi",
// "Müştəri - Koordinator" kimi rollarda view_amounts=false təyin edilib).
// Yəni icazə MODELİ düzgün idi, sadəcə defolt (konfiqurasiya edilməmiş hesab)
// vəziyyətində bu yoxlama heç işə düşmürdü. Bunu düzəltmək üçün: "Restricted=false"
// halında belə, "view_amounts" açarı üçün vəkil/müştəri rolları üzrə TƏHLÜKƏSİZ
// (gizli) defolt tətbiq olunur — manager rolu isə (əvvəlki kimi) tam çıxışını
// saxlayır. Bu, mövcud icazə məntiqini DƏYİŞMİR, sadəcə onun niyyət edilən
// təsirini bütün hesablarda (SubRole təyin edilməsindən asılı olmayaraq) real
// işlək hala gətirir. Manager istəsə, konkret vəkilə "Baş vəkil" SubRole-u (və
// ya fərdi override: view_amounts=true) təyin edərək bu vəkilin məbləğləri
// görməsinə icazə verə bilər.
func (ep *EffectivePerms) Allowed(key string) bool {
	if ep == nil {
		return true
	}
	if !ep.Restricted {
		if key == "view_amounts" && (ep.role == "lawyer" || ep.role == "client") {
			return false
		}
		return true
	}
	return ep.perms[key]
}

func parsePermMap(raw datatypes.JSON) map[string]bool {
	out := map[string]bool{}
	if len(raw) == 0 {
		return out
	}
	var generic map[string]interface{}
	if err := json.Unmarshal(raw, &generic); err != nil {
		return out
	}
	for k, v := range generic {
		if b, ok := v.(bool); ok {
			out[k] = b
		}
	}
	return out
}

// loadEffectivePerms cari istifadəçinin faktiki (sub-rol + fərdi override
// birləşməsi) imtiyazlarını DB-dən yükləyir.
func loadEffectivePerms(db *gorm.DB, c *gin.Context) *EffectivePerms {
	userRole := currentUserRole(c)
	userIDVal, exists := c.Get("userID")
	if !exists {
		return &EffectivePerms{Restricted: false, role: userRole}
	}
	var user User
	if err := db.Select("sub_role_id, permission_overrides").First(&user, userIDVal).Error; err != nil {
		return &EffectivePerms{Restricted: false, role: userRole}
	}

	overrides := parsePermMap(user.PermissionOverrides)

	if user.SubRoleID == nil && len(overrides) == 0 {
		return &EffectivePerms{Restricted: false, role: userRole}
	}

	base := map[string]bool{}
	if user.SubRoleID != nil {
		var role SubRole
		if err := db.Select("permissions").First(&role, *user.SubRoleID).Error; err == nil {
			base = parsePermMap(role.Permissions)
		}
	}
	for k, v := range overrides {
		base[k] = v
	}
	return &EffectivePerms{Restricted: true, perms: base, role: userRole}
}

// requirePermission - icazə yoxdursa aydın Azərbaycan dilində 403 mesajı
// qaytarır və false qaytarır (çağıran handler dərhal return etməlidir).
func requirePermission(c *gin.Context, db *gorm.DB, key string, label string) bool {
	ep := loadEffectivePerms(db, c)
	if ep.Allowed(key) {
		return true
	}
	c.JSON(403, gin.H{
		"error":           fmt.Sprintf("Bu əməliyyat (%s) üçün icazəniz yoxdur. İstəyirsinizsə, admin/menecerdən bu icazəni açmasını xahiş edin.", label),
		"permission_key":  key,
		"permission_denied": true,
	})
	return false
}

// maskContractAmounts - view_amounts icazəsi olmayan istifadəçilər üçün
// müqavilənin maliyyə sahələrini gizlədir (0 kimi qaytarır).
func maskContractAmounts(ct *Contract) {
	ct.Value = 0
	ct.ClaimAmount = 0
	ct.StaticLawyerFee = 0
}

// maskTaskAmounts - view_amounts icazəsi olmayan istifadəçilər üçün
// tapşırığın iddia məbləğlərini gizlədir.
func maskTaskAmounts(t *Task) {
	t.TotalClaim = 0
	t.ClaimAmounts = datatypes.JSON([]byte("[]"))
}

// permsJSON - map[string]bool-u SubRole.Permissions sütunu üçün datatypes.JSON-a çevirir.
func permsJSON(m map[string]bool) datatypes.JSON {
	b, err := json.Marshal(m)
	if err != nil {
		return datatypes.JSON([]byte("{}"))
	}
	return datatypes.JSON(b)
}

// Login handler
func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Email and password required"})
		return
	}

	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}

	// Email-i normalize et (yaradılışdakı ilə eyni: kiçik hərf + trim)
	loginEmail := strings.ToLower(strings.TrimSpace(req.Email))

	// TƏHLÜKƏSİZLİK: "e-poçt tapılmadı" və "parol səhvdir" halları üçün eyni
	// ümumi mesaj qaytarılır (e-poçt yoxlamasının və brute-force-un qarşısını alır).
	var user User
	if err := db.Where("email = ? AND is_active = ?", loginEmail, true).First(&user).Error; err != nil {
		c.JSON(401, gin.H{"error": "Email və ya şifrə yanlışdır"})
		return
	}

	if !security.CheckPassword(req.Password, user.PasswordHash) {
		c.JSON(401, gin.H{"error": "Email və ya şifrə yanlışdır"})
		return
	}

	prevLastLogin := user.LastLogin
	now := time.Now()
	db.Model(&user).Update("last_login", now)

	// Token verildiyi büronu da daşıyır (TenantID) — başqa büroda keçərli deyil.
	tenantIDVal, _ := c.Get("tenantID")
	tokenTenantID, _ := tenantIDVal.(uint)

	claims := Claims{
		UserID:    user.ID,
		Email:     user.Email,
		Role:      user.Role,
		LawyerID:  user.LawyerID,
		ClientID:  user.ClientID,
		TenantID: tokenTenantID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(jwtSecret())
	if err != nil {
		c.JSON(500, gin.H{"error": "Error generating token"})
		return
	}

	c.JSON(200, LoginResponse{
		Token: tokenString,
		User: UserInfo{
			ID:                   user.ID,
			Email:                user.Email,
			Name:                 user.Name,
			Phone:                user.Phone,
			Role:                 user.Role,
			LawyerID:             user.LawyerID,
			ClientID:             user.ClientID,
			RestrictedContractID: user.RestrictedContractID,
			EmailVerified:        user.EmailVerified,
			LastLogin:            prevLastLogin,
			Avatar:               user.Avatar,
			Address:              user.Address,
			Bio:                  user.Bio,
			CompanyName:          user.CompanyName,
		},
	})
}

// GetMe handler
func (h *Handler) GetMe(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" || len(authHeader) < 8 {
		c.JSON(401, gin.H{"error": "Unauthorized"})
		return
	}

	tokenString := authHeader[7:]

	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret(), nil
	})

	if err != nil || !token.Valid {
		c.JSON(401, gin.H{"error": "Invalid token"})
		return
	}

	// GetMe token-i özü yoxlayır: JWTAuthMiddleware-dəki kimi, token yalnız
	// verildiyi büroda keçərlidir.
	if reqTenantIDVal, ok := c.Get("tenantID"); ok {
		if reqTenantID, ok2 := reqTenantIDVal.(uint); ok2 {
			if claims.TenantID != reqTenantID {
				c.JSON(401, gin.H{"error": "Token bu büro üçün etibarlı deyil"})
				return
			}
		}
	}

	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}

	var user User
	if err := db.Where("id = ? AND is_active = ?", claims.UserID, true).First(&user).Error; err != nil {
		c.JSON(401, gin.H{"error": "User not found"})
		return
	}

	c.JSON(200, UserInfo{
		ID:                   user.ID,
		Email:                user.Email,
		Name:                 user.Name,
		Phone:                user.Phone,
		Role:                 user.Role,
		LawyerID:             user.LawyerID,
		ClientID:             user.ClientID,
		RestrictedContractID: user.RestrictedContractID,
		EmailVerified:        user.EmailVerified,
		LastLogin:            user.LastLogin,
		Avatar:               user.Avatar,
		Address:              user.Address,
		Bio:                  user.Bio,
		CompanyName:          user.CompanyName,
	})
}

func (h *Handler) Logout(c *gin.Context) {
	c.JSON(200, gin.H{"success": true})
}

// ==================== ÖZ PROFİLİMİ İDARƏ ET (self-service) ====================
//
// Profil Tənzimləmələri pəncərəsindən (3 rol üçün ortaq) istifadəçinin öz
// adını/telefonunu yeniləməsi və hesabını (özü) deaktiv etməsi üçün.

// UpdateMyProfile - PUT /sf/auth/me {name, phone}
func (h *Handler) UpdateMyProfile(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(401, gin.H{"error": "İstifadəçi autentifikasiya olunmayıb"})
		return
	}

	var req struct {
		Name        string  `json:"name" binding:"required"`
		Phone       string  `json:"phone"`
		Avatar      *string `json:"avatar"`
		Address     *string `json:"address"`
		Bio         *string `json:"bio"`
		CompanyName *string `json:"company_name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Ad Soyad tələb olunur"})
		return
	}

	var user User
	if err := db.First(&user, userID).Error; err != nil {
		c.JSON(404, gin.H{"error": "İstifadəçi tapılmadı"})
		return
	}

	updates := map[string]interface{}{
		"name":  strings.TrimSpace(req.Name),
		"phone": strings.TrimSpace(req.Phone),
	}
	// Pointer sahələr — yalnız frontend-dən göndərilibsə yenilənir, əks halda
	// mövcud qiymət toxunulmaz qalır (məs. yalnız adı dəyişəndə avatar silinməsin).
	if req.Avatar != nil {
		updates["avatar"] = *req.Avatar
	}
	if req.Address != nil {
		updates["address"] = *req.Address
	}
	if req.Bio != nil {
		updates["bio"] = *req.Bio
	}
	if req.CompanyName != nil {
		updates["company_name"] = *req.CompanyName
	}

	db.Model(&user).Updates(updates)
	db.First(&user, userID)

	c.JSON(200, UserInfo{
		ID:                   user.ID,
		Email:                user.Email,
		Name:                 user.Name,
		Phone:                user.Phone,
		Role:                 user.Role,
		LawyerID:             user.LawyerID,
		ClientID:             user.ClientID,
		RestrictedContractID: user.RestrictedContractID,
		EmailVerified:        user.EmailVerified,
		LastLogin:            user.LastLogin,
		Avatar:               user.Avatar,
		Address:              user.Address,
		Bio:                  user.Bio,
		CompanyName:          user.CompanyName,
	})
}

// DeleteMyAccount - DELETE /sf/auth/me {password} — istifadəçi öz hesabını
// özü (deaktiv edərək) silir. Şifrə/kod təsdiqi tələb olunur. Əgər bu, bürodakı
// SON aktiv menecerdirsə, sistemin kilidlənməməsi üçün əməliyyat rədd edilir.
func (h *Handler) DeleteMyAccount(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(401, gin.H{"error": "İstifadəçi autentifikasiya olunmayıb"})
		return
	}

	var req struct {
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Təsdiq üçün cari şifrə/kod tələb olunur"})
		return
	}

	var user User
	if err := db.First(&user, userID).Error; err != nil {
		c.JSON(404, gin.H{"error": "İstifadəçi tapılmadı"})
		return
	}

	if !security.CheckPassword(req.Password, user.PasswordHash) {
		c.JSON(401, gin.H{"error": "Şifrə/kod yanlışdır"})
		return
	}

	if user.Role == "manager" {
		var activeManagers int64
		db.Model(&User{}).Where("role = ? AND is_active = ? AND id <> ?", "manager", true, user.ID).Count(&activeManagers)
		if activeManagers == 0 {
			c.JSON(400, gin.H{"error": "Sistemdəki son aktiv menecer hesabını silə bilməzsiniz. Əvvəlcə başqa menecer təyin edin."})
			return
		}
	}

	db.Model(&user).Update("is_active", false)
	c.JSON(200, gin.H{"success": true, "message": "Hesabınız deaktiv edildi"})
}

// GetMyPermissions - cari istifadəçinin faktiki (sub-rol + fərdi override)
// imtiyazlarını qaytarır. Frontend bunu login-dən sonra çağırıb UI-də
// düymələri/menyu elementlərini real icazəyə görə göstərir/gizlədir və
// hər hansı bloklanmış əməliyyatda istifadəçiyə xəbərdarlıq göstərir.
func (h *Handler) GetMyPermissions(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}
	ep := loadEffectivePerms(db, c)
	restrictedContractID := getRestrictedContractID(db, c)

	perms := ep.perms
	if perms == nil {
		perms = map[string]bool{}
	}

	c.JSON(200, gin.H{
		"restricted":              ep.Restricted,
		"permissions":             perms,
		"restricted_contract_id":  restrictedContractID,
	})
}

// SetupPassword - public endpoint for clients to set their password via setup token
func (h *Handler) SetupPassword(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}

	var req struct {
		Token    string `json:"token" binding:"required"`
		Password string `json:"password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Token and password (min 6 chars) required"})
		return
	}

	// Find user by setup token
	var user User
	if err := db.Where("setup_token = ? AND is_active = ?", req.Token, true).First(&user).Error; err != nil {
		c.JSON(400, gin.H{"error": "Invalid or expired setup link"})
		return
	}

	// Check token expiry
	if user.SetupTokenExpiry != nil && user.SetupTokenExpiry.Before(time.Now()) {
		c.JSON(400, gin.H{"error": "Setup link has expired. Please contact your manager."})
		return
	}

	// Hash new password
	newHash, err := security.HashPassword(req.Password)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to set password"})
		return
	}

	// Update password and clear setup token
	db.Model(&user).Updates(map[string]interface{}{
		"password_hash":      newHash,
		"setup_token":        "",
		"setup_token_expiry": nil,
	})

	c.JSON(200, gin.H{
		"success": true,
		"message": "Password set successfully. You can now login.",
		"email":   user.Email,
	})
}

// VerifySetupToken - GET endpoint to check if a setup token is valid
func (h *Handler) VerifySetupToken(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}

	token := c.Query("token")
	if token == "" {
		c.JSON(400, gin.H{"error": "Token required", "valid": false})
		return
	}

	var user User
	if err := db.Where("setup_token = ? AND is_active = ?", token, true).First(&user).Error; err != nil {
		c.JSON(400, gin.H{"error": "Invalid setup link", "valid": false})
		return
	}

	if user.SetupTokenExpiry != nil && user.SetupTokenExpiry.Before(time.Now()) {
		c.JSON(400, gin.H{"error": "Setup link has expired", "valid": false})
		return
	}

	c.JSON(200, gin.H{
		"valid": true,
		"name":  user.Name,
		"email": user.Email,
	})
}

// ChangePassword
func (h *Handler) ChangePassword(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}

	var req struct {
		CurrentPassword string `json:"current_password" binding:"required"`
		NewPassword     string `json:"new_password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Current and new password required"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		userIDStr := c.GetHeader("X-User-ID")
		if userIDStr == "" {
			c.JSON(401, gin.H{"error": "User not authenticated"})
			return
		}
		var user User
		if err := db.First(&user, userIDStr).Error; err != nil {
			c.JSON(404, gin.H{"error": "User not found"})
			return
		}
		userID = user.ID
	}

	var user User
	if err := db.First(&user, userID).Error; err != nil {
		c.JSON(404, gin.H{"error": "User not found"})
		return
	}

	if !security.CheckPassword(req.CurrentPassword, user.PasswordHash) {
		c.JSON(401, gin.H{"error": "Current password is incorrect"})
		return
	}

	newHash, err := security.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to hash password"})
		return
	}

	if err := db.Model(&user).Update("password_hash", newHash).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to update password"})
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Password changed successfully"})
}

// ListUsers
func (h *Handler) ListUsers(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}
	if !requirePermission(c, db, "manage_roles", "İstifadəçiləri görmək") {
		return
	}

	role := c.Query("role")
	query := db.Model(&User{})
	if role != "" {
		query = query.Where("role = ?", role)
	}

	var users []User
	query.Order("created_at DESC").Find(&users)
	c.JSON(200, users)
}

// UpdateUser - update sub_role_id, display_name, etc.
func (h *Handler) UpdateUser(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}
	if !requirePermission(c, db, "manage_roles", "İstifadəçi rolunu/icazələrini dəyişmək") {
		return
	}
	id := c.Param("id")
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	// Only allow safe fields
	allowed := map[string]bool{"sub_role_id": true, "display_name": true, "name": true, "is_active": true, "restricted_contract_id": true, "permission_overrides": true}
	safe := map[string]interface{}{}
	for k, v := range updates {
		if allowed[k] {
			safe[k] = v
		}
	}
	// restricted_contract_id "boş"/0 gəlirsə, məhdudiyyəti tam sil (NULL et)
	if v, ok := safe["restricted_contract_id"]; ok {
		if v == nil {
			safe["restricted_contract_id"] = nil
		} else if f, isNum := v.(float64); isNum && f == 0 {
			safe["restricted_contract_id"] = nil
		}
	}
	// permission_overrides bir JS obyekt kimi gəlir (məs. {"edit_clients": false}),
	// jsonb sütununa yazmaq üçün datatypes.JSON-a çeviririk. Boş obyekt/nil = sıfırla.
	if v, ok := safe["permission_overrides"]; ok {
		if v == nil {
			safe["permission_overrides"] = datatypes.JSON([]byte("{}"))
		} else if b, err := json.Marshal(v); err == nil {
			safe["permission_overrides"] = datatypes.JSON(b)
		} else {
			delete(safe, "permission_overrides")
		}
	}
	if len(safe) == 0 {
		c.JSON(400, gin.H{"error": "No valid fields to update"})
		return
	}
	db.Model(&User{}).Where("id = ?", id).Updates(safe)
	// restricted_contract_id null olanda GORM Updates() map-də nil-i skip edə bilər,
	// ona görə ayrıca sıfırlama təmin edirik
	if v, ok := safe["restricted_contract_id"]; ok && v == nil {
		db.Exec("UPDATE law_users SET restricted_contract_id = NULL WHERE id = ?", id)
	}
	var user User
	db.First(&user, id)
	c.JSON(200, user)
}

// ResetUserPassword
func (h *Handler) ResetUserPassword(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}
	if !requirePermission(c, db, "manage_users", "İstifadəçi şifrəsini sıfırlamaq") {
		return
	}

	id := c.Param("id")
	var user User
	if err := db.First(&user, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "User not found"})
		return
	}

	var req struct {
		Password string `json:"password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Password required (min 6 chars)"})
		return
	}

	newHash, err := security.HashPassword(req.Password)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to hash password"})
		return
	}

	db.Model(&user).Update("password_hash", newHash)
	c.JSON(200, gin.H{"success": true, "message": "Password reset successfully"})
}

// DeleteUser
func (h *Handler) DeleteUser(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}
	if !requirePermission(c, db, "manage_users", "İstifadəçini silmək") {
		return
	}

	id := c.Param("id")
	if err := db.Delete(&User{}, id).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to delete user"})
		return
	}
	c.JSON(200, gin.H{"success": true})
}

// ==================== E-POÇT TƏSDİQİ (VERIFICATION CODE) ====================
//
// Yeni yaradılan vəkil/müştəri hesabları e-poçta göndərilən 6 rəqəmli kodla
// təsdiqlənənə qədər "email_verified: false" qalır. Frontend bunu login
// cavabından oxuyub istifadəçini idarə panelinə buraxmadan öncə kod daxiletmə
// ekranı göstərir. Kod bu iki endpoint vasitəsilə yoxlanılır/yenidən göndərilir.

// generateVerificationCode - 6 rəqəmli təsadüfi kod yaradır (məs: "042817").
func generateVerificationCode() string {
	b := make([]byte, 4)
	rand.Read(b)
	n := (uint32(b[0])<<24 | uint32(b[1])<<16 | uint32(b[2])<<8 | uint32(b[3])) % 1000000
	return fmt.Sprintf("%06d", n)
}

// issueVerificationCode - user üçün yeni kod yaradır, DB-yə yazır və e-poçtla göndərir.
// Bu funksiya CreateLawyer/CreateClient-dən (yeni hesab yaradılanda) və
// ResendVerificationCode-dan çağırılır.
func issueVerificationCode(db *gorm.DB, user *User) error {
	code := generateVerificationCode()
	expiry := time.Now().Add(15 * time.Minute)
	if err := db.Model(user).Updates(map[string]interface{}{
		"verification_code":        code,
		"verification_code_expiry": &expiry,
		"email_verified":           false,
	}).Error; err != nil {
		return err
	}
	return SendVerificationEmail(uint(user.TenantID), user.Email, user.Name, code)
}

// VerifyEmailCode - POST /sf/auth/verify-email {code} — JWT-dəki istifadəçi üçün
// e-poçta göndərilən kodu yoxlayır. Uğurlu olarsa email_verified=true edir.
func (h *Handler) VerifyEmailCode(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}

	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Təsdiq kodu tələb olunur"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(401, gin.H{"error": "İstifadəçi autentifikasiya olunmayıb"})
		return
	}

	var user User
	if err := db.First(&user, userID).Error; err != nil {
		c.JSON(404, gin.H{"error": "İstifadəçi tapılmadı"})
		return
	}

	if user.EmailVerified {
		c.JSON(200, gin.H{"success": true, "already_verified": true})
		return
	}

	if user.VerificationCode == "" || strings.TrimSpace(req.Code) != user.VerificationCode {
		c.JSON(400, gin.H{"error": "Kod yanlışdır. Zəhmət olmasa yenidən yoxlayın."})
		return
	}

	if user.VerificationCodeExpiry == nil || user.VerificationCodeExpiry.Before(time.Now()) {
		c.JSON(400, gin.H{"error": "Kodun vaxtı bitib. Yeni kod tələb edin."})
		return
	}

	db.Model(&user).Updates(map[string]interface{}{
		"email_verified":            true,
		"verification_code":         "",
		"verification_code_expiry":  nil,
	})

	c.JSON(200, gin.H{"success": true})
}

// ResendVerificationCode - POST /sf/auth/resend-code — JWT-dəki istifadəçi üçün
// yeni təsdiq kodu yaradır və e-poçtla göndərir.
func (h *Handler) ResendVerificationCode(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(401, gin.H{"error": "İstifadəçi autentifikasiya olunmayıb"})
		return
	}

	var user User
	if err := db.First(&user, userID).Error; err != nil {
		c.JSON(404, gin.H{"error": "İstifadəçi tapılmadı"})
		return
	}

	if user.EmailVerified {
		c.JSON(200, gin.H{"success": true, "already_verified": true})
		return
	}

	if err := issueVerificationCode(db, &user); err != nil {
		c.JSON(500, gin.H{"error": "Kod göndərilə bilmədi: " + err.Error()})
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Yeni kod e-poçtunuza göndərildi."})
}

// ==================== OTP-QORUNAN ŞİFRƏ/GİRİŞ KODU DƏYİŞİKLİYİ ====================
//
// Profil Tənzimləmələrindən (bütün 3 rol: manager/vəkil/müştəri) şifrə/giriş
// kodu dəyişikliyi 2 addımlı OTP axını ilə həyata keçirilir:
//   1) RequestPasswordChangeOTP — cari şifrəni yoxlayır, e-poçta 6 rəqəmli kod göndərir.
//   2) ConfirmPasswordChangeOTP — kodu yoxlayır və yeni şifrəni tətbiq edir.

// RequestPasswordChangeOTP - POST /sf/auth/password-otp/request {current_password}
func (h *Handler) RequestPasswordChangeOTP(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(401, gin.H{"error": "İstifadəçi autentifikasiya olunmayıb"})
		return
	}

	var req struct {
		CurrentPassword string `json:"current_password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Cari şifrə/kod tələb olunur"})
		return
	}

	var user User
	if err := db.First(&user, userID).Error; err != nil {
		c.JSON(404, gin.H{"error": "İstifadəçi tapılmadı"})
		return
	}

	if !security.CheckPassword(req.CurrentPassword, user.PasswordHash) {
		c.JSON(401, gin.H{"error": "Cari şifrə/kod yanlışdır"})
		return
	}

	if user.Email == "" {
		c.JSON(400, gin.H{"error": "Hesabınızda e-poçt ünvanı qeyd olunmayıb. Zəhmət olmasa menecerlə əlaqə saxlayın."})
		return
	}

	code := generateVerificationCode()
	expiry := time.Now().Add(15 * time.Minute)
	if err := db.Model(&user).Updates(map[string]interface{}{
		"otp_code":        code,
		"otp_code_expiry": &expiry,
		"otp_purpose":     "password_change",
	}).Error; err != nil {
		c.JSON(500, gin.H{"error": "Kod yaradıla bilmədi"})
		return
	}

	if err := SendPasswordOtpEmail(uint(user.TenantID), user.Email, user.Name, code); err != nil {
		c.JSON(500, gin.H{"error": "Kod e-poçtla göndərilə bilmədi: " + err.Error()})
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Təsdiq kodu e-poçtunuza göndərildi."})
}

// ConfirmPasswordChangeOTP - POST /sf/auth/password-otp/confirm {code, new_password}
func (h *Handler) ConfirmPasswordChangeOTP(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(401, gin.H{"error": "İstifadəçi autentifikasiya olunmayıb"})
		return
	}

	var req struct {
		Code        string `json:"code" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=4"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Təsdiq kodu və yeni şifrə/kod tələb olunur (min 4 simvol)"})
		return
	}

	var user User
	if err := db.First(&user, userID).Error; err != nil {
		c.JSON(404, gin.H{"error": "İstifadəçi tapılmadı"})
		return
	}

	if user.OtpPurpose != "password_change" || user.OtpCode == "" || strings.TrimSpace(req.Code) != user.OtpCode {
		c.JSON(400, gin.H{"error": "Təsdiq kodu yanlışdır"})
		return
	}
	if user.OtpCodeExpiry == nil || user.OtpCodeExpiry.Before(time.Now()) {
		c.JSON(400, gin.H{"error": "Kodun vaxtı bitib. Yenidən tələb edin."})
		return
	}

	newHash, err := security.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(500, gin.H{"error": "Şifrə hazırlanarkən xəta"})
		return
	}

	db.Model(&user).Updates(map[string]interface{}{
		"password_hash":   newHash,
		"otp_code":        "",
		"otp_code_expiry": nil,
		"otp_purpose":     "",
	})

	c.JSON(200, gin.H{"success": true, "message": "Şifrə/kod uğurla dəyişdirildi"})
}

// ==================== "GİRİŞ KODUMU UNUTDUM" AXINI ====================
//
// Yalnız vəkil və müştəri rolları üçün (menecer paneldən öz şifrəsini normal
// unudulmuş-şifrə axını ilə deyil, birbaşa admin dəstəyi ilə bərpa edir).
// Kod hash saxlanıldığından köhnə kod bərpa edilə bilmir — əvəzinə yeni
// təsadüfi kod yaradılıb hash-lənir və e-poçtla göndərilir.

func generateNumericLoginCode() string {
	return generateVerificationCode()
}

// ForgotLoginCode - POST /auth/forgot-code {email} (PUBLIC, JWT tələb etmir)
func (h *Handler) ForgotLoginCode(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}

	var req struct {
		Email string `json:"email" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "E-poçt ünvanı tələb olunur"})
		return
	}

	loginEmail := strings.ToLower(strings.TrimSpace(req.Email))

	var user User
	err = db.Where("email = ? AND is_active = ? AND role IN ?", loginEmail, true, []string{"lawyer", "client"}).First(&user).Error
	if err != nil {
		// Təhlükəsizlik səbəbilə mövcud olub-olmadığını açıq bildirmirik —
		// istənilən halda "göndərildi" cavabı qaytarırıq.
		c.JSON(200, gin.H{"success": true, "message": "Əgər bu e-poçt sistemdə qeydiyyatdadırsa, yeni kod ora göndəriləcək."})
		return
	}

	newCode := generateNumericLoginCode()
	newHash, err := security.HashPassword(newCode)
	if err != nil {
		c.JSON(500, gin.H{"error": "Kod hazırlanarkən xəta"})
		return
	}

	if err := db.Model(&user).Updates(map[string]interface{}{
		"password_hash":   newHash,
		"otp_code":        "",
		"otp_code_expiry": nil,
		"otp_purpose":     "",
	}).Error; err != nil {
		c.JSON(500, gin.H{"error": "Kod yenilənə bilmədi"})
		return
	}

	if err := SendLoginCodeResetEmail(uint(user.TenantID), user.Email, user.Name, newCode); err != nil {
		c.JSON(500, gin.H{"error": "Kod e-poçtla göndərilə bilmədi: " + err.Error()})
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Əgər bu e-poçt sistemdə qeydiyyatdadırsa, yeni kod ora göndəriləcək."})
}