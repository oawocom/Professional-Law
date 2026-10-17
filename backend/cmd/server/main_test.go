package main

// End to end: the super admin makes two offices, each opens only at its own address,
// and a login of one office opens nothing in the other.
// Needs a PostgreSQL the tests may create databases in: TEST_DATABASE_URL
// (default postgres://postgres@127.0.0.1:5432/law_test?sslmode=disable).

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"

	"professionallaw/internal/professionallaw"
	"professionallaw/internal/super"
	"professionallaw/internal/tenant"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func testDSN() string {
	if v := os.Getenv("TEST_DATABASE_URL"); v != "" {
		return v
	}
	return "postgres://postgres@127.0.0.1:5432/law_test?sslmode=disable"
}

// freshSystem drops the test system database and the offices' databases made from it, then makes it again.
func freshSystem(t *testing.T) string {
	dsn := testDSN()
	u, _ := url.Parse(dsn)
	name := strings.Trim(u.Path, "/")
	admin := *u
	admin.Path = "/postgres"
	db, err := gorm.Open(postgres.Open(admin.String()), &gorm.Config{})
	if err != nil {
		t.Skip("no test database: ", err)
	}
	var old []string
	db.Raw("SELECT datname FROM pg_database WHERE datname = ? OR datname LIKE ?", name, name+"_t%").Scan(&old)
	for _, d := range old {
		db.Exec(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ?`, d)
		if err := db.Exec(`DROP DATABASE "` + d + `"`).Error; err != nil {
			t.Fatal(err)
		}
	}
	if err := db.Exec(`CREATE DATABASE "` + name + `"`).Error; err != nil {
		t.Fatal(err)
	}
	sqlDB, _ := db.DB()
	sqlDB.Close()
	return dsn
}

type client struct {
	t *testing.T
	r *gin.Engine
}

func (c client) do(method, host, path, token string, body interface{}) (int, map[string]interface{}) {
	var buf bytes.Buffer
	if body != nil {
		json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Host = host
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	c.r.ServeHTTP(w, req)
	out := map[string]interface{}{}
	json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func (c client) must(want int, method, host, path, token string, body interface{}) map[string]interface{} {
	c.t.Helper()
	code, out := c.do(method, host, path, token, body)
	if code != want {
		c.t.Fatalf("%s %s%s = %d, want %d: %v", method, host, path, code, want, out)
	}
	return out
}

func TestOffices(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-only-not-a-real-secret-0123456789abcdef")
	os.Setenv("SUPERADMIN_EMAIL", "root@test.local")
	os.Setenv("SUPERADMIN_PASSWORD", "root-password")
	gin.SetMode(gin.TestMode)
	professionallaw.FilesDir = t.TempDir()

	store, err := tenant.Open(freshSystem(t))
	if err != nil {
		t.Fatal(err)
	}
	if err := super.Setup(store.System); err != nil {
		t.Fatal(err)
	}
	c := client{t, newRouter(store)}
	const panel = "admin.test"

	st := c.must(200, "POST", panel, "/api/super/login", "", map[string]string{"email": "root@test.local", "password": "root-password"})["token"].(string)
	mk := func(name, host, email string) uint {
		out := c.must(201, "POST", panel, "/api/super/tenants", st, map[string]interface{}{
			"name": name, "domains": []string{host},
			"admin": map[string]string{"name": name + " manager", "email": email, "password": "secret123"},
		})
		return uint(out["id"].(float64))
	}
	a := mk("Office A", "a.test", "boss@a.test")
	b := mk("Office B", "b.test", "boss@b.test")

	// office info, default data seeded
	if out := c.must(200, "GET", "a.test", "/api/tenant", "", nil); out["name"] != "Office A" || out["id"] != float64(a) {
		t.Fatalf("tenant: %v", out)
	}
	login := func(host, email string) string {
		return c.must(200, "POST", host, "/api/auth/login", "", map[string]string{"email": email, "password": "secret123"})["token"].(string)
	}
	ta, tb := login("a.test", "boss@a.test"), login("b.test", "boss@b.test")
	// one more manager (the owner's own account); the same e-mail twice is refused
	c.must(201, "POST", panel, fmt.Sprintf("/api/super/tenants/%d/admin", a), st, map[string]string{"name": "Owner", "email": "owner@a.test", "password": "secret123"})
	c.must(400, "POST", panel, fmt.Sprintf("/api/super/tenants/%d/admin", a), st, map[string]string{"name": "Owner", "email": "Owner@a.test", "password": "secret123"})
	login("a.test", "owner@a.test")

	// super panel: users, the last manager stays active, no SMTP → no test mail, super admins, login lock
	users := c.must(200, "GET", panel, fmt.Sprintf("/api/super/tenants/%d/users?q=owner", a), st, nil)["data"].([]interface{})
	if len(users) != 1 {
		t.Fatalf("super users: %v", users)
	}
	ownerID := int(users[0].(map[string]interface{})["id"].(float64))
	c.must(200, "PUT", panel, fmt.Sprintf("/api/super/tenants/%d/users/%d", a, ownerID), st, map[string]bool{"is_active": false})
	c.must(401, "POST", "a.test", "/api/auth/login", "", map[string]string{"email": "owner@a.test", "password": "secret123"})
	c.must(200, "PUT", panel, fmt.Sprintf("/api/super/tenants/%d/users/%d", a, ownerID), st, map[string]bool{"is_active": true})
	bossID := int(c.must(200, "GET", panel, fmt.Sprintf("/api/super/tenants/%d/users?q=boss", a), st, nil)["data"].([]interface{})[0].(map[string]interface{})["id"].(float64))
	c.must(200, "PUT", panel, fmt.Sprintf("/api/super/tenants/%d/users/%d", a, ownerID), st, map[string]bool{"is_active": false})
	c.must(400, "PUT", panel, fmt.Sprintf("/api/super/tenants/%d/users/%d", a, bossID), st, map[string]bool{"is_active": false})
	c.must(200, "PUT", panel, fmt.Sprintf("/api/super/tenants/%d/users/%d", a, ownerID), st, map[string]bool{"is_active": true})
	if v := c.must(200, "GET", panel, "/api/super/tenants", st, nil)["data"].([]interface{})[0].(map[string]interface{}); v["mail_source"] != "none" {
		t.Fatalf("mail source: %v", v["mail_source"])
	}
	c.must(400, "POST", panel, fmt.Sprintf("/api/super/tenants/%d/test-mail", a), st, map[string]string{"to": "x@y.z"})
	extra := c.must(201, "POST", panel, "/api/super/admins", st, map[string]string{"name": "Two", "email": "two@test.local", "password": "another-pass"})
	if n := len(c.must(200, "GET", panel, "/api/super/admins", st, nil)["data"].([]interface{})); n != 2 {
		t.Fatalf("super admins: %d", n)
	}
	c.must(200, "DELETE", panel, fmt.Sprintf("/api/super/admins/%d", int(extra["id"].(float64))), st, nil)
	for i := 0; i < 5; i++ {
		c.must(401, "POST", panel, "/api/super/login", "", map[string]string{"email": "nobody@test.local", "password": "x"})
	}
	c.must(429, "POST", panel, "/api/super/login", "", map[string]string{"email": "nobody@test.local", "password": "x"})
	c.must(200, "GET", "a.test", "/api/sf/auth/me", ta, nil)
	c.must(401, "GET", "b.test", "/api/sf/auth/me", ta, nil) // A's login opens nothing in B
	c.must(401, "POST", "b.test", "/api/auth/login", "", map[string]string{"email": "boss@a.test", "password": "secret123"})
	db, _ := store.DB(a)
	var types int64
	db.Table("law_task_types").Count(&types)
	if types == 0 {
		t.Fatal("task types were not seeded")
	}

	// a file: uploaded in A, served in A only
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, _ := mw.CreateFormFile("file", "../../etc/Müqavilə 1.pdf")
	fw.Write([]byte("%PDF-1.4 test"))
	mw.Close()
	req := httptest.NewRequest("POST", "/api/sf/files/upload", &buf)
	req.Host = "a.test"
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+ta)
	w := httptest.NewRecorder()
	c.r.ServeHTTP(w, req)
	if w.Code != 201 {
		t.Fatalf("upload: %d %s", w.Code, w.Body.String())
	}
	var up map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &up)
	url := up["url"].(string)
	if !strings.HasPrefix(url, "/api/sf/files/") || strings.Contains(url, "..") {
		t.Fatalf("url: %s", url)
	}
	get := func(host, tok string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", url, nil)
		r.Host = host
		r.Header.Set("Authorization", "Bearer "+tok)
		w := httptest.NewRecorder()
		c.r.ServeHTTP(w, r)
		return w
	}
	if w := get("a.test", ta); w.Code != 200 || w.Body.String() != "%PDF-1.4 test" || w.Header().Get("Content-Type") != "application/pdf" {
		t.Fatalf("download: %d %q %s", w.Code, w.Body.String(), w.Header().Get("Content-Type"))
	}
	if w := get("b.test", tb); w.Code != 404 {
		t.Fatalf("B sees A's file: %d", w.Code)
	}
	if w := get("a.test", ""); w.Code != 401 {
		t.Fatalf("file without login: %d", w.Code)
	}

	// mail settings: saved, the password never shown
	out := c.must(200, "PUT", panel, fmt.Sprintf("/api/super/tenants/%d", b), st, map[string]interface{}{
		"name": "Office B", "is_active": true, "domains": []string{"b.test"},
		"mail": map[string]string{"host": "smtp.b.test", "port": "587", "user": "u", "password": "p4ss", "from": "no-reply@b.test"},
	})
	if out["smtp_host"] != "smtp.b.test" || out["smtp_password_set"] != true || out["smtp_password"] != nil {
		t.Fatalf("mail: %v", out)
	}
	tb2, _ := store.Get(b)
	if tb2.SMTPPassword != "p4ss" {
		t.Fatal("mail password not saved")
	}

	// a database copied from an older installation: users, file list and file links come along
	odb, _ := store.DB(b)
	odb.Exec(`ALTER TABLE law_users RENAME COLUMN tenant_id TO project_id`)
	odb.Exec(`UPDATE law_users SET project_id = 49`)
	odb.Exec(`DELETE FROM law_meta`)
	odb.Exec(`CREATE TABLE files (id serial primary key, filename text, size bigint, mime_type text, folder text, created_at timestamptz)`)
	odb.Exec(`INSERT INTO files (filename, size, mime_type, folder, created_at) VALUES ('old_doc.pdf', 10, 'application/pdf', 'professional-law', now()), ('site.png', 5, 'image/png', 'images', now())`)
	odb.Exec(`INSERT INTO law_clients (name, documents) VALUES ('Old client', '[{"name":"a.pdf","url":"/api/v1/modules/professional-law/sf/files/old_doc.pdf?project_id=49"}]')`)
	if err := professionallaw.Prepare(odb, b); err != nil {
		t.Fatal(err)
	}
	var ids []uint
	odb.Raw(`SELECT DISTINCT tenant_id FROM law_users`).Scan(&ids)
	if len(ids) != 1 || ids[0] != b {
		t.Fatalf("tenant ids after import: %v", ids)
	}
	var names []string
	odb.Raw(`SELECT filename FROM law_files`).Scan(&names)
	if len(names) != 1 || names[0] != "old_doc.pdf" {
		t.Fatalf("imported files: %v", names)
	}
	var docs string
	odb.Raw(`SELECT documents::text FROM law_clients WHERE name = 'Old client'`).Scan(&docs)
	if !strings.Contains(docs, `"/api/sf/files/old_doc.pdf"`) {
		t.Fatalf("documents after import: %s", docs)
	}
	login("b.test", "boss@b.test")
}
