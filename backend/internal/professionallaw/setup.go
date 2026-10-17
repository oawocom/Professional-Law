package professionallaw

import (
	"errors"
	"log"
	"strings"

	"professionallaw/internal/security"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ============================================================
// BÜRONUN BAZASI
// Prepare bazanı yeniləyir, Seed (handlers.go) ilkin məlumatları
// doldurur, CreateManager menecer hesabı açır.
// Super admin paneli büro yaradanda bunlardan istifadə edir.
// ============================================================

// requestHost - the address the visitor opened (passed on by the frontend / nginx).
func requestHost(c *gin.Context) string {
	if h := strings.TrimSpace(strings.Split(c.GetHeader("X-Forwarded-Host"), ",")[0]); h != "" {
		return h
	}
	return c.Request.Host
}

type meta struct {
	Key   string `gorm:"primaryKey;size:100"`
	Value string
}

func (meta) TableName() string { return "law_meta" }

// Prepare brings an office's database up to date. A database copied from an older
// installation keeps working: law_users.project_id becomes tenant_id, its file list
// (files) is taken into law_files and the old file links in the data are rewritten.
func Prepare(db *gorm.DB, tenantID uint) error {
	m := db.Migrator()
	if m.HasTable(&User{}) && m.HasColumn(&User{}, "project_id") && !m.HasColumn(&User{}, "tenant_id") {
		if err := m.RenameColumn(&User{}, "project_id", "tenant_id"); err != nil {
			return err
		}
	}
	if err := db.AutoMigrate(append(Models(), &File{}, &meta{})...); err != nil {
		return err
	}
	if err := db.Model(&User{}).Where("tenant_id <> ?", tenantID).UpdateColumn("tenant_id", tenantID).Error; err != nil {
		return err
	}
	return importOldFiles(db)
}

// importOldFiles: once per database, take an older installation's file list and links.
func importOldFiles(db *gorm.DB) error {
	var done meta
	if db.Where("key = ?", "old_files_imported").First(&done).Error == nil {
		return nil
	}
	if db.Migrator().HasTable("files") && db.Migrator().HasColumn("files", "folder") {
		if err := db.Exec(`INSERT INTO law_files (filename, name, size, mime_type, created_at)
			SELECT filename, filename, size, mime_type, created_at FROM files WHERE folder = 'professional-law'
			ON CONFLICT (filename) DO NOTHING`).Error; err != nil {
			return err
		}
	}
	var cols []struct{ TableName, ColumnName, DataType string }
	db.Raw(`SELECT table_name, column_name, data_type FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name LIKE 'law\_%'
		AND data_type IN ('text', 'character varying', 'json', 'jsonb')`).Scan(&cols)
	for _, col := range cols {
		cast := ""
		if col.DataType == "json" || col.DataType == "jsonb" {
			cast = "::" + col.DataType
		}
		q := `UPDATE "` + col.TableName + `" SET "` + col.ColumnName + `" = regexp_replace("` + col.ColumnName + `"::text,
			'/api/v1/modules/professional-law/(sf/)?files/([^"?\s\\]+)(\?project_id=[0-9]+)?', '/api/sf/files/\2', 'g')` + cast + `
			WHERE "` + col.ColumnName + `"::text LIKE '%/api/v1/modules/professional-law/%'`
		if res := db.Exec(q); res.Error != nil {
			return res.Error
		} else if res.RowsAffected > 0 {
			log.Printf("professional-law: %s.%s: %d old file links rewritten", col.TableName, col.ColumnName, res.RowsAffected)
		}
	}
	return db.Create(&meta{Key: "old_files_imported", Value: "1"}).Error
}

// CreateManager opens a manager account in the office (the super admin panel's "Menecer əlavə et").
func CreateManager(db *gorm.DB, tenantID uint, name, email, password string) (*User, error) {
	name, email = strings.TrimSpace(name), strings.ToLower(strings.TrimSpace(email))
	if name == "" || email == "" || len(password) < 6 {
		return nil, errors.New("ad, e-poçt və ən azı 6 simvolluq parol lazımdır")
	}
	var n int64
	db.Model(&User{}).Where("LOWER(email) = ?", email).Count(&n)
	if n > 0 {
		return nil, errors.New("bu e-poçtla istifadəçi artıq var — parolunu \"Parol\" düyməsi ilə dəyişin")
	}
	hash, err := security.HashPassword(password)
	if err != nil {
		return nil, err
	}
	u := User{Name: name, Email: email, PasswordHash: hash, Role: "manager", IsActive: true, TenantID: int(tenantID)}
	if err := db.Create(&u).Error; err != nil {
		return nil, err
	}
	return &u, nil
}

// Status is what the super admin panel shows for an office.
func Status(db *gorm.DB) map[string]int64 {
	counts := map[string]int64{}
	if !db.Migrator().HasTable(&User{}) {
		return counts
	}
	var n int64
	db.Model(&User{}).Count(&n)
	counts["users"] = n
	for _, role := range []string{"manager", "lawyer", "client"} {
		var r int64
		db.Model(&User{}).Where("role = ?", role).Count(&r)
		counts[role+"s"] = r
	}
	for name, model := range map[string]interface{}{"contracts": &Contract{}, "tasks": &Task{}} {
		var c int64
		db.Model(model).Count(&c)
		counts[name] = c
	}
	return counts
}

// SetPassword gives an office user a new password (the super admin's "reset password").
func SetPassword(db *gorm.DB, email, password string) error {
	if len(password) < 6 {
		return errors.New("parol ən azı 6 simvol olmalıdır")
	}
	var u User
	if db.Where("LOWER(email) = ?", strings.ToLower(strings.TrimSpace(email))).First(&u).Error != nil {
		return errors.New("bu e-poçtla istifadəçi yoxdur")
	}
	hash, err := security.HashPassword(password)
	if err != nil {
		return err
	}
	return db.Model(&u).Updates(map[string]interface{}{"password_hash": hash, "is_active": true}).Error
}
