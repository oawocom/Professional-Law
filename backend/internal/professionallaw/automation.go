package professionallaw

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// ==================== AVTOMATLAŞDIRMA QAYDALARI MÜHƏRRİKİ ====================
//
// QEYD (2026-09, istifadəçi tapşırığı: "daxili avtomatlaşdırma qaydaları,
// müasir task management sistemlərindəki kimi — məs. tapşırıq statusu X-ə
// dəyişəndə Y-ə bildiriş göndər"). Bu fayl mövcud, artıq sınaqdan keçmiş
// bildiriş infrastrukturunu (notify/notifyManagers/notifyLawyer/notifyClient,
// bax handlers.go) TƏKRARLAMIR — yalnız onun ÜZƏRİNƏ "hansı halda, kimə,
// hansı mətnlə" qərarını verən nazik bir qat əlavə edir. Bu SƏBƏBDƏN v1-də
// yeganə dəstəklənən əməliyyat növü "notify"-dir (AutomationRule.ActionType
// gələcək genişlənmə üçün saxlanılıb).
//
// DƏSTƏKLƏNƏN TETİKLƏYİCİLƏR (hamısı REQUEST-DRIVEN — burada heç bir fon
// proses/cron mövcud deyil, ona görə "N gün qalmış" kimi VAXT-ƏSASLI
// tetikləyicilər BU DÖVRDƏ QƏSDƏN TƏTBIQ EDİLMƏYİB — bax QA hesabatı):
//   - task_status_changed  (UpdateTask, status faktiki dəyişəndə)
//   - task_created         (CreateTask)
//   - contract_created     (CreateContract)
//   - approval_decided     (ProcessApproval, təsdiq/rədd qərarı veriləndə)
//
// ŞƏRT (filter): AutomationRule.TriggerConfig sadə "açar=dəyər" (tam uyğunluq)
// filtri saxlayır (məs. {"to_status":"completed"}) — filtr boşdursa qayda HƏR
// hadisədə işə düşür. Mürəkkəb (VƏ/VƏYA, >/< s.) şərt mühərriki bu dövrdə
// qəsdən tətbiq edilməyib (əhatə dairəsini məhdudlaşdırmaq üçün).
//
// ƏMƏLİYYAT (action): AutomationRule.ActionConfig => {"recipient": "...",
// "title": "...", "message": "..."}. "recipient" ∈ {managers, assigned_lawyer,
// client}. "title"/"message" sahələrində "{{dəyişən_adı}}" formatında
// placeholder-lər dəstəklənir (bax renderTemplate) — hər trigger növünün
// hansı dəyişənləri təqdim etdiyi handlers.go-dakı çağırış nöqtələrində
// görünür (məs. task_status_changed → task_title/from_status/to_status/...).
//
// TƏHLÜKƏSİZLİK: bu mühərrik heç bir YENİ icazə səviyyəsi YARATMIR — qaydanı
// yaratmaq/dəyişmək/silmək "manage_automation_rules" (yalnız menecer üçün,
// mövcud icazə infrastrukturu ilə) tələb edir; qaydanın İCRASI zamanı isə
// mövcud notify*() funksiyaları istifadə olunur — yəni bir qayda YALNIZ artıq
// mövcud olan bildiriş kanallarından istifadə edə bilər, yeni bir giriş
// nöqtəsi/yazma yolu açmır.

// automationEvent - bir hadisənin (trigger firing) bütün kontekstini daşıyır.
type automationEvent struct {
	vars             map[string]string
	entityType       string // "task" | "contract" | "approval"
	entityID         *uint
	assignedLawyerID *uint // Lawyer.ID (varsa) — "assigned_lawyer" alıcısı üçün
	clientID         *uint // Client.ID (varsa) — "client" alıcısı üçün
}

func contractTitleOf(ct *Contract) string {
	if ct == nil {
		return ""
	}
	return ct.Title
}

func clientNameOf(cl *Client) string {
	if cl == nil {
		return ""
	}
	return cl.Name
}

// renderTemplate - "{{key}}" şəklində placeholder-ləri vars ilə əvəz edir.
func renderTemplate(tmpl string, vars map[string]string) string {
	if tmpl == "" {
		return ""
	}
	out := tmpl
	for k, v := range vars {
		out = strings.ReplaceAll(out, "{{"+k+"}}", v)
	}
	return out
}

