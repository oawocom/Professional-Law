package professionallaw

import (
	"crypto/tls"
	"fmt"
	"log"
	"mime"
	"net"
	"net/smtp"
	"strings"
	"time"
)

// ==================== E-POÇT ====================
//
// Hər büro öz SMTP ayarları ilə göndərir (super admin panelində); büronun ayarı
// yoxdursa serverin ümumi SMTP_* ayarı işləyir. MailFor-u server (main) qurur.

// Mail - bir büronun göndərmə ayarları.
type Mail struct {
	Host     string
	Port     string
	User     string
	Password string
	From     string // göndərən ünvan
	FromName string // göndərənin adı (adətən büronun adı)
}

// MailFor bir büronun göndərmə ayarlarını verir.
var MailFor = func(tenantID uint) Mail { return Mail{} }

// SendVerificationEmail - yeni hesabın e-poçt təsdiq kodu.
func SendVerificationEmail(tenantID uint, toEmail, toName, code string) error {
	m := MailFor(tenantID)
	greeting := "Salam"
	if strings.TrimSpace(toName) != "" {
		greeting = "Salam, " + strings.TrimSpace(toName)
	}
	body := fmt.Sprintf(
		"%s,\r\n\r\n"+
			"%s sistemində hesabınız yaradıldı. Hesabınıza daxil olmaq üçün "+
			"aşağıdakı təsdiq kodunu daxil edin:\r\n\r\n"+
			"    %s\r\n\r\n"+
			"Bu kod 15 dəqiqə ərzində etibarlıdır. Əgər bu hesabı siz yaratmamısınızsa, "+
			"bu e-poçtu nəzərə almayın.\r\n\r\n"+
			"Hörmətlə,\r\n%s",
		greeting, m.name(), code, m.name(),
	)
	return m.send(toEmail, "Hesabınızı təsdiqləyin — "+m.name(), body)
}

// SendPasswordOtpEmail - parol dəyişmək üçün təsdiq kodu.
func SendPasswordOtpEmail(tenantID uint, toEmail, toName, code string) error {
	m := MailFor(tenantID)
	return m.send(toEmail, "Parol dəyişmə kodu — "+m.name(), m.codeBody(toName, code,
		"Parolunuzu dəyişmək üçün təsdiq kodunuz:",
		"Bu kod 15 dəqiqə ərzində etibarlıdır. Bu sorğunu siz etməmisinizsə, bu məktubu nəzərə almayın."))
}

// SendLoginCodeResetEmail - sıfırlanmış yeni giriş kodu.
func SendLoginCodeResetEmail(tenantID uint, toEmail, toName, code string) error {
	m := MailFor(tenantID)
	return m.send(toEmail, "Yeni giriş kodunuz — "+m.name(), m.codeBody(toName, code,
		"Hesabınız üçün yeni giriş kodu yaradıldı:",
		"Bu kodu heç kimlə paylaşmayın. Daxil olduqdan sonra onu dəyişdirməyiniz tövsiyə olunur."))
}

func (m Mail) name() string {
	if strings.TrimSpace(m.FromName) != "" {
		return strings.TrimSpace(m.FromName)
	}
	return "Hüquq bürosu"
}

func (m Mail) codeBody(toName, code, intro, note string) string {
	greeting := "Salam"
	if strings.TrimSpace(toName) != "" {
		greeting = "Salam, " + strings.TrimSpace(toName)
	}
	return greeting + "!\r\n\r\n" + intro + "\r\n\r\n    " + code + "\r\n\r\n" + note + "\r\n\r\n" + m.name() + "\r\n"
}

// send - düz mətnli məktub. 465 portu birbaşa TLS, digərləri STARTTLS (server dəstəkləyirsə).
func (m Mail) send(to, subject, body string) error {
	if strings.TrimSpace(to) == "" {
		return fmt.Errorf("empty recipient email")
	}
	if m.Host == "" || m.From == "" {
		log.Printf("professional-law: no SMTP settings for this office, mail to %s not sent", to)
		return fmt.Errorf("e-poçt göndərmə ayarlanmayıb")
	}
	port := m.Port
	if port == "" {
		port = "587"
	}
	var msg strings.Builder
	msg.WriteString("From: " + mime.QEncoding.Encode("utf-8", m.name()) + " <" + m.From + ">\r\n")
	msg.WriteString("To: " + to + "\r\n")
	msg.WriteString("Subject: " + mime.QEncoding.Encode("utf-8", subject) + "\r\n")
	msg.WriteString("Date: " + time.Now().Format(time.RFC1123Z) + "\r\n")
	msg.WriteString("MIME-Version: 1.0\r\nContent-Type: text/plain; charset=\"UTF-8\"\r\nContent-Transfer-Encoding: 8bit\r\n\r\n")
	msg.WriteString(body)

	addr := net.JoinHostPort(m.Host, port)
	var c *smtp.Client
	var err error
	if port == "465" {
		conn, derr := tls.DialWithDialer(&net.Dialer{Timeout: 15 * time.Second}, "tcp", addr, &tls.Config{ServerName: m.Host})
		if derr != nil {
			return m.fail(to, derr)
		}
		c, err = smtp.NewClient(conn, m.Host)
	} else {
		conn, derr := net.DialTimeout("tcp", addr, 15*time.Second)
		if derr != nil {
			return m.fail(to, derr)
		}
		c, err = smtp.NewClient(conn, m.Host)
		if err == nil {
			if ok, _ := c.Extension("STARTTLS"); ok {
				err = c.StartTLS(&tls.Config{ServerName: m.Host})
			}
		}
	}
	if err != nil {
		return m.fail(to, err)
	}
	defer c.Close()
	if m.User != "" {
		if err := c.Auth(smtp.PlainAuth("", m.User, m.Password, m.Host)); err != nil {
			return m.fail(to, err)
		}
	}
	if err := c.Mail(m.From); err != nil {
		return m.fail(to, err)
	}
	if err := c.Rcpt(to); err != nil {
		return m.fail(to, err)
	}
	w, err := c.Data()
	if err != nil {
		return m.fail(to, err)
	}
	if _, err := w.Write([]byte(msg.String())); err != nil {
		return m.fail(to, err)
	}
	if err := w.Close(); err != nil {
		return m.fail(to, err)
	}
	c.Quit()
	log.Printf("professional-law: mail sent to=%s", to)
	return nil
}

func (m Mail) fail(to string, err error) error {
	log.Printf("professional-law: mail to=%s FAILED: %v", to, err)
	return err
}
