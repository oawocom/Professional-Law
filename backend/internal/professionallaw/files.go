package professionallaw

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ==================== FAYLLAR ====================
//
// Büronun faylları serverin diskində saxlanılır: <FILES_DIR>/<büro id>/<fayl adı>.
// law_files cədvəli faylın adını, ölçüsünü və növünü saxlayır. Fayllar yalnız
// büronun öz istifadəçilərinə (token ilə) verilir.

// FilesDir - faylların kök qovluğu (server qurur, FILES_DIR).
var FilesDir = "/data/files"

// MaxUploadBytes - bir faylın ən böyük ölçüsü.
const MaxUploadBytes = 25 << 20

// File - yüklənmiş fayl.
type File struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Filename  string    `gorm:"size:255;uniqueIndex;not null" json:"filename"`
	Name      string    `gorm:"size:255" json:"name"`
	Size      int64     `json:"size"`
	MimeType  string    `gorm:"size:150" json:"mime_type"`
	CreatedAt time.Time `json:"created_at"`
}

func (File) TableName() string { return "law_files" }

func fileURL(filename string) string { return "/api/sf/files/" + filename }

var unsafeName = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)

// storedName - təsadüfi prefiks + təmizlənmiş orijinal ad (qovluğa çıxmaq mümkün deyil).
func storedName(original string) string {
	b := make([]byte, 8)
	rand.Read(b)
	base := strings.Trim(unsafeName.ReplaceAllString(filepath.Base(original), "_"), "._")
	if len(base) > 80 {
		ext := filepath.Ext(base)
		if len(ext) > 10 {
			ext = ""
		}
		base = base[:80-len(ext)] + ext
	}
	if base == "" {
		base = "file"
	}
	return hex.EncodeToString(b) + "_" + base
}

func tenantDir(c *gin.Context) string {
	return filepath.Join(FilesDir, fmt.Sprint(c.MustGet("tenantID").(uint)))
}

// UploadFile - POST /sf/files/upload (multipart "file").
func (h *Handler) UploadFile(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}
	if !requirePermission(c, db, "upload_documents", "Sənəd yükləmək") {
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, MaxUploadBytes+(1<<20))
	fh, err := c.FormFile("file")
	if err != nil {
		c.JSON(400, gin.H{"error": "Fayl göndərilməyib və ya 25 MB-dan böyükdür"})
		return
	}
	if fh.Size > MaxUploadBytes {
		c.JSON(400, gin.H{"error": "Fayl 25 MB-dan böyük ola bilməz"})
		return
	}
	src, err := fh.Open()
	if err != nil {
		c.JSON(400, gin.H{"error": "Fayl oxunmadı"})
		return
	}
	defer src.Close()

	dir := tenantDir(c)
	if err := os.MkdirAll(dir, 0o750); err != nil {
		c.JSON(500, gin.H{"error": "Fayl saxlanmadı"})
		return
	}
	name := storedName(fh.Filename)
	dst, err := os.OpenFile(filepath.Join(dir, name), os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o640)
	if err != nil {
		c.JSON(500, gin.H{"error": "Fayl saxlanmadı"})
		return
	}
	head := make([]byte, 512)
	n, _ := io.ReadFull(src, head)
	written, err := io.Copy(dst, io.MultiReader(strings.NewReader(string(head[:n])), src))
	dst.Close()
	if err != nil {
		os.Remove(filepath.Join(dir, name))
		c.JSON(500, gin.H{"error": "Fayl saxlanmadı"})
		return
	}
	mt := mime.TypeByExtension(strings.ToLower(filepath.Ext(name)))
	if mt == "" {
		mt = http.DetectContentType(head[:n])
	}
	rec := File{Filename: name, Name: filepath.Base(fh.Filename), Size: written, MimeType: mt}
	if err := db.Create(&rec).Error; err != nil {
		os.Remove(filepath.Join(dir, name))
		c.JSON(500, gin.H{"error": "Fayl qeydə alınmadı"})
		return
	}
	c.JSON(201, gin.H{
		"id":       rec.ID,
		"filename": rec.Filename,
		"name":     rec.Name,
		"size":     rec.Size,
		"type":     rec.MimeType,
		"url":      fileURL(rec.Filename),
	})
}

// inlineTypes - brauzerdə açıla bilən növlər; qalanları (html, svg, js ...) yalnız endirilir.
var inlineTypes = map[string]bool{
	"application/pdf": true, "image/png": true, "image/jpeg": true, "image/gif": true, "image/webp": true,
	"audio/mpeg": true, "audio/webm": true, "audio/ogg": true, "audio/wav": true, "audio/mp4": true,
	"video/mp4": true, "video/webm": true, "text/plain": true,
}

// ServeFile - GET /sf/files/:filename (token ilə).
func (h *Handler) ServeFile(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}
	name := filepath.Base(c.Param("filename"))
	var rec File
	if db.Where("filename = ?", name).First(&rec).Error != nil {
		c.JSON(404, gin.H{"error": "Fayl tapılmadı"})
		return
	}
	path := filepath.Join(tenantDir(c), rec.Filename)
	if _, err := os.Stat(path); err != nil {
		c.JSON(404, gin.H{"error": "Fayl tapılmadı"})
		return
	}
	mt := rec.MimeType
	if mt == "" {
		mt = "application/octet-stream"
	}
	base := strings.SplitN(mt, ";", 2)[0]
	disposition := "attachment"
	if inlineTypes[base] {
		disposition = "inline"
	}
	display := rec.Name
	if display == "" {
		display = rec.Filename
	}
	c.Header("Content-Type", mt)
	c.Header("Content-Disposition", mime.FormatMediaType(disposition, map[string]string{"filename": display}))
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Content-Security-Policy", "default-src 'none'; sandbox")
	c.Header("Cache-Control", "private, max-age=3600")
	c.File(path)
}