// automationFilterMatches - TriggerConfig-dəki sadə açar=dəyər filtrini
// hadisənin vars-ı ilə tutuşdurur. Boş/pozulmuş konfiqurasiya => hər zaman uyğun
// (ehtiyatlı defolt: bir qayda naməlum səbəbdən qırıq konfiqurasiya ilə qalarsa,
// "heç işə düşməsin" deyil, "filtrsiz işə düşsün" seçilib — çünki istifadəçi
// filtri boş buraxdıqda da eyni JSON görünüşü yaranır, bunları ayırd etmək
// mümkün deyil, və "bildiriş getmədi" səssiz uğursuzluğu "artıq bildiriş getdi"
// vəziyyətindən daha çətin aşkarlanandır).
func automationFilterMatches(rawConfig datatypes.JSON, vars map[string]string) bool {
	if len(rawConfig) == 0 {
		return true
	}
	trimmed := strings.TrimSpace(string(rawConfig))
	if trimmed == "" || trimmed == "{}" || trimmed == "null" {
		return true
	}
	var cfg map[string]string
	if err := json.Unmarshal(rawConfig, &cfg); err != nil {
		return true
	}
	for key, want := range cfg {
		if strings.TrimSpace(want) == "" {
			continue
		}
		got, ok := vars[key]
		if !ok || !strings.EqualFold(strings.TrimSpace(got), strings.TrimSpace(want)) {
			return false
		}
	}
	return true
}

// evaluateAutomationRules - verilən trigger növü üçün BÜTÜN aktiv qaydaları
// yoxlayır, şərtə uyğun olanları icra edir. Xəta/panik baş versə belə əsas
// sorğu axınına (məs. tapşırıq statusu yeniləməsinə) HEÇ TƏSİR ETMİR — bu,
// köməkçi/əlavə funksionaldır, əsas əməliyyatı bloklamamalıdır.
func evaluateAutomationRules(db *gorm.DB, triggerType string, ev automationEvent) {
	defer func() { recover() }()

	var rules []AutomationRule
	if err := db.Where("trigger_type = ? AND is_active = ?", triggerType, true).Find(&rules).Error; err != nil || len(rules) == 0 {
		return
	}

	for _, rule := range rules {
		if !automationFilterMatches(rule.TriggerConfig, ev.vars) {
			continue
		}
		executeAutomationAction(db, rule, ev)
	}
}

func executeAutomationAction(db *gorm.DB, rule AutomationRule, ev automationEvent) {
	var cfg struct {
		Recipient string `json:"recipient"`
		Title     string `json:"title"`
		Message   string `json:"message"`
	}
	if err := json.Unmarshal(rule.ActionConfig, &cfg); err != nil {
		return
	}

	title := renderTemplate(cfg.Title, ev.vars)
	if strings.TrimSpace(title) == "" {
		title = "Avtomatlaşdırma: " + rule.Name
	}
	message := renderTemplate(cfg.Message, ev.vars)
	const notifType = "automation_rule"

	switch cfg.Recipient {
	case "managers":
		notifyManagers(db, notifType, title, message, ev.entityType, ev.entityID)
	case "assigned_lawyer":
		if ev.assignedLawyerID != nil {
			luID := getLawyerUserID(db, *ev.assignedLawyerID)
			if luID > 0 {
				notifyLawyer(db, luID, notifType, title, message, ev.entityType, ev.entityID)
			}
		}
	case "client":
		if ev.clientID != nil {
			notifyClient(db, *ev.clientID, notifType, title, message, ev.entityType, ev.entityID)
		}
	default:
		return // naməlum alıcı — heç nə etmə (səssiz uğursuzluq, əsas axını pozma)
	}

	now := time.Now()
	db.Model(&AutomationRule{}).Where("id = ?", rule.ID).
		Updates(map[string]interface{}{"run_count": gorm.Expr("run_count + 1"), "last_run_at": now})
}

func isValidAutomationTriggerType(t string) bool {
	switch t {
	case "task_status_changed", "task_created", "contract_created", "approval_decided":
		return true
	}
	return false
}

func isValidAutomationRecipient(r string) bool {
	switch r {
	case "managers", "assigned_lawyer", "client":
		return true
	}
	return false
}

func automationActionRecipient(raw datatypes.JSON) string {
	var cfg struct {
		Recipient string `json:"recipient"`
	}
	json.Unmarshal(raw, &cfg)
	return cfg.Recipient
}

// ==================== CRUD: AUTOMATION RULES (yalnız menecer, manage_automation_rules) ====================

