// Professional Law: one server for many law offices. An office is found from the
// address it is opened at and keeps its data in a database of its own.
package main

import (
	"log"
	"os"

	"professionallaw/internal/professionallaw"
	"professionallaw/internal/security"
	"professionallaw/internal/super"
	"professionallaw/internal/tenant"

	"github.com/gin-gonic/gin"
)

func main() {
	if err := security.Check(); err != nil {
		log.Fatal(err)
	}
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is not set")
	}
	store, err := tenant.Open(dsn)
	if err != nil {
		log.Fatal("database: ", err)
	}
	if err := super.Setup(store.System); err != nil {
		log.Fatal("super admin: ", err)
	}
	professionallaw.FilesDir = envOr("FILES_DIR", "/data/files")
	if err := os.MkdirAll(professionallaw.FilesDir, 0o750); err != nil {
		log.Fatal("files: ", err)
	}
	professionallaw.MailFor = mailFor(store)

	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := newRouter(store)
	addr := ":" + envOr("PORT", "8080")
	log.Printf("Professional Law API on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatal(err)
	}
}

// newRouter: /api/super is the super admin panel; everything else under /api belongs to the office of the address.
func newRouter(store *tenant.Store) *gin.Engine {
	r := gin.New()
	// Ziyarətçinin IP-si: nginx X-Real-IP-ni özü yazır, frontend onu ötürür; X-Forwarded-For saxtalaşdırıla bilər.
	r.RemoteIPHeaders = []string{"X-Real-IP"}
	r.SetTrustedProxies([]string{"127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "::1/128", "fc00::/7"})
	r.Use(gin.Logger(), gin.Recovery())
	r.MaxMultipartMemory = 32 << 20

	r.GET("/api/health", func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })
	super.RegisterRoutes(r.Group("/api/super"), store)

	api := r.Group("/api")
	api.Use(tenant.Middleware(store))
	api.GET("/tenant", func(c *gin.Context) {
		id := c.MustGet("tenantID").(uint)
		c.JSON(200, gin.H{"id": id, "name": store.Name(id)})
	})
	professionallaw.RegisterRoutes(api, store.DB)
	return r
}

// mailFor: an office's own SMTP settings, or the server's SMTP_* ones; the sender's name is the office's.
func mailFor(store *tenant.Store) func(uint) professionallaw.Mail {
	return func(id uint) professionallaw.Mail {
		m := professionallaw.Mail{
			Host: os.Getenv("SMTP_HOST"), Port: os.Getenv("SMTP_PORT"), User: os.Getenv("SMTP_USER"),
			Password: os.Getenv("SMTP_PASSWORD"), From: os.Getenv("SMTP_FROM"), FromName: os.Getenv("SMTP_FROM_NAME"),
		}
		t, err := store.Get(id)
		if err != nil {
			return m
		}
		if t.SMTPHost != "" {
			m = professionallaw.Mail{Host: t.SMTPHost, Port: t.SMTPPort, User: t.SMTPUser, Password: t.SMTPPassword, From: t.SMTPFrom, FromName: t.SMTPFromName}
		}
		if m.FromName == "" {
			m.FromName = t.Name
		}
		return m
	}
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
