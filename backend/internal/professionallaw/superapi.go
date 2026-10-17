package professionallaw

import (
	"errors"
	"strings"

	"gorm.io/gorm"
)

// ============================================================
// SUPER ADMIN PANELİ ÜÇÜN — bir büronun istifadəçiləri və e-poçt sınağı
// ============================================================

// UserRow - super paneldə istifadəçi sətri.
type UserRow struct {
	ID        int     `json:"id"`
	Name      string  `json:"name"`
	Email     string  `json:"email"`
	Role      string  `json:"role"`
	Status    string  `json:"status"`
	IsActive  bool    `json:"is_active"`
	LastLogin *string `json:"last_login"`
	CreatedAt string  `json:"created_at"`
}

// Users - büronun istifadəçiləri (axtarış: ad / e-poçt), ən çox 300.
func Users(db *gorm.DB, q, role string) []UserRow {
	out := []UserRow{}
	if !db.Migrator().HasTable(&User{}) {
		return out
	}
	tx := db.Model(&User{}).Order("role = 'manager' DESC, name ASC").Limit(300)
	if s := strings.TrimSpace(q); s != "" {
		tx = tx.Where("name ILIKE ? OR email ILIKE ?", "%"+s+"%", "%"+s+"%")
	}
	if role != "" {
		tx = tx.Where("role = ?", role)
	}
	var us []User
	tx.Find(&us)
	for _, u := range us {
		st := "active"
		if !u.EmailVerified {
			st = "pending"
		}
		r := UserRow{ID: u.ID, Name: u.Name, Email: u.Email, Role: u.Role, Status: st, IsActive: u.IsActive, CreatedAt: u.CreatedAt.Format("2006-01-02")}
		if u.LastLogin != nil {
			t := u.LastLogin.Format("2006-01-02 15:04")
			r.LastLogin = &t
		}
		out = append(out, r)
	}
	return out
}

// SetActive - hesabı aktiv / deaktiv edir. Büronun son aktiv meneceri deaktiv edilmir.
func SetActive(db *gorm.DB, userID int, active bool) error {
	var u User
	if db.First(&u, userID).Error != nil {
		return errors.New("istifadəçi tapılmadı")
	}
	if !active && u.Role == "manager" && u.IsActive {
		var n int64
		db.Model(&User{}).Where("role = ? AND is_active = ? AND id <> ?", "manager", true, u.ID).Count(&n)
		if n == 0 {
			return errors.New("bu, büronun son aktiv meneceridir — əvvəlcə başqa menecer əlavə edin")
		}
	}
	return db.Model(&u).Update("is_active", active).Error
}

// MailReady - büronun (və ya serverin) SMTP ayarı varmı.
func MailReady(tenantID uint) bool {
	m := MailFor(tenantID)
	return strings.TrimSpace(m.Host) != "" && strings.TrimSpace(m.From) != ""
}

// SendTest - SMTP ayarının sınaq məktubu.
func SendTest(tenantID uint, to, office string) error {
	m := MailFor(tenantID)
	return m.send(to, "Sınaq məktubu — "+office,
		"Salam!\r\n\r\nBu, "+office+" bürosunun e-poçt ayarlarının sınaq məktubudur. Məktubu görürsünüzsə, göndərmə işləyir.\r\n")
}