func (h *Handler) ListAutomationRules(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}
	if !requirePermission(c, db, "manage_automation_rules", "Avtomatlaşdırma qaydalarını görmək") {
		return
	}
	db.AutoMigrate(&AutomationRule{})
	var rules []AutomationRule
	db.Order("created_at DESC").Find(&rules)
	if rules == nil {
		rules = []AutomationRule{}
	}
	c.JSON(200, rules)
}

func (h *Handler) CreateAutomationRule(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}
	if !requirePermission(c, db, "manage_automation_rules", "Avtomatlaşdırma qaydası yaratmaq") {
		return
	}
	db.AutoMigrate(&AutomationRule{})

	var input struct {
		Name          string         `json:"name"`
		Description   string         `json:"description"`
		TriggerType   string         `json:"trigger_type"`
		TriggerConfig datatypes.JSON `json:"trigger_config"`
		ActionConfig  datatypes.JSON `json:"action_config"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": "Yanlış məlumat formatı"})
		return
	}
	if strings.TrimSpace(input.Name) == "" {
		c.JSON(400, gin.H{"error": "Qaydanın adı tələb olunur"})
		return
	}
	if !isValidAutomationTriggerType(input.TriggerType) {
		c.JSON(400, gin.H{"error": "Naməlum tetikləyici növü"})
		return
	}
	if !isValidAutomationRecipient(automationActionRecipient(input.ActionConfig)) {
		c.JSON(400, gin.H{"error": "Naməlum alıcı növü"})
		return
	}

	rule := AutomationRule{
		Name:          strings.TrimSpace(input.Name),
		Description:   input.Description,
		IsActive:      true,
		TriggerType:   input.TriggerType,
		TriggerConfig: input.TriggerConfig,
		ActionType:    "notify",
		ActionConfig:  input.ActionConfig,
		CreatedBy:     currentUserID(db, c),
	}
	if err := db.Create(&rule).Error; err != nil {
		c.JSON(500, gin.H{"error": "Qayda yaradıla bilmədi"})
		return
	}
	c.JSON(201, rule)
}

func (h *Handler) UpdateAutomationRule(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}
	if !requirePermission(c, db, "manage_automation_rules", "Avtomatlaşdırma qaydasını redaktə etmək") {
		return
	}

	id := c.Param("id")
	var rule AutomationRule
	if err := db.First(&rule, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Qayda tapılmadı"})
		return
	}

	var input struct {
		Name          *string         `json:"name"`
		Description   *string         `json:"description"`
		IsActive      *bool           `json:"is_active"`
		TriggerType   *string         `json:"trigger_type"`
		TriggerConfig *datatypes.JSON `json:"trigger_config"`
		ActionConfig  *datatypes.JSON `json:"action_config"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": "Yanlış məlumat formatı"})
		return
	}

	if input.Name != nil {
		if strings.TrimSpace(*input.Name) == "" {
			c.JSON(400, gin.H{"error": "Qaydanın adı boş ola bilməz"})
			return
		}
		rule.Name = strings.TrimSpace(*input.Name)
	}
	if input.Description != nil {
		rule.Description = *input.Description
	}
	if input.IsActive != nil {
		rule.IsActive = *input.IsActive
	}
	if input.TriggerType != nil {
		if !isValidAutomationTriggerType(*input.TriggerType) {
			c.JSON(400, gin.H{"error": "Naməlum tetikləyici növü"})
			return
		}
		rule.TriggerType = *input.TriggerType
	}
	if input.TriggerConfig != nil {
		rule.TriggerConfig = *input.TriggerConfig
	}
	if input.ActionConfig != nil {
		if !isValidAutomationRecipient(automationActionRecipient(*input.ActionConfig)) {
			c.JSON(400, gin.H{"error": "Naməlum alıcı növü"})
			return
		}
		rule.ActionConfig = *input.ActionConfig
	}

	db.Save(&rule)
	c.JSON(200, rule)
}

func (h *Handler) DeleteAutomationRule(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}
	if !requirePermission(c, db, "manage_automation_rules", "Avtomatlaşdırma qaydasını silmək") {
		return
	}
	id := c.Param("id")
	if err := db.Delete(&AutomationRule{}, id).Error; err != nil {
		c.JSON(500, gin.H{"error": "Qayda silinə bilmədi"})
		return
	}
	c.JSON(200, gin.H{"success": true})
}
