package professionallaw

import (
	"encoding/json"
	"sync"
	"strings"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"professionallaw/internal/security"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type Handler struct {
	getDB func(tenantID uint) (*gorm.DB, error)
}

func NewHandler(getDB func(tenantID uint) (*gorm.DB, error)) *Handler {
	return &Handler{getDB: getDB}
}

var preparedTenants sync.Map

// tenantDB - the office's own database. Once per process for each office Prepare
// brings it up to date, so new columns and tables appear with the first request.
func (h *Handler) tenantDB(c *gin.Context) (*gorm.DB, error) {
	tenantID := c.MustGet("tenantID").(uint)
	db, err := h.getDB(tenantID)
	if err != nil {
		return nil, err
	}
	if _, done := preparedTenants.LoadOrStore(tenantID, true); !done {
		if perr := Prepare(db, tenantID); perr != nil {
			log.Printf("professional-law: prepare office %d: %v", tenantID, perr)
			preparedTenants.Delete(tenantID)
		}
	}
	return db, nil
}

// ==================== NOTIFICATION HELPER ====================
// Bütün hərəkətlər üçün bildirim yaradır

func notify(db *gorm.DB, userID uint, userType, notifType, title, message, entityType string, entityID *uint) {
	n := Notification{
		UserID:     userID,
		UserType:   userType,
		Type:       notifType,
		Title:      title,
		Message:    message,
		EntityType: entityType,
		EntityID:   entityID,
	}
	db.Create(&n)
}

// Notify all managers
func notifyManagers(db *gorm.DB, notifType, title, message, entityType string, entityID *uint) {
	var managers []User
	db.Where("role = ? AND is_active = ?", "manager", true).Find(&managers)
	for _, m := range managers {
		notify(db, uint(m.ID), "manager", notifType, title, message, entityType, entityID)
	}
}

// Notify specific lawyer
func notifyLawyer(db *gorm.DB, lawyerUserID uint, notifType, title, message, entityType string, entityID *uint) {
	notify(db, lawyerUserID, "lawyer", notifType, title, message, entityType, entityID)
}

// Notify client by client record ID (not user ID)
func notifyClient(db *gorm.DB, clientID uint, notifType, title, message, entityType string, entityID *uint) {
	var client Client
	if err := db.First(&client, clientID).Error; err == nil && client.UserID != nil {
		notify(db, *client.UserID, "client", notifType, title, message, entityType, entityID)
	}
}

// Get lawyer's user_id from lawyer record
func getLawyerUserID(db *gorm.DB, lawyerID uint) uint {
	var lawyer Lawyer
	if err := db.First(&lawyer, lawyerID).Error; err == nil && lawyer.UserID != nil {
		return *lawyer.UserID
	}
	return 0
}

// ==================== TARİXÇƏ (TASK HISTORY) HELPER ====================
// Approval cədvəli "logged" statuslu psevdo-qeydlər üçün ümumi tarixçə jurnalı
// kimi də istifadə olunur (Status: "logged" — real təsdiq axını deyil).
// Bu funksiya hər hansı tapşırıq hərəkətini (redaktə, təhkim, sənəd, arxivləşdirmə,
// şərh və s.) saniyəyə qədər dəqiq vaxt möhürü ilə qeyd edir.

// currentUserID - JWT-dəki userID-ni law_users.id-yə çevirir (log üçün "kim etdi").
func currentUserID(db *gorm.DB, c *gin.Context) uint {
	if uidVal, exists := c.Get("userID"); exists {
		var u User
		if db.Select("id").First(&u, uidVal).Error == nil {
			return uint(u.ID)
		}
	}
	return 0
}

func logTaskHistory(db *gorm.DB, taskID uint, requestedBy uint, approvalType string, reason string, previousStatus string, newStatus string, attachments datatypes.JSON) {
	db.Create(&Approval{
		ApprovalType:   approvalType,
		EntityType:     "task",
		EntityID:       taskID,
		TaskID:         &taskID,
		RequestedBy:    requestedBy,
		RequestedAt:    time.Now(),
		Status:         "logged",
		PreviousStatus: previousStatus,
		NewStatus:      newStatus,
		Reason:         reason,
		Attachments:    attachments,
	})
}

// taskFieldLabels - redaktə tarixçəsində sahə adlarını insan-oxunaqlı formada göstərmək üçün.
var taskFieldLabels = map[string]string{
	"title": "Başlıq", "subject": "Mövzu", "description": "Təsvir",
	"priority": "Prioritet", "category": "Kateqoriya", "deadline": "Son tarix",
	"claim_deadline": "İddia müddəti", "amount": "Məbləğ", "static_lawyer_fee": "Vəkil haqqı",
	"court_name": "Məhkəmə", "case_number": "İş nömrəsi", "claim_amount": "İddia məbləği",
	"client_role": "Müştəri rolu", "opposite_role": "Qarşı tərəf rolu",
	"opposite_party_name": "Qarşı tərəf adı", "claim_type": "İddia növü",
	"unvalued_claim_text": "Qiymətləndirilməyən iddia", "completion_result": "Yekun nəticə",
	"notes": "Qeydlər",
}

func describeFieldChanges(keys []string) string {
	if len(keys) == 0 {
		return ""
	}
	labels := make([]string, 0, len(keys))
	for _, k := range keys {
		if l, ok := taskFieldLabels[k]; ok {
			labels = append(labels, l)
		} else {
			labels = append(labels, k)
		}
	}
	return "Redaktə edildi: " + strings.Join(labels, ", ")
}

// ==================== STATS ====================

func (h *Handler) GetStats(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}

	var totalLawyers, activeLawyers int64
	var totalClients, activeClients int64
	var totalContracts, activeContracts int64
	var totalTasks, pendingTasks, completedTasks, cancelledTasks, inProgressTasks int64
	var pendingApprovals int64

	db.Model(&Lawyer{}).Count(&totalLawyers)
	db.Model(&Lawyer{}).Where("status = ?", "active").Count(&activeLawyers)
	db.Model(&Client{}).Count(&totalClients)
	db.Model(&Client{}).Where("status = ?", "active").Count(&activeClients)
	db.Model(&Contract{}).Count(&totalContracts)
	db.Model(&Contract{}).Where("status = ?", "active").Count(&activeContracts)
	db.Model(&Task{}).Count(&totalTasks)
	db.Model(&Task{}).Where("status IN ?", []string{"pending", "new"}).Count(&pendingTasks)
	db.Model(&Task{}).Where("status = ?", "completed").Count(&completedTasks)
	db.Model(&Task{}).Where("status = ?", "cancelled").Count(&cancelledTasks)
	db.Model(&Task{}).Where("status = ?", "in-progress").Count(&inProgressTasks)
	db.Model(&Approval{}).Where("status = ?", "pending").Count(&pendingApprovals)

	c.JSON(200, gin.H{
		"total_lawyers":    totalLawyers,
		"active_lawyers":   activeLawyers,
		"total_clients":    totalClients,
		"active_clients":   activeClients,
		"total_contracts":  totalContracts,
		"active_contracts": activeContracts,
		"total_tasks":      totalTasks,
		"pending_tasks":    pendingTasks,
		"completed_tasks":  completedTasks,
		"cancelled_tasks":  cancelledTasks,
		"in_progress_tasks": inProgressTasks,
		"pending_approvals": pendingApprovals,
		// Legacy keys for backward compat
		"lawyers":  activeLawyers,
		"clients":  activeClients,
		"contracts": totalContracts,
		"tasks":    totalTasks,
	})
}

// ==================== LAWYERS ====================

func (h *Handler) ListLawyers(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "view_lawyers", "Vəkilləri görmək") {
		return
	}
	status := c.Query("status")
	search := c.Query("search")

	query := db.Model(&Lawyer{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if search != "" {
		query = query.Where("name ILIKE ? OR email ILIKE ? OR specialization ILIKE ? OR specializations::text ILIKE ?", "%"+search+"%", "%"+search+"%", "%"+search+"%", "%"+search+"%")
	}

	var lawyers []Lawyer
	query.Order("name ASC").Find(&lawyers)

	// active_cases/completed_cases denormalized sayğacları tarixən bəzi kod
	// yollarında (məs. ilk dəfə təhkim) artırılmırdı və 0-da donub qalırdı.
	// Burada real Task cədvəlindən hesablanır və uyğunsuzluq varsa DB-də də
	// düzəldilir ki, bu özü-özünü sağaldan (self-healing) davranış olsun.
	if len(lawyers) > 0 {
		type countRow struct {
			AssignedTo uint
			Cnt        int64
		}
		var activeRows []countRow
		db.Model(&Task{}).
			Select("assigned_to, count(*) as cnt").
			Where("assigned_to IS NOT NULL AND status NOT IN ? AND (is_archived IS NULL OR is_archived = false)", []string{"completed", "cancelled", "is_tamamlandi", "is_tehvil_verildi"}).
			Group("assigned_to").
			Scan(&activeRows)
		activeMap := map[uint]int64{}
		for _, r := range activeRows {
			activeMap[r.AssignedTo] = r.Cnt
		}

		var completedRows []countRow
		db.Model(&Task{}).
			Select("assigned_to, count(*) as cnt").
			Where("assigned_to IS NOT NULL AND status IN ?", []string{"completed", "is_tamamlandi", "is_tehvil_verildi"}).
			Group("assigned_to").
			Scan(&completedRows)
		completedMap := map[uint]int64{}
		for _, r := range completedRows {
			completedMap[r.AssignedTo] = r.Cnt
		}

		for i := range lawyers {
			realActive := int(activeMap[lawyers[i].ID])
			realCompleted := int(completedMap[lawyers[i].ID])
			if lawyers[i].ActiveCases != realActive || lawyers[i].CompletedCases != realCompleted {
				db.Model(&Lawyer{}).Where("id = ?", lawyers[i].ID).Updates(map[string]interface{}{
					"active_cases":    realActive,
					"completed_cases": realCompleted,
				})
				lawyers[i].ActiveCases = realActive
				lawyers[i].CompletedCases = realCompleted
			}
		}
	}

	c.JSON(200, lawyers)
}

func (h *Handler) GetLawyer(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "view_lawyers", "Vəkilləri görmək") {
		return
	}
	id := c.Param("id")

	var lawyer Lawyer
	if err := db.First(&lawyer, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Lawyer not found"})
		return
	}
	c.JSON(200, lawyer)
}

func (h *Handler) CreateLawyer(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "edit_lawyers", "Vəkil əlavə etmək") {
		return
	}

	var input struct {
		Name           string  `json:"name"`
		Email          string  `json:"email"`
		Phone          string  `json:"phone"`
		Avatar         string  `json:"avatar"`
		Specialization string  `json:"specialization"`
		Specializations []string `json:"specializations"`
		LicenseNumber  string  `json:"license_number"`
		BarAssociation string  `json:"bar_association"`
		Experience     int     `json:"experience"`
		Rating         float32 `json:"rating"`
		Status         string  `json:"status"`
		Password       string  `json:"password"`
		Education      interface{} `json:"education"`
		CareerHistory  interface{} `json:"career_history"`
		Certifications interface{} `json:"certifications"`
		Languages      interface{} `json:"languages"`
		Achievements   interface{} `json:"achievements"`
		WorkingHours   interface{} `json:"working_hours"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	if input.Name == "" {
		c.JSON(400, gin.H{"error": "Name is required"})
		return
	}

	specialization := input.Specialization
	var specializationsJSON datatypes.JSON
	if len(input.Specializations) > 0 {
		if data, err := json.Marshal(input.Specializations); err == nil {
			specializationsJSON = datatypes.JSON(data)
		}
		specialization = strings.Join(input.Specializations, ", ")
	} else if specialization != "" {
		if data, err := json.Marshal([]string{specialization}); err == nil {
			specializationsJSON = datatypes.JSON(data)
		}
	}

	lawyer := Lawyer{
		Name:           input.Name,
		Email:          input.Email,
		Phone:          input.Phone,
		Avatar:         input.Avatar,
		Specialization: specialization,
		Specializations: specializationsJSON,
		LicenseNumber:  input.LicenseNumber,
		BarAssociation: input.BarAssociation,
		Experience:     input.Experience,
		Rating:         input.Rating,
		Status:         "active",
	}
	if input.Status != "" {
		lawyer.Status = input.Status
	}

	if err := db.Create(&lawyer).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to create lawyer"})
		return
	}

	// Auto-create a law_users account for login if email is provided
	if input.Email != "" {
		password := input.Password
		if password == "" {
			password = "lawyer123" // default password
		}
		hash, err := security.HashPassword(password)
		if err == nil {
			tenantID := c.MustGet("tenantID").(uint)
			lawyerID := int(lawyer.ID)
			user := User{
				Name:         input.Name,
				Email:        input.Email,
				PasswordHash: hash,
				Role:         "lawyer",
				LawyerID:     &lawyerID,
				IsActive:     true,
				EmailVerified: false,
				TenantID:    int(tenantID),
			}
			if err := db.Create(&user).Error; err == nil {
				uid := uint(user.ID)
				db.Model(&lawyer).Update("user_id", uid)
				// Vəkil hesab yaradıldıqda e-poçt təsdiq kodu göndərilir — vəkil
				// öz panelinə yalnız bu kodu daxil etdikdən sonra keçid ala bilər.
				if err := issueVerificationCode(db, &user); err != nil {
					log.Printf("professional-law: CreateLawyer verification email failed for %s: %v", user.Email, err)
				}
			}
		}
	}

	c.JSON(201, lawyer)
}

func (h *Handler) UpdateLawyer(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "edit_lawyers", "Vəkili redaktə etmək") {
		return
	}
	id := c.Param("id")

	var lawyer Lawyer
	if err := db.First(&lawyer, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Lawyer not found"})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	delete(updates, "id")
	delete(updates, "created_at")
	delete(updates, "password")

	if specsRaw, has := updates["specializations"]; has {
		var specs []string
		if arr, ok := specsRaw.([]interface{}); ok {
			for _, v := range arr {
				if s, ok := v.(string); ok && s != "" {
					specs = append(specs, s)
				}
			}
		}
		if data, err := json.Marshal(specs); err == nil {
			updates["specializations"] = datatypes.JSON(data)
		}
		if len(specs) > 0 {
			updates["specialization"] = strings.Join(specs, ", ")
		}
	}

	db.Model(&lawyer).Updates(updates)
	db.First(&lawyer, id)

	// Sync name/email to law_users if changed
	if lawyer.UserID != nil {
		syncUpdates := map[string]interface{}{}
		if name, ok := updates["name"]; ok {
			syncUpdates["name"] = name
		}
		if email, ok := updates["email"]; ok {
			syncUpdates["email"] = email
		}
		if len(syncUpdates) > 0 {
			db.Model(&User{}).Where("id = ?", *lawyer.UserID).Updates(syncUpdates)
		}
	}

	c.JSON(200, lawyer)
}

// nonFinalTaskStatuses — bu statuslarda olan tapşırıqlar "hələ tamamlanmamış" sayılır.
var nonFinalTaskStatusesExclude = []string{"completed", "cancelled", "is_tamamlandi", "is_tehvil_verildi"}

// GetLawyerPendingTasks - GET /lawyers/:id/pending-tasks — vəkili silmədən əvvəl
// onun hələ son statusa çatdırmadığı tapşırıqları göstərir (xəbərdarlıq pəncərəsi üçün).
func (h *Handler) GetLawyerPendingTasks(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "delete_lawyers", "Vəkili silmək") {
		return
	}
	id := c.Param("id")

	var tasks []Task
	db.Where("assigned_to = ? AND status NOT IN ? AND (is_archived IS NULL OR is_archived = false)", id, nonFinalTaskStatusesExclude).
		Preload("Client").Preload("Contract").Find(&tasks)

	c.JSON(200, gin.H{"tasks": tasks, "count": len(tasks)})
}

func (h *Handler) DeleteLawyer(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "delete_lawyers", "Vəkili silmək") {
		return
	}
	id := c.Param("id")

	var input struct {
		// Reassignments: {"12": 5} — 12 nömrəli tapşırıq 5 nömrəli vəkilə yenidən təhkim olunur
		Reassignments map[string]uint `json:"reassignments"`
	}
	_ = c.ShouldBindJSON(&input) // DELETE bədəni boş ola bilər — xəta ciddi deyil

	// Silinməzdən əvvəl vəkilin hələ son statusa çatmayan tapşırıqlarını yoxla.
	var pendingTasks []Task
	db.Where("assigned_to = ? AND status NOT IN ? AND (is_archived IS NULL OR is_archived = false)", id, nonFinalTaskStatusesExclude).Find(&pendingTasks)

	if len(pendingTasks) > 0 {
		// Hər bir gözləyən tapşırıq üçün reassignments-də yeni vəkil göstərilməlidir
		unresolved := []Task{}
		for _, t := range pendingTasks {
			key := strconv.Itoa(int(t.ID))
			if _, ok := input.Reassignments[key]; !ok {
				unresolved = append(unresolved, t)
			}
		}
		if len(unresolved) > 0 {
			c.JSON(409, gin.H{
				"error":         "Bu vəkilin hələ tamamlanmamış tapşırıqları var. Silməzdən əvvəl hər biri üçün yeni vəkil təyin edin.",
				"pending_tasks": pendingTasks,
			})
			return
		}
		// Hər tapşırığı yenidən təhkim et
		for _, t := range pendingTasks {
			key := strconv.Itoa(int(t.ID))
			newLawyerID := input.Reassignments[key]
			if newLawyerID == 0 {
				continue
			}
			db.Model(&Task{}).Where("id = ?", t.ID).Update("assigned_to", newLawyerID)
			db.Model(&Lawyer{}).Where("id = ?", newLawyerID).UpdateColumn("active_cases", gorm.Expr("active_cases + 1"))
			logTaskHistory(db, t.ID, currentUserID(db, c), "reassigned", "Vəkil silindiyi üçün yenidən təhkim edildi", "", "", nil)
		}
	}

	var lawyer Lawyer
	db.First(&lawyer, id)

	txErr := db.Transaction(func(tx *gorm.DB) error {
		// Yuxarıdakı addımdan sonra bu vəkilə hələ "assigned_to" ilə bağlı qalan
		// tapşırıqlar yalnız artıq TAMAMLANMIŞ (son statuslu) ola bilər — onlar
		// FK constraint (tasks.assigned_to -> lawyers.id) səbəbindən vəkilin
		// silinməsini əngəlləyirdi. Tarixçə qorunur, yalnız canlı referans silinir.
		if err := tx.Model(&Task{}).Where("assigned_to = ?", id).Update("assigned_to", nil).Error; err != nil {
			return err
		}

		// Also delete associated user account
		if lawyer.UserID != nil {
			if err := tx.Delete(&User{}, *lawyer.UserID).Error; err != nil {
				return err
			}
		}

		return tx.Delete(&Lawyer{}, id).Error
	})

	if txErr != nil {
		c.JSON(500, gin.H{"error": "Vəkil silinmədi: " + txErr.Error()})
		return
	}
	c.JSON(200, gin.H{"success": true, "reassigned_count": len(pendingTasks)})
}

// ==================== CLIENTS ====================

func (h *Handler) ListClients(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "view_clients", "Müştəriləri görmək") {
		return
	}
	status := c.Query("status")
	clientType := c.Query("type")
	search := c.Query("search")

	query := db.Model(&Client{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if clientType == "legal" {
		// Köhnə "company" dəyəri ilə geriyə uyğunluq
		query = query.Where("type IN ?", []string{"legal", "company"})
	} else if clientType != "" {
		query = query.Where("type = ?", clientType)
	}
	if search != "" {
		query = query.Where("name ILIKE ? OR email ILIKE ? OR company_name ILIKE ?", "%"+search+"%", "%"+search+"%", "%"+search+"%")
	}

	// Sahiblik məhdudiyyəti: "client" rolu yalnız özünü (+ bağlı Fərdi hesablarını),
	// "lawyer" rolu yalnız özünə təhkim olunan tapşırıqlara aid müştəriləri görür.
	switch currentUserRole(c) {
	case "client":
		ids, ok := scopedClientIDs(db, c)
		if !ok {
			ids = []uint{0}
		}
		query = query.Where("id IN ?", ids)
	case "lawyer":
		if lawyerIDVal, ok := c.Get("lawyerID"); ok {
			query = query.Where("id IN ?", lawyerClientIDs(db, lawyerIDVal.(int)))
		}
	}

	var clients []Client
	query.Order("created_at DESC").Find(&clients)
	c.JSON(200, clients)
}

func (h *Handler) GetClient(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "view_clients", "Müştəriləri görmək") {
		return
	}
	id := c.Param("id")

	var client Client
	if err := db.First(&client, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Client not found"})
		return
	}

	switch currentUserRole(c) {
	case "client":
		ids, ok := scopedClientIDs(db, c)
		if !ok || !containsUint(ids, client.ID) {
			c.JSON(403, gin.H{"error": "Bu müştəriyə giriş icazəniz yoxdur"})
			return
		}
	case "lawyer":
		if lawyerIDVal, ok := c.Get("lawyerID"); ok {
			if !containsUint(lawyerClientIDs(db, lawyerIDVal.(int)), client.ID) {
				c.JSON(403, gin.H{"error": "Bu müştəriyə giriş icazəniz yoxdur"})
				return
			}
		}
	}

	c.JSON(200, client)
}

func (h *Handler) CreateClient(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "edit_clients", "Müştəri əlavə etmək") {
		return
	}
	// Müştəri/bağlı hesab yaratmaq — YALNIZ menecer əməliyyatıdır. "client"/"lawyer"
	// rolları defolt-icazəli (Restricted=false) ola bilər, ona görə bu yoxlama
	// icazə matrisindən ASILI OLMAYARAQ tətbiq edilir (özünə-xidmət hesab
	// yaratma yolunu bağlamaq üçün — bax LinkedAccountsModal.tsx UI qeydi).
	if currentUserRole(c) != "manager" {
		c.JSON(403, gin.H{"error": "Yeni müştəri/bağlı hesab yalnız menecer panelindən yaradıla bilər"})
		return
	}

	var input struct {
		Name           string `json:"name"`
		Email          string `json:"email"`
		Phone          string `json:"phone"`
		Type           string `json:"type"`
		Address        string `json:"address"`
		CompanyName    string `json:"company_name"`
		TaxNumber      string `json:"tax_number"`
		ContactPerson  string `json:"contact_person"`
		Notes          string `json:"notes"`
		Source         string `json:"source"`
		Status         string `json:"status"`
		Password       string `json:"password"`
		ParentClientID *uint  `json:"parent_client_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Email-i normalize et (kiçik hərf + trim) — login registr uyğunsuzluğunu önləyir
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))

	if input.Name == "" {
		c.JSON(400, gin.H{"error": "Ad Soyad / Ad tələb olunur"})
		return
	}
	if input.Type == "" {
		input.Type = "individual"
	}

	// Hüquqi şəxs — özünə bağlı Fərdi hesab yaradılırsa (ParentClientID doludursa)
	// bu Fərdi hesab özü Hüquqi şəxs sayılmır, ona görə şirkət sahələri tələb olunmur.
	if isLegalClientType(input.Type) && input.ParentClientID == nil {
		if strings.TrimSpace(input.CompanyName) == "" {
			c.JSON(400, gin.H{"error": "Qurumun/Şirkətin adı tələb olunur"})
			return
		}
		if strings.TrimSpace(input.TaxNumber) == "" {
			c.JSON(400, gin.H{"error": "VÖEN/Qeydiyyat nömrəsi tələb olunur"})
			return
		}
		if strings.TrimSpace(input.ContactPerson) == "" {
			c.JSON(400, gin.H{"error": "Əlaqədar şəxs tələb olunur"})
			return
		}
	}

	// Əgər ParentClientID verilibsə, onun həqiqətən Hüquqi şəxs olduğunu yoxla
	if input.ParentClientID != nil {
		var parent Client
		if err := db.First(&parent, *input.ParentClientID).Error; err != nil {
			c.JSON(400, gin.H{"error": "Göstərilən Hüquqi şəxs tapılmadı"})
			return
		}
		if !isLegalClientType(parent.Type) {
			c.JSON(400, gin.H{"error": "Fərdi hesab yalnız Hüquqi şəxsə bağlana bilər"})
			return
		}
	}

	client := Client{
		Name:           input.Name,
		Email:          input.Email,
		Phone:          input.Phone,
		Type:           input.Type,
		Address:        input.Address,
		CompanyName:    input.CompanyName,
		TaxNumber:      input.TaxNumber,
		ContactPerson:  input.ContactPerson,
		Notes:          input.Notes,
		Source:         input.Source,
		Status:         "active",
		ParentClientID: input.ParentClientID,
	}
	if input.Status != "" {
		client.Status = input.Status
	}

	if err := db.Create(&client).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to create client"})
		return
	}

	// === NOTIFICATIONS ===
	notifyManagers(db, "client_created", "Yeni müştəri yaradıldı",
		fmt.Sprintf("Yeni müştəri: %s", client.Name), "client", &client.ID)

	// Auto-create a law_users account for login if email is provided
	if input.Email != "" {
		// === YENİ AXIN: Manager-set initial code ===
		// Əgər password sahəsi gəlirsə, birbaşa o şifrəni hash et və User yarat.
		// Müştəri bu kodu e-poçtla birlikdə işlədib daxil olacaq.
		if input.Password != "" {
			// Check if email already exists in law_users
			var existingUser User
			if db.Where("email = ?", input.Email).First(&existingUser).Error == nil {
				// Email is already taken — rollback the client record and return error
				db.Delete(&client)
				c.JSON(409, gin.H{"error": "Bu e-poçt ünvanı artıq başqa hesabda istifadə edilir. Fərqli e-poçt daxil edin."})
				return
			}

			hash, err := security.HashPassword(input.Password)
			if err != nil {
				db.Delete(&client)
				c.JSON(500, gin.H{"error": "Şifrə hazırlanarkən xəta baş verdi"})
				return
			}

			tenantID := c.MustGet("tenantID").(uint)
			clientID := int(client.ID)
			user := User{
				Name:         input.Name,
				Email:        input.Email,
				PasswordHash: hash,
				Role:         "client",
				ClientID:     &clientID,
				IsActive:     true,
				EmailVerified: false,
				TenantID:    int(tenantID),
			}
			if err := db.Create(&user).Error; err != nil {
				// User creation failed — rollback the client record and return error
				db.Delete(&client)
				c.JSON(500, gin.H{"error": "İstifadəçi hesabı yaradılarkən xəta baş verdi: " + err.Error()})
				return
			}
			uid := uint(user.ID)
			db.Model(&client).Update("user_id", uid)

			// Müştəri hesabı yaradıldıqda e-poçt təsdiq kodu göndərilir — müştəri
			// öz panelinə yalnız bu kodu daxil etdikdən sonra keçid ala bilər.
			if err := issueVerificationCode(db, &user); err != nil {
				log.Printf("professional-law: CreateClient verification email failed for %s: %v", user.Email, err)
			}

			c.JSON(201, gin.H{
				"client":  client,
				"message": fmt.Sprintf("Müştəri yaradıldı. Email=%s ünvanına təsdiq kodu göndərildi. Müştəri kodu daxil etdikdən sonra panelinə keçid ala biləcək.", input.Email),
			})
			return
		}

		// === KÖHNƏ AXIN (geri uyğunluq): setup_url qaytarır ===
		setupToken := GenerateSetupToken()
		expiry := time.Now().Add(7 * 24 * time.Hour)

		tempHash, err := security.HashPassword("__pending_setup__" + setupToken)
		if err == nil {
			tenantID := c.MustGet("tenantID").(uint)
			clientID := int(client.ID)
			user := User{
				Name:             input.Name,
				Email:            input.Email,
				PasswordHash:     tempHash,
				Role:             "client",
				ClientID:         &clientID,
				IsActive:         true,
				TenantID:        int(tenantID),
				SetupToken:       setupToken,
				SetupTokenExpiry: &expiry,
			}
			if err := db.Create(&user).Error; err == nil {
				uid := uint(user.ID)
				db.Model(&client).Update("user_id", uid)
			}
		}

		setupURL := "https://" + requestHost(c) + "/setup-password?token=" + setupToken

		c.JSON(201, gin.H{
			"client":      client,
			"setup_url":   setupURL,
			"setup_token": setupToken,
			"message":     "Client created. Share the setup link so the client can set their password.",
		})
		return
	}

	c.JSON(201, client)
}


// SetClientLogin — creates or updates the law_users login entry for a client.
// Called by manager to (re)set a client's login password.
// Works even if the law_users record doesn't exist yet.
func (h *Handler) SetClientLogin(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "edit_clients", "Müştəri girişini idarə etmək") {
		return
	}
	id := c.Param("id")

	var client Client
	if err := db.First(&client, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Müştəri tapılmadı"})
		return
	}
	if client.Email == "" {
		c.JSON(400, gin.H{"error": "Müştərinin e-poçt ünvanı yoxdur. Əvvəlcə e-poçt əlavə edin."})
		return
	}

	var req struct {
		Password string `json:"password" binding:"required,min=4"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Şifrə tələb olunur (min 4 simvol)"})
		return
	}

	hash, err := security.HashPassword(req.Password)
	if err != nil {
		c.JSON(500, gin.H{"error": "Şifrə hazırlanarkən xəta"})
		return
	}

	tenantID := c.MustGet("tenantID").(uint)
	clientID := int(client.ID)

	// Check if a law_users record already exists for this email
	var existing User
	if db.Where("email = ?", client.Email).First(&existing).Error == nil {
		// User exists — just update the password (and ensure is_active + client_id)
		db.Model(&existing).Updates(map[string]interface{}{
			"password_hash": hash,
			"is_active":     true,
			"client_id":     clientID,
			"role":          "client",
		})
		// Ensure client.user_id is linked
		db.Model(&client).Update("user_id", existing.ID)
		c.JSON(200, gin.H{
			"success": true,
			"message": "Giriş şifrəsi yeniləndi",
			"email":   client.Email,
		})
		return
	}

	// No user record — create one
	user := User{
		Name:         client.Name,
		Email:        client.Email,
		PasswordHash: hash,
		Role:         "client",
		ClientID:     &clientID,
		IsActive:     true,
		TenantID:    int(tenantID),
	}
	if err := db.Create(&user).Error; err != nil {
		c.JSON(500, gin.H{"error": "İstifadəçi hesabı yaradılarkən xəta: " + err.Error()})
		return
	}
	uid := uint(user.ID)
	db.Model(&client).Update("user_id", uid)

	c.JSON(201, gin.H{
		"success": true,
		"message": "Giriş hesabı yaradıldı",
		"email":   client.Email,
	})
}

func (h *Handler) UpdateClient(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "edit_clients", "Müştərini redaktə etmək") {
		return
	}
	id := c.Param("id")

	var client Client
	if err := db.First(&client, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Client not found"})
		return
	}

	if currentUserRole(c) == "client" {
		ids, ok := scopedClientIDs(db, c)
		if !ok || !containsUint(ids, client.ID) {
			c.JSON(403, gin.H{"error": "Bu müştəriyə giriş icazəniz yoxdur"})
			return
		}
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	delete(updates, "id")
	delete(updates, "created_at")
	delete(updates, "password")

	db.Model(&client).Updates(updates)
	db.First(&client, id)

	// Sync name/email to law_users if changed
	if client.UserID != nil {
		syncUpdates := map[string]interface{}{}
		if name, ok := updates["name"]; ok {
			syncUpdates["name"] = name
		}
		if email, ok := updates["email"]; ok {
			syncUpdates["email"] = email
		}
		if len(syncUpdates) > 0 {
			db.Model(&User{}).Where("id = ?", *client.UserID).Updates(syncUpdates)
		}
	}

	// === NOTIFICATIONS ===
	// Notify managers about client profile change
	notifyManagers(db, "client_updated", "Müştəri məlumatı yeniləndi",
		fmt.Sprintf("Müştəri məlumatı yeniləndi: %s", client.Name), "client", &client.ID)
	// Notify lawyers assigned to tasks of this client
	var assignedLawyerIDs []uint
	db.Model(&Task{}).Where("client_id = ? AND assigned_to IS NOT NULL", client.ID).
		Distinct("assigned_to").Pluck("assigned_to", &assignedLawyerIDs)
	for _, lid := range assignedLawyerIDs {
		luID := getLawyerUserID(db, lid)
		if luID > 0 {
			notifyLawyer(db, luID, "client_updated", "Müştəri məlumatı yeniləndi",
				fmt.Sprintf("Müştəri profili yeniləndi: %s", client.Name), "client", &client.ID)
		}
	}

	c.JSON(200, client)
}

func (h *Handler) DeleteClient(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "delete_clients", "Müştərini silmək") {
		return
	}
	// Müştəri silmək YALNIZ menecer əməliyyatıdır — icazə matrisindən asılı
	// olmayaraq (defolt-icazəli hesablar bu təhlükəli əməliyyatı yerinə
	// yetirməməlidir).
	if currentUserRole(c) != "manager" {
		c.JSON(403, gin.H{"error": "Müştəri silmək yalnız menecerə icazəlidir"})
		return
	}
	id := c.Param("id")

	var client Client
	if err := db.First(&client, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Client not found"})
		return
	}

	// Hüquqi şəxsdirsə, ona bağlı bütün Fərdi hesablar da birgə silinir —
	// əks halda onlar valideynsiz (parent_client_id yetim) qalardı.
	targetIDs := []uint{client.ID}
	if isLegalClientType(client.Type) {
		var linkedChildIDs []uint
		db.Model(&Client{}).Where("parent_client_id = ?", client.ID).Pluck("id", &linkedChildIDs)
		targetIDs = append(targetIDs, linkedChildIDs...)
	}

	var contractCount, taskCount int64

	// Müştərinin (və bağlı hesabların) bütün müqavilə və tapşırıqları FK
	// constraint (contracts.client_id / tasks.client_id -> clients.id)
	// səbəbindən müştəri silinmədən əvvəl silinməlidir — əks halda "Sil"
	// əməliyyatı foreign-key xətası ilə səssizcə uğursuz olur.
	txErr := db.Transaction(func(tx *gorm.DB) error {
		var contractIDs []uint
		tx.Model(&Contract{}).Where("client_id IN ?", targetIDs).Pluck("id", &contractIDs)

		if len(contractIDs) > 0 {
			if res := tx.Where("contract_id IN ?", contractIDs).Delete(&Task{}); res.Error != nil {
				return res.Error
			} else {
				taskCount += res.RowsAffected
			}
		}
		if res := tx.Where("client_id IN ?", targetIDs).Delete(&Task{}); res.Error != nil {
			return res.Error
		} else {
			taskCount += res.RowsAffected
		}
		if res := tx.Where("client_id IN ?", targetIDs).Delete(&Contract{}); res.Error != nil {
			return res.Error
		} else {
			contractCount = res.RowsAffected
		}

		// Hədəf müştərilərin (özü + bağlı hesablar) giriş (User) hesablarını da sil
		var userIDs []uint
		tx.Model(&Client{}).Where("id IN ? AND user_id IS NOT NULL", targetIDs).Pluck("user_id", &userIDs)
		if len(userIDs) > 0 {
			if err := tx.Where("id IN ?", userIDs).Delete(&User{}).Error; err != nil {
				return err
			}
		}

		if err := tx.Where("id IN ?", targetIDs).Delete(&Client{}).Error; err != nil {
			return err
		}
		return nil
	})

	if txErr != nil {
		c.JSON(500, gin.H{"error": "Müştəri silinmədi: " + txErr.Error()})
		return
	}
	c.JSON(200, gin.H{
		"success":                true,
		"cascaded_contracts":     contractCount,
		"cascaded_tasks":         taskCount,
		"cascaded_linked_clients": len(targetIDs) - 1,
	})
}

// ==================== CONTRACTS ====================

func (h *Handler) ListContracts(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "view_contracts", "Müqavilələri görmək") {
		return
	}
	ep := loadEffectivePerms(db, c)
	status := c.Query("status")
	lawyerID := c.Query("lawyer_id")
	clientID := c.Query("client_id")
	search := c.Query("search")

	query := db.Model(&Contract{}).Preload("Client")
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if lawyerID != "" {
		// Contract cədvəlində birbaşa lawyer_id sütunu yoxdur — vəkilin əlaqəsi
		// ona təhkim olunan Task-lar vasitəsilədir.
		var lidTaskContractIDs []uint
		db.Model(&Task{}).Where("assigned_to = ? AND contract_id IS NOT NULL", lawyerID).Distinct("contract_id").Pluck("contract_id", &lidTaskContractIDs)
		query = query.Where("id IN ?", lidTaskContractIDs)
	}
	if clientID != "" {
		query = query.Where("client_id = ?", clientID)
	}
	if search != "" {
		query = query.Where("title ILIKE ? OR contract_number ILIKE ?", "%"+search+"%", "%"+search+"%")
	}

	// Müqaviləyə bağlanmış (restricted) istifadəçi yalnız öz müqaviləsini görür
	if restrictedID := getRestrictedContractID(db, c); restrictedID != nil {
		query = query.Where("id = ?", *restrictedID)
	} else {
		// Sahiblik məhdudiyyəti: restricted-contract halı yoxdursa, "client"
		// yalnız özünə (+ bağlı hesablara) aid müqavilələri, "lawyer" yalnız
		// özünə təhkim olunan tapşırıqlara aid müqavilələri görür.
		switch currentUserRole(c) {
		case "client":
			ids, ok := scopedClientIDs(db, c)
			if !ok {
				ids = []uint{0}
			}
			query = query.Where("client_id IN ?", ids)
		case "lawyer":
			if lawyerIDVal, ok := c.Get("lawyerID"); ok {
				query = query.Where("id IN ?", lawyerContractIDs(db, lawyerIDVal.(int)))
			}
		}
	}

	var contracts []Contract
	query.Order("created_at DESC").Find(&contracts)

	// Count actual tasks per contract for accurate tasks_used
	type TaskCount struct {
		ContractID uint
		Count      int64
	}
	var taskCounts []TaskCount
	db.Model(&Task{}).Select("contract_id, count(*) as count").
		Where("contract_id IS NOT NULL").
		Group("contract_id").
		Find(&taskCounts)

	taskCountMap := make(map[uint]int64)
	for _, tc := range taskCounts {
		taskCountMap[tc.ContractID] = tc.Count
	}

	// Enrich with client_name and actual tasks_used
	type ContractResponse struct {
		Contract
		ClientName    string `json:"client_name"`
		TasksUsedActual int `json:"tasks_used_actual"`
	}
	var response []ContractResponse
	for _, ct := range contracts {
		cr := ContractResponse{Contract: ct}
		if ct.Client != nil {
			cr.ClientName = ct.Client.Name
		}
		// Set tasks_used from actual task count
		cr.TasksUsedActual = int(taskCountMap[ct.ID])
		cr.Contract.TasksUsed = cr.TasksUsedActual
		if !ep.Allowed("view_amounts") {
			maskContractAmounts(&cr.Contract)
		}
		response = append(response, cr)
	}
	if response == nil {
		response = []ContractResponse{}
	}

	c.JSON(200, response)
}

func (h *Handler) GetContract(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "view_contracts", "Müqavilələri görmək") {
		return
	}
	id := c.Param("id")

	var contract Contract
	if err := db.Preload("Client").First(&contract, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Contract not found"})
		return
	}

	if restrictedID := getRestrictedContractID(db, c); !contractAccessAllowed(restrictedID, &contract.ID) {
		denyContractAccess(c)
		return
	} else if restrictedID == nil {
		switch currentUserRole(c) {
		case "client":
			ids, ok := scopedClientIDs(db, c)
			if !ok || !containsUint(ids, contract.ClientID) {
				denyContractAccess(c)
				return
			}
		case "lawyer":
			if lawyerIDVal, ok := c.Get("lawyerID"); ok {
				if !containsUint(lawyerContractIDs(db, lawyerIDVal.(int)), contract.ID) {
					denyContractAccess(c)
					return
				}
			}
		}
	}

	if !loadEffectivePerms(db, c).Allowed("view_amounts") {
		maskContractAmounts(&contract)
	}

	c.JSON(200, contract)
}

func (h *Handler) CreateContract(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}
	if !requirePermission(c, db, "edit_contracts", "Müqavilə yaratmaq") {
		return
	}

	var input struct {
		Title             string      `json:"title"`
		ClientID          uint        `json:"client_id"`
		Description       string      `json:"description"`
		Category          string      `json:"category"`
		Type              string      `json:"type"`
		Status            string      `json:"status"`
		Priority          string      `json:"priority"`
		StartDate         *time.Time  `json:"start_date"`
		EndDate           *time.Time  `json:"end_date"`
		Value             float64     `json:"value"`
		Notes             string      `json:"notes"`
		Terms             string      `json:"terms"`
		TaskQuota         int         `json:"task_quota"`
		AutoRenew         bool        `json:"auto_renew"`
		StaticLawyerFee   float64     `json:"static_lawyer_fee"`
		AllowedCategories []string    `json:"allowed_categories"`
		WorkLocations     []string    `json:"work_locations"`
		CourtName         string      `json:"court_name"`
		CaseNumber        string      `json:"case_number"`
		ClaimAmount       float64     `json:"claim_amount"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": "Invalid data: " + err.Error()})
		return
	}

	if (input.Value != 0 || input.StaticLawyerFee != 0 || input.ClaimAmount != 0) && !loadEffectivePerms(db, c).Allowed("edit_amounts") {
		c.JSON(403, gin.H{"error": "Maliyyə məlumatlarını (məbləğ, haqq) daxil etmək üçün icazəniz yoxdur. Admin ilə əlaqə saxlayın.", "permission_key": "edit_amounts", "permission_denied": true})
		return
	}

	// Validate required fields
	if input.ClientID == 0 {
		c.JSON(400, gin.H{"error": "client_id is required"})
		return
	}
	if input.Title == "" {
		c.JSON(400, gin.H{"error": "title is required"})
		return
	}
	if input.StartDate != nil && input.EndDate != nil && input.StartDate.After(*input.EndDate) {
		c.JSON(400, gin.H{"error": "Başlama tarixi bitmə tarixindən gec ola bilməz"})
		return
	}

	// Validate client exists
	var clientExists Client
	if err := db.First(&clientExists, input.ClientID).Error; err != nil {
		c.JSON(400, gin.H{"error": fmt.Sprintf("Client with ID %d not found", input.ClientID)})
		return
	}

	// Build allowed_categories JSON
	var allowedCatsJSON datatypes.JSON
	if len(input.AllowedCategories) > 0 {
		if data, err := json.Marshal(input.AllowedCategories); err == nil {
			allowedCatsJSON = datatypes.JSON(data)
		}
	} else {
		allowedCatsJSON = datatypes.JSON([]byte("[]"))
	}

	var workLocsJSON datatypes.JSON
	if len(input.WorkLocations) > 0 {
		if data, err := json.Marshal(input.WorkLocations); err == nil {
			workLocsJSON = datatypes.JSON(data)
		}
	} else {
		workLocsJSON = datatypes.JSON([]byte("[]"))
	}

	contract := Contract{
		Title:             input.Title,
		ClientID:          input.ClientID,
		Description:       input.Description,
		Category:          input.Category,
		Type:              input.Type,
		Priority:          input.Priority,
		StartDate:         input.StartDate,
		EndDate:           input.EndDate,
		Value:             input.Value,
		Notes:             input.Notes,
		Terms:             input.Terms,
		TaskQuota:         input.TaskQuota,
		AutoRenew:         input.AutoRenew,
		StaticLawyerFee:   input.StaticLawyerFee,
		AllowedCategories: allowedCatsJSON,
		WorkLocations:     workLocsJSON,
		CourtName:         input.CourtName,
		CaseNumber:        input.CaseNumber,
		ClaimAmount:       input.ClaimAmount,
		ContractNumber:    "CNT-" + strconv.FormatInt(time.Now().Unix(), 10),
	}

	if contract.TaskQuota == 0 {
		contract.TaskQuota = 100
	}
	if contract.Status == "" || input.Status == "" {
		contract.Status = "active"
	} else {
		contract.Status = input.Status
	}

	if err := db.Create(&contract).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to create contract: " + err.Error()})
		return
	}

	db.Preload("Client").First(&contract, contract.ID)

	// === NOTIFICATIONS ===
	notifyManagers(db, "contract_created", "Yeni müqavilə yaradıldı",
		fmt.Sprintf("Yeni müqavilə: %s", contract.Title), "contract", &contract.ID)
	notifyClient(db, contract.ClientID, "contract_created", "Yeni müqaviləniz yaradıldı",
		fmt.Sprintf("Yeni müqavilə: %s", contract.Title), "contract", &contract.ID)

	// === AVTOMATLAŞDIRMA (2026-09, istifadəçi tapşırığı) ===
	evaluateAutomationRules(db, "contract_created", automationEvent{
		vars: map[string]string{
			"contract_title": contract.Title, "contract_number": contract.ContractNumber,
			"client_name": clientNameOf(contract.Client),
		},
		entityType: "contract", entityID: &contract.ID,
		clientID: &contract.ClientID,
	})

	// List/Get/Update endpoint-ləri ilə eyni qayda: view_amounts icazəsi
	// olmayan yaradıcıya (məs. edit_amounts=true amma view_amounts=false
	// kombinasiyalı fərdi override) cavabda maliyyə sahələri açıq getməsin.
	if !loadEffectivePerms(db, c).Allowed("view_amounts") {
		maskContractAmounts(&contract)
	}

	c.JSON(201, contract)
}

var amountFieldKeys = map[string]bool{
	"value": true, "static_lawyer_fee": true, "claim_amount": true,
	"total_claim": true, "claim_amounts": true,
}

func (h *Handler) UpdateContract(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "edit_contracts", "Müqaviləni redaktə etmək") {
		return
	}
	id := c.Param("id")

	var contract Contract
	if err := db.First(&contract, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Contract not found"})
		return
	}

	if restrictedID := getRestrictedContractID(db, c); !contractAccessAllowed(restrictedID, &contract.ID) {
		denyContractAccess(c)
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	delete(updates, "id")
	delete(updates, "created_at")

	ep := loadEffectivePerms(db, c)
	if !ep.Allowed("edit_amounts") {
		for k := range amountFieldKeys {
			if _, has := updates[k]; has {
				c.JSON(403, gin.H{"error": "Maliyyə məlumatlarını redaktə etmək üçün icazəniz yoxdur. Admin ilə əlaqə saxlayın.", "permission_key": "edit_amounts", "permission_denied": true})
				return
			}
		}
	}

	// Başlama tarixi bitmə tarixindən gec ola bilməz — mövcud + yeni dəyərləri müqayisə et
	{
		parseDate := func(v interface{}) (*time.Time, bool) {
			s, ok := v.(string)
			if !ok || s == "" {
				return nil, true
			}
			t, err := time.Parse(time.RFC3339, s)
			if err != nil {
				t, err = time.Parse("2006-01-02", s)
				if err != nil {
					return nil, false
				}
			}
			return &t, true
		}
		newStart := contract.StartDate
		newEnd := contract.EndDate
		if v, has := updates["start_date"]; has {
			t, ok := parseDate(v)
			if !ok {
				c.JSON(400, gin.H{"error": "Yanlış başlama tarixi formatı"})
				return
			}
			newStart = t
		}
		if v, has := updates["end_date"]; has {
			t, ok := parseDate(v)
			if !ok {
				c.JSON(400, gin.H{"error": "Yanlış bitmə tarixi formatı"})
				return
			}
			newEnd = t
		}
		if newStart != nil && newEnd != nil && newStart.After(*newEnd) {
			c.JSON(400, gin.H{"error": "Başlama tarixi bitmə tarixindən gec ola bilməz"})
			return
		}
	}

	db.Model(&contract).Updates(updates)
	db.Preload("Client").First(&contract, id)
	if !ep.Allowed("view_amounts") {
		maskContractAmounts(&contract)
	}
	c.JSON(200, contract)
}

func (h *Handler) DeleteContract(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "delete_contracts", "Müqaviləni silmək") {
		return
	}
	id := c.Param("id")

	// Delete related task comments first
	db.Exec("DELETE FROM law_task_comments WHERE task_id IN (SELECT id FROM law_tasks WHERE contract_id = ?)", id)
	
	// Delete related tasks
	db.Where("contract_id = ?", id).Delete(&Task{})

	// Delete related approvals
	db.Exec("DELETE FROM law_approvals WHERE task_id IN (SELECT id FROM law_tasks WHERE contract_id = ?)", id)

	// Now delete contract
	if err := db.Delete(&Contract{}, id).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to delete"})
		return
	}
	c.JSON(200, gin.H{"success": true})
}

// ==================== TASKS ====================

func (h *Handler) ListTasks(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "view_tasks", "Tapşırıqları görmək") {
		return
	}
	ep := loadEffectivePerms(db, c)
	status := c.Query("status")
	contractID := c.Query("contract_id")
	assignedTo := c.Query("assigned_to")
	priority := c.Query("priority")
	category := c.Query("category")
	search := c.Query("search")

	query := db.Model(&Task{}).Preload("Contract").Preload("Contract.Client").Preload("Assignee")
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if contractID != "" {
		query = query.Where("contract_id = ?", contractID)
	}
	if assignedTo != "" {
		query = query.Where("assigned_to = ?", assignedTo)
	}
	if priority != "" {
		query = query.Where("priority = ?", priority)
	}
	if category != "" {
		query = query.Where("category = ?", category)
	}
	if search != "" {
		query = query.Where("title ILIKE ? OR description ILIKE ?", "%"+search+"%", "%"+search+"%")
	}

	// Müqaviləyə bağlanmış (restricted) istifadəçi yalnız öz müqaviləsinin tapşırıqlarını görür
	if restrictedID := getRestrictedContractID(db, c); restrictedID != nil {
		query = query.Where("contract_id = ?", *restrictedID)
	} else {
		// Sahiblik məhdudiyyəti: "client" yalnız öz (+ bağlı hesablar) tapşırıqlarını,
		// "lawyer" yalnız özünə təhkim olunanları görür.
		switch currentUserRole(c) {
		case "client":
			ids, ok := scopedClientIDs(db, c)
			if !ok {
				ids = []uint{0}
			}
			query = query.Where("client_id IN ?", ids)
		case "lawyer":
			if lawyerIDVal, ok := c.Get("lawyerID"); ok {
				query = query.Where("assigned_to = ?", lawyerIDVal)
			}
		}
	}

	var tasks []Task
	query.Order("created_at DESC").Find(&tasks)

	// Enrich with flat fields for frontend compatibility
	type TaskResponse struct {
		Task
		ContractTitle       string `json:"contract_title"`
		ClientName          string `json:"client_name"`
		LawyerName          string `json:"lawyer_name"`
		LawyerSpecialization string `json:"lawyer_specialization"`
		CreatedByRole       string `json:"created_by_role"`
	}

	// CreatedBy real olaraq bir istifadəçi ID-sidir, rol adı deyil — frontend-in
	// "Yaradan: Müştəri/Menecer" filtri əvvəllər `t.createdBy === 'client'`
	// (heç vaxt doğru olmayan) müqayisə edirdi. Burada həqiqi rolu bir dəfəyə
	// (tək sorğu ilə) axtarıb hər sətrə əlavə edirik.
	var creatorIDs []uint
	for _, t := range tasks {
		if t.CreatedBy > 0 {
			creatorIDs = append(creatorIDs, t.CreatedBy)
		}
	}
	creatorRoleMap := map[uint]string{}
	if len(creatorIDs) > 0 {
		var creators []User
		db.Select("id, role").Where("id IN ?", creatorIDs).Find(&creators)
		for _, u := range creators {
			creatorRoleMap[uint(u.ID)] = u.Role
		}
	}

	var response []TaskResponse
	for _, t := range tasks {
		tr := TaskResponse{Task: t}
		if t.Contract != nil {
			tr.ContractTitle = t.Contract.Title
			if t.Contract.Client != nil {
				tr.ClientName = t.Contract.Client.Name
			}
		}
		if t.Assignee != nil {
			tr.LawyerName = t.Assignee.Name
			tr.LawyerSpecialization = t.Assignee.Specialization
		}
		tr.CreatedByRole = creatorRoleMap[t.CreatedBy]
		if !ep.Allowed("view_amounts") {
			maskTaskAmounts(&tr.Task)
		}
		response = append(response, tr)
	}
	if response == nil {
		response = []TaskResponse{}
	}

	c.JSON(200, response)
}

func (h *Handler) GetTask(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "view_tasks", "Tapşırıqları görmək") {
		return
	}
	id := c.Param("id")

	var task Task
	if err := db.Preload("Contract").Preload("Contract.Client").Preload("Assignee").First(&task, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Task not found"})
		return
	}

	if restrictedID := getRestrictedContractID(db, c); !contractAccessAllowed(restrictedID, task.ContractID) {
		denyContractAccess(c)
		return
	} else if restrictedID == nil {
		switch currentUserRole(c) {
		case "client":
			ids, ok := scopedClientIDs(db, c)
			taskClientID := uint(0)
			if task.ClientID != nil {
				taskClientID = *task.ClientID
			}
			if !ok || !containsUint(ids, taskClientID) {
				denyContractAccess(c)
				return
			}
		case "lawyer":
			if lawyerIDVal, ok := c.Get("lawyerID"); ok {
				taskAssignedTo := 0
				if task.AssignedTo != nil {
					taskAssignedTo = int(*task.AssignedTo)
				}
				if taskAssignedTo != lawyerIDVal.(int) {
					denyContractAccess(c)
					return
				}
			}
		}
	}

	if !loadEffectivePerms(db, c).Allowed("view_amounts") {
		maskTaskAmounts(&task)
	}

	c.JSON(200, task)
}

func (h *Handler) CreateTask(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "create_tasks", "Tapşırıq yaratmaq") {
		return
	}

	var task Task
	if err := c.ShouldBindJSON(&task); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	if restrictedID := getRestrictedContractID(db, c); !contractAccessAllowed(restrictedID, task.ContractID) {
		denyContractAccess(c)
		return
	} else if restrictedID == nil && currentUserRole(c) == "client" {
		// Müştəri yalnız öz (+ bağlı hesablar) müştəri/müqaviləsi üzərində
		// tapşırıq yarada bilər — başqa müştərinin müqaviləsinə "client_id"/
		// "contract_id" saxtalaşdırmaqla tapşırıq yazıla bilməməlidir.
		ids, ok := scopedClientIDs(db, c)
		if !ok {
			ids = []uint{0}
		}
		taskClientID := uint(0)
		if task.ClientID != nil {
			taskClientID = *task.ClientID
		}
		if !containsUint(ids, taskClientID) {
			c.JSON(403, gin.H{"error": "Yalnız öz hesabınıza aid tapşırıq yarada bilərsiniz"})
			return
		}
		if task.ContractID != nil {
			var ct Contract
			if err := db.Select("client_id").First(&ct, *task.ContractID).Error; err != nil || !containsUint(ids, ct.ClientID) {
				c.JSON(403, gin.H{"error": "Yalnız öz müqaviləniz üzrə tapşırıq yarada bilərsiniz"})
				return
			}
		}
	}

	if strings.TrimSpace(task.Title) == "" {
		c.JSON(400, gin.H{"error": "Tapşırığın adı tələb olunur"})
		return
	}
	if task.Deadline == nil {
		c.JSON(400, gin.H{"error": "Son tarix (deadline) tələb olunur"})
		return
	}

	if task.TotalClaim != 0 && !loadEffectivePerms(db, c).Allowed("edit_amounts") {
		c.JSON(403, gin.H{"error": "Maliyyə (iddia məbləği) daxil etmək üçün icazəniz yoxdur. Admin ilə əlaqə saxlayın.", "permission_key": "edit_amounts", "permission_denied": true})
		return
	}

	if task.Status == "" {
		// UpdateTask-dakı eyni məntiq: yaradılış anında birbaşa vəkil təhkim
		// edilibsə (status ayrıca göndərilməyibsə), tapşırıq "Təhkim gözləyir"
		// deyil, birbaşa "Vəkil təhkim edildi" statusu ilə başlasın.
		if task.AssignedTo != nil {
			task.Status = "tehkim_olundu"
		} else {
			task.Status = "new"
		}
	}
	if task.Priority == "" {
		task.Priority = "normal"
	}

	// Auto-inherit contract categories as task category tag
	if task.ContractID != nil && task.Category == "" {
		var contract Contract
		if db.Select("allowed_categories").First(&contract, *task.ContractID).Error == nil {
			var cats []string
			if err := json.Unmarshal(contract.AllowedCategories, &cats); err == nil && len(cats) > 0 {
				// Join all contract categories as comma-separated tag string
				task.Category = strings.Join(cats, ", ")
			}
		}
	}

	if err := db.Create(&task).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to create task"})
		return
	}

	// TaskNumber boş gələrsə (və ya köhnə frontend hələ Math.random() əsaslı
	// 4-rəqəmli təsadüfi kod göndərirsə), sətrin öz ID-sinə görə HƏMIŞƏ unikal
	// olan bir nömrə ilə əvəz edilir — əvvəlki üsul (yalnız 9000 mümkün dəyər)
	// unikallığı təmin etmirdi.
	if strings.TrimSpace(task.TaskNumber) == "" {
		task.TaskNumber = fmt.Sprintf("#%d", task.ID)
		db.Model(&task).Update("task_number", task.TaskNumber)
	}

	// Update lawyer active_cases count
	if task.AssignedTo != nil {
		db.Model(&Lawyer{}).Where("id = ?", *task.AssignedTo).
			UpdateColumn("active_cases", gorm.Expr("active_cases + 1"))
	}

	// Tarixçə (history) üçün "yaradıldı" logu yaz
	{
		var requestedBy uint
		if uidVal, exists := c.Get("userID"); exists {
			var u User
			if db.Select("id").First(&u, uidVal).Error == nil {
				requestedBy = uint(u.ID)
			}
		}
		db.Create(&Approval{
			ApprovalType:   "created",
			EntityType:     "task",
			EntityID:       task.ID,
			TaskID:         &task.ID,
			RequestedBy:    requestedBy,
			RequestedAt:    time.Now(),
			Status:         "logged",
			NewStatus:      task.Status,
			Reason:         "Tapşırıq yaradıldı",
		})
	}

	db.Preload("Contract").Preload("Assignee").First(&task, task.ID)

	// === NOTIFICATIONS ===
	// Notify managers: new task created
	notifyManagers(db, "task_created", "Yeni tapşırıq yaradıldı",
		fmt.Sprintf("Tapşırıq yaradıldı: %s", task.Title), "task", &task.ID)
	// Notify assigned lawyer
	if task.AssignedTo != nil {
		luID := getLawyerUserID(db, *task.AssignedTo)
		if luID > 0 {
			notifyLawyer(db, luID, "task_assigned", "Yeni tapşırıq təhkim edildi",
				fmt.Sprintf("Tapşırıq sizə təhkim edildi: %s", task.Title), "task", &task.ID)
		}
	}

	// === AVTOMATLAŞDIRMA (2026-09, istifadəçi tapşırığı) ===
	evaluateAutomationRules(db, "task_created", automationEvent{
		vars: map[string]string{
			"task_title": task.Title, "task_number": task.TaskNumber,
			"status": task.Status, "priority": task.Priority,
			"contract_title": contractTitleOf(task.Contract),
		},
		entityType: "task", entityID: &task.ID,
		assignedLawyerID: task.AssignedTo, clientID: task.ClientID,
	})

	// List/Get/Update endpoint-ləri ilə eyni qayda: view_amounts icazəsi
	// olmayan yaradıcıya cavabda maliyyə sahələri açıq getməsin.
	if !loadEffectivePerms(db, c).Allowed("view_amounts") {
		maskTaskAmounts(&task)
	}

	c.JSON(201, task)
}

func (h *Handler) UpdateTask(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "edit_tasks", "Tapşırığı redaktə etmək") {
		return
	}
	id := c.Param("id")

	var task Task
	if err := db.First(&task, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Task not found"})
		return
	}

	restrictedID := getRestrictedContractID(db, c)
	if !contractAccessAllowed(restrictedID, task.ContractID) {
		denyContractAccess(c)
		return
	}

	oldStatus := task.Status
	oldAssignee := task.AssignedTo
	oldChecklistLen := 0
	{
		var oldDocs []interface{}
		if json.Unmarshal(task.DocumentChecklist, &oldDocs) == nil {
			oldChecklistLen = len(oldDocs)
		}
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	delete(updates, "id")
	delete(updates, "created_at")
	if restrictedID != nil {
		// Bağlı istifadəçi tapşırığı başqa müqaviləyə köçürə bilməz
		delete(updates, "contract_id")
	}

	// history_reason/history_attachments — Task cədvəlində sütun deyil, yalnız
	// tarixçə qeydi üçün əlavə kontekst kimi frontend-dən göndərilə bilər
	// (məs: status dəyişikliyinə əlavə edilən qeyd/sənəd). Update-dən əvvəl çıxarılır.
	historyReason, _ := updates["history_reason"].(string)
	var historyAttachments datatypes.JSON
	if ha, ok := updates["history_attachments"].(string); ok && ha != "" {
		historyAttachments = datatypes.JSON([]byte(ha))
	}
	delete(updates, "history_reason")
	delete(updates, "history_attachments")

	// Tarixçə üçün: hansı sahələr faktiki dəyişdirilir (status/assigned_to/document_checklist
	// ayrıca işlənəcək, qalanları "Redaktə edildi" kimi qeyd olunur)
	var otherChangedFields []string
	for k := range updates {
		if k == "status" || k == "assigned_to" || k == "document_checklist" || k == "completed_at" || k == "updated_at" {
			continue
		}
		otherChangedFields = append(otherChangedFields, k)
	}

	ep := loadEffectivePerms(db, c)
	if _, ok := updates["status"]; ok && !ep.Allowed("change_status") {
		c.JSON(403, gin.H{"error": "Tapşırığın statusunu dəyişmək üçün icazəniz yoxdur. Admin ilə əlaqə saxlayın.", "permission_key": "change_status", "permission_denied": true})
		return
	}
	if _, ok := updates["assigned_to"]; ok && !ep.Allowed("assign_tasks") {
		c.JSON(403, gin.H{"error": "Tapşırığı təhkim etmək üçün icazəniz yoxdur. Admin ilə əlaqə saxlayın.", "permission_key": "assign_tasks", "permission_denied": true})
		return
	}
	for k := range updates {
		if amountFieldKeys[k] && !ep.Allowed("edit_amounts") {
			c.JSON(403, gin.H{"error": "Maliyyə məlumatlarını dəyişmək üçün icazəniz yoxdur. Admin ilə əlaqə saxlayın.", "permission_key": "edit_amounts", "permission_denied": true})
			return
		}
	}

	// Avtomatik status keçidi: "Təhkim gözləyir" (və ya köhnə "new"/"pending")
	// statusunda olan tapşırığa vəkil təhkim edildikdə, sorğuda AYRICA status
	// göndərilməyibsə, status özü "Vəkil təhkim edildi"yə keçir. QEYD: əvvəllər
	// bu addım yox idi — vəkil təhkim edilsə belə tapşırıq "Təhkim gözləyir"
	// statusunda "asılı" qalırdı və menecer/müştəri interfeysində köhnə status
	// görünməyə davam edirdi (təhkimatın özü işləyirdi, sadəcə status "geridə
	// qalırdı" — bu, istifadəçilərin şikayət etdiyi "digər tərəfə çatmayan
	// dəyişiklik" kimi görünürdü).
	if newAssignedRaw, hasAssign := updates["assigned_to"]; hasAssign {
		_, hasStatus := updates["status"]
		assignedNow := newAssignedRaw != nil
		wasUnassigned := oldAssignee == nil
		awaitingAssignment := oldStatus == "" || oldStatus == "tehkim_gozleyir" || oldStatus == "new" || oldStatus == "pending"
		if assignedNow && wasUnassigned && !hasStatus && awaitingAssignment {
			updates["status"] = "tehkim_olundu"
		}
	}

	// Handle status change to completed
	if status, ok := updates["status"].(string); ok && status == "completed" {
		now := time.Now()
		updates["completed_at"] = now
	}

	db.Model(&task).Updates(updates)
	db.Preload("Contract").Preload("Assignee").First(&task, id)

	// Update lawyer case counts on status change
	newStatus := task.Status
	if oldStatus != newStatus {
		if newStatus == "completed" || newStatus == "cancelled" {
			if task.AssignedTo != nil {
				db.Model(&Lawyer{}).Where("id = ? AND active_cases > 0", *task.AssignedTo).
					UpdateColumn("active_cases", gorm.Expr("active_cases - 1"))
			}
			if newStatus == "completed" && task.AssignedTo != nil {
				db.Model(&Lawyer{}).Where("id = ?", *task.AssignedTo).
					UpdateColumn("completed_cases", gorm.Expr("completed_cases + 1"))
			}
		}
	}

	// Handle assignment: ilk dəfə təhkim (oldAssignee == nil) VƏ yenidən təhkim
	// (oldAssignee fərqli) — əvvəlki kod yalnız yenidən-təhkimi tuturdu, ona görə
	// "Vəkil təhkim et" pəncərəsindən ilk dəfə təhkim edilən tapşırıqlar
	// vəkilin active_cases sayğacına heç vaxt düşmürdü (əbədi 0 görünürdü).
	if task.AssignedTo != nil && (oldAssignee == nil || *task.AssignedTo != *oldAssignee) {
		if oldAssignee != nil {
			db.Model(&Lawyer{}).Where("id = ? AND active_cases > 0", *oldAssignee).
				UpdateColumn("active_cases", gorm.Expr("active_cases - 1"))
		}
		if newStatus != "completed" && newStatus != "cancelled" {
			db.Model(&Lawyer{}).Where("id = ?", *task.AssignedTo).
				UpdateColumn("active_cases", gorm.Expr("active_cases + 1"))
		}
	} else if task.AssignedTo == nil && oldAssignee != nil {
		// Təhkim ləğv edildi (assigned_to boşaldıldı)
		db.Model(&Lawyer{}).Where("id = ? AND active_cases > 0", *oldAssignee).
			UpdateColumn("active_cases", gorm.Expr("active_cases - 1"))
	}

	// === NOTIFICATIONS ===
	// Status changed → notify client + managers
	if oldStatus != newStatus {
		// Notify client
		if task.ClientID != nil {
			notifyClient(db, *task.ClientID, "task_status_changed", "Tapşırıq statusu dəyişdi",
				fmt.Sprintf("%s tapşırığının statusu yeniləndi", task.Title), "task", &task.ID)
		}
		// Notify managers
		notifyManagers(db, "task_status_changed", "Tapşırıq statusu dəyişdi",
			fmt.Sprintf("Status dəyişdi: %s (%s → %s)", task.Title, oldStatus, newStatus), "task", &task.ID)
		// Notify assigned lawyer
		if task.AssignedTo != nil {
			luID := getLawyerUserID(db, *task.AssignedTo)
			if luID > 0 {
				notifyLawyer(db, luID, "task_status_changed", "Tapşırıq statusu dəyişdi",
					fmt.Sprintf("Status dəyişdi: %s → %s", task.Title, newStatus), "task", &task.ID)
			}
		}
	}
	// New assignment → notify lawyer
	if task.AssignedTo != nil && (oldAssignee == nil || *task.AssignedTo != *oldAssignee) {
		luID := getLawyerUserID(db, *task.AssignedTo)
		if luID > 0 {
			notifyLawyer(db, luID, "task_assigned", "Tapşırıq təhkim edildi",
				fmt.Sprintf("Tapşırıq sizə təhkim edildi: %s", task.Title), "task", &task.ID)
		}
	}

	// === AVTOMATLAŞDIRMA (2026-09, istifadəçi tapşırığı: "tapşırıq statusu
	// X-ə dəyişəndə Y-ə bildiriş göndər") ===
	if oldStatus != newStatus {
		evaluateAutomationRules(db, "task_status_changed", automationEvent{
			vars: map[string]string{
				"task_title": task.Title, "task_number": task.TaskNumber,
				"from_status": oldStatus, "to_status": newStatus,
				"priority": task.Priority, "contract_title": contractTitleOf(task.Contract),
			},
			entityType: "task", entityID: &task.ID,
			assignedLawyerID: task.AssignedTo, clientID: task.ClientID,
		})
	}

	// === TARİXÇƏ (SANİYƏYƏ QƏDƏR DƏQİQ LOQ) ===
	// Bu endpoint-ə gələn HƏR hərəkət (status, təhkim, sənəd, digər sahə redaktəsi)
	// üçün Approval cədvəlində "logged" tipli qeyd yaradılır ki, Tarixçə tabında görünsün.
	{
		requestedBy := currentUserID(db, c)

		if oldStatus != newStatus {
			r := historyReason
			if r == "" {
				r = fmt.Sprintf("Status dəyişdirildi: %s → %s", oldStatus, newStatus)
			}
			logTaskHistory(db, task.ID, requestedBy, "status_change", r, oldStatus, newStatus, historyAttachments)
		}

		if task.AssignedTo != nil && (oldAssignee == nil || *task.AssignedTo != *oldAssignee) {
			var newLawyer Lawyer
			lawyerName := fmt.Sprintf("#%d", *task.AssignedTo)
			if db.Select("name").First(&newLawyer, *task.AssignedTo).Error == nil && newLawyer.Name != "" {
				lawyerName = newLawyer.Name
			}
			logTaskHistory(db, task.ID, requestedBy, "reassigned", "Vəkilə təhkim edildi: "+lawyerName, "", "", nil)
		} else if oldAssignee != nil && task.AssignedTo == nil {
			logTaskHistory(db, task.ID, requestedBy, "reassigned", "Vəkil təhkimatı ləğv edildi", "", "", nil)
		}

		if _, ok := updates["document_checklist"]; ok {
			var newDocs []interface{}
			json.Unmarshal(task.DocumentChecklist, &newDocs)
			added := len(newDocs) - oldChecklistLen
			if added > 0 {
				docReason := fmt.Sprintf("%d yeni sənəd əlavə edildi", added)
				if added == 1 && len(newDocs) > 0 {
					if lastDoc, ok := newDocs[len(newDocs)-1].(map[string]interface{}); ok {
						if nm, ok := lastDoc["name"].(string); ok && nm != "" {
							docReason = "Sənəd əlavə edildi: " + nm
						}
					}
				}
				logTaskHistory(db, task.ID, requestedBy, "document_added", docReason, "", "", nil)
			} else if added < 0 {
				logTaskHistory(db, task.ID, requestedBy, "document_removed", fmt.Sprintf("%d sənəd silindi", -added), "", "", nil)
			}
		}

		if len(otherChangedFields) > 0 {
			logTaskHistory(db, task.ID, requestedBy, "edited", describeFieldChanges(otherChangedFields), "", "", nil)
		}
	}

	if !ep.Allowed("view_amounts") {
		maskTaskAmounts(&task)
	}

	c.JSON(200, task)
}

func (h *Handler) DeleteTask(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "delete_tasks", "Tapşırığı silmək") {
		return
	}
	id := c.Param("id")

	// Decrement lawyer active_cases
	var task Task
	if err := db.First(&task, id).Error; err == nil {
		if restrictedID := getRestrictedContractID(db, c); !contractAccessAllowed(restrictedID, task.ContractID) {
			denyContractAccess(c)
			return
		}
		if task.AssignedTo != nil && task.Status != "completed" && task.Status != "cancelled" {
			db.Model(&Lawyer{}).Where("id = ? AND active_cases > 0", *task.AssignedTo).
				UpdateColumn("active_cases", gorm.Expr("active_cases - 1"))
		}
	}

	if err := db.Delete(&Task{}, id).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to delete"})
		return
	}
	c.JSON(200, gin.H{"success": true})
}

// ==================== TASK COMMENTS ====================

func (h *Handler) ListTaskComments(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "view_tasks", "Tapşırıqları görmək") {
		return
	}
	taskID := c.Query("task_id")

	if taskID == "" {
		c.JSON(400, gin.H{"error": "task_id required"})
		return
	}

	if restrictedID := getRestrictedContractID(db, c); restrictedID != nil {
		var task Task
		if err := db.Select("contract_id").First(&task, taskID).Error; err != nil || !contractAccessAllowed(restrictedID, task.ContractID) {
			denyContractAccess(c)
			return
		}
	}

	var comments []TaskComment
	db.Where("task_id = ?", taskID).Order("created_at ASC").Find(&comments)
	c.JSON(200, comments)
}

func (h *Handler) CreateTaskComment(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "edit_tasks", "Şərh əlavə etmək") {
		return
	}

	var comment TaskComment
	if err := c.ShouldBindJSON(&comment); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	if restrictedID := getRestrictedContractID(db, c); restrictedID != nil {
		var parentTask Task
		if err := db.Select("contract_id").First(&parentTask, comment.TaskID).Error; err != nil || !contractAccessAllowed(restrictedID, parentTask.ContractID) {
			denyContractAccess(c)
			return
		}
	}

	if err := db.Create(&comment).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to create comment"})
		return
	}

	// Create notification for task owner/assignee about new comment
	var task Task
	if err := db.First(&task, comment.TaskID).Error; err == nil {
		if task.AssignedTo != nil && uint(*task.AssignedTo) != comment.UserID {
			notification := Notification{
				UserID:     uint(*task.AssignedTo),
				UserType:   "lawyer",
				Type:       "task_note",
				Title:      "Yeni şərh",
				Message:    fmt.Sprintf("%s tapşırığına yeni şərh əlavə edildi", task.Title),
				EntityType: "task",
				EntityID:   &task.ID,
			}
			db.Create(&notification)
		}

		// Tarixçəyə qeyd et
		who := comment.UserName
		if who == "" {
			who = "İstifadəçi"
		}
		logTaskHistory(db, task.ID, comment.UserID, "comment_added", who+" şərh əlavə etdi", "", "", nil)
	}

	c.JSON(201, comment)
}

func (h *Handler) DeleteTaskComment(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "edit_tasks", "Şərhi silmək") {
		return
	}
	id := c.Param("id")

	if err := db.Delete(&TaskComment{}, id).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to delete"})
		return
	}
	c.JSON(200, gin.H{"success": true})
}

// ==================== APPROVALS ====================

func (h *Handler) ListApprovals(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "view_tasks", "Təsdiqləri görmək") {
		return
	}
	status := c.Query("status")
	entityType := c.Query("entity_type")

	query := db.Model(&Approval{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if entityType != "" {
		query = query.Where("entity_type = ?", entityType)
	}

	// Sahiblik məhdudiyyəti: "client"/"lawyer" yalnız öz tapşırıqlarına aid
	// təsdiq qeydlərini görsün — bütün firmanın təsdiq tarixçəsini yox.
	switch currentUserRole(c) {
	case "client":
		ids, ok := scopedClientIDs(db, c)
		if !ok {
			ids = []uint{0}
		}
		var taskIDs []uint
		db.Model(&Task{}).Where("client_id IN ?", ids).Pluck("id", &taskIDs)
		query = query.Where("(task_id IN ? OR (entity_type = ? AND entity_id IN ?))", taskIDs, "client", ids)
	case "lawyer":
		if lawyerIDVal, ok := c.Get("lawyerID"); ok {
			taskIDs := lawyerTaskIDs(db, lawyerIDVal.(int))
			query = query.Where("task_id IN ?", taskIDs)
		}
	}

	var approvals []Approval
	query.Order("created_at DESC").Find(&approvals)

	// Enrich with names
	type ApprovalResponse struct {
		Approval
		TaskTitle     string `json:"task_title,omitempty"`
		ClientName    string `json:"client_name,omitempty"`
		RequesterName string `json:"requester_name,omitempty"`
	}
	var response []ApprovalResponse
	for _, a := range approvals {
		ar := ApprovalResponse{Approval: a}
		// Get requester name
		var user User
		if err := db.First(&user, a.RequestedBy).Error; err == nil {
			ar.RequesterName = user.Name
		}
		// Get entity name
		switch a.EntityType {
		case "task":
			var task Task
			if err := db.First(&task, a.EntityID).Error; err == nil {
				ar.TaskTitle = task.Title
			}
		case "client":
			var client Client
			if err := db.First(&client, a.EntityID).Error; err == nil {
				ar.ClientName = client.Name
			}
		}
		response = append(response, ar)
	}
	if response == nil {
		response = []ApprovalResponse{}
	}

	c.JSON(200, response)
}

func (h *Handler) GetApproval(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "view_tasks", "Təsdiqi görmək") {
		return
	}
	id := c.Param("id")

	var approval Approval
	if err := db.First(&approval, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Approval not found"})
		return
	}

	// TƏHLÜKƏSİZLİK (2026-09): ListApprovals siyahı endpoint-i artıq
	// "client"/"lawyer" üçün sahiblik məhdudiyyəti tətbiq edir (yalnız öz
	// tapşırıqlarına aid qeydlər), AMMA bu tək-qeyd endpoint-i (GET
	// /approvals/:id) heç bir belə yoxlama etmirdi — istənilən autentifikasiya
	// olunmuş vəkil/müştəri, ID-ni sadəcə dəyişməklə (IDOR) BAŞQA bir
	// müştərinin/vəkilin tapşırığına aid təsdiq qeydini (səbəb, əlavə
	// sənədlər, tələb edən şəxsin adı) görə bilərdi. ListApprovals ilə eyni
	// qayda burada da tətbiq olunur.
	switch currentUserRole(c) {
	case "client":
		ids, ok := scopedClientIDs(db, c)
		if !ok {
			ids = []uint{0}
		}
		inScope := false
		if approval.EntityType == "client" {
			for _, id := range ids {
				if id == approval.EntityID {
					inScope = true
					break
				}
			}
		} else if approval.TaskID != nil {
			var taskClientID *uint
			if err := db.Model(&Task{}).Where("id = ?", *approval.TaskID).Pluck("client_id", &taskClientID).Error; err == nil && taskClientID != nil {
				for _, id := range ids {
					if id == *taskClientID {
						inScope = true
						break
					}
				}
			}
		}
		if !inScope {
			c.JSON(404, gin.H{"error": "Approval not found"})
			return
		}
	case "lawyer":
		if lawyerIDVal, ok := c.Get("lawyerID"); ok {
			taskIDs := lawyerTaskIDs(db, lawyerIDVal.(int))
			inScope := false
			if approval.TaskID != nil {
				for _, tid := range taskIDs {
					if tid == *approval.TaskID {
						inScope = true
						break
					}
				}
			}
			if !inScope {
				c.JSON(404, gin.H{"error": "Approval not found"})
				return
			}
		}
	}

	c.JSON(200, approval)
}

func (h *Handler) CreateApproval(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "edit_tasks", "Təsdiq sorğusu göndərmək") {
		return
	}

	var approval Approval
	if err := c.ShouldBindJSON(&approval); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	approval.RequestedAt = time.Now()
	approval.Status = "pending"

	if err := db.Create(&approval).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to create approval"})
		return
	}

	// Notify managers about new approval request
	var managers []User
	db.Where("role = ? AND is_active = ?", "manager", true).Find(&managers)
	for _, m := range managers {
		notification := Notification{
			UserID:     uint(m.ID),
			UserType:   "manager",
			Type:       "approval_required",
			Title:      "Yeni təsdiq sorğusu",
			Message:    "Yeni təsdiq sorğusu gözləyir",
			EntityType: "approval",
			EntityID:   &approval.ID,
		}
		db.Create(&notification)
	}

	c.JSON(201, approval)
}

func (h *Handler) ProcessApproval(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "change_status", "Təsdiq qərarı vermək") {
		return
	}
	id := c.Param("id")

	var approval Approval
	if err := db.First(&approval, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Approval not found"})
		return
	}

	// TƏHLÜKƏSİZLİK (2026-09): GetApproval ilə eyni səbəbdən — bir vəkilin
	// başqa bir vəkilə aid tapşırığın təsdiq qərarını (ID-ni dəyişməklə)
	// dəyişməsinin qarşısı alınır. Menecer üçün məhdudiyyət yoxdur.
	if currentUserRole(c) == "lawyer" {
		if lawyerIDVal, ok := c.Get("lawyerID"); ok {
			taskIDs := lawyerTaskIDs(db, lawyerIDVal.(int))
			inScope := false
			if approval.TaskID != nil {
				for _, tid := range taskIDs {
					if tid == *approval.TaskID {
						inScope = true
						break
					}
				}
			}
			if !inScope {
				c.JSON(404, gin.H{"error": "Approval not found"})
				return
			}
		}
	}

	var input struct {
		Status     string `json:"status"`
		Decision   string `json:"decision"`
		ApproverID *uint  `json:"approver_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	now := time.Now()
	approval.Status = input.Status
	approval.Decision = input.Decision
	approval.DecidedAt = &now
	if input.ApproverID != nil {
		approval.ApproverID = input.ApproverID
	}

	db.Save(&approval)

	// === COMPREHENSIVE NOTIFICATIONS ===
	statusWord := "təsdiq"
	if input.Status == "rejected" {
		statusWord = "rədd"
	}

	// Notify the requester (lawyer) about the decision
	notify(db, approval.RequestedBy, "lawyer", "approval_processed",
		"Sorğu "+statusWord+" edildi",
		fmt.Sprintf("Sizin tapşırıq sorğunuz %s edildi", statusWord),
		"approval", &approval.ID)

	// If status_change approval → notify client
	if approval.ApprovalType == "status_change" && approval.TaskID != nil {
		var task Task
		if err := db.First(&task, *approval.TaskID).Error; err == nil {
			// Notify client about task status change
			if task.ClientID != nil && input.Status == "approved" {
				notifyClient(db, *task.ClientID, "task_status_changed",
					"Tapşırıq statusu dəyişdi",
					fmt.Sprintf("'%s' tapşırığının statusu dəyişdirildi", task.Title),
					"task", approval.TaskID)
			}
		}
	}

	// If new_task approval → notify assigned lawyer
	if (approval.ApprovalType == "new_task" || approval.ApprovalType == "") && input.Status == "approved" {
		if approval.EntityType == "task" {
			var task Task
			if err := db.First(&task, approval.EntityID).Error; err == nil && task.AssignedTo != nil {
				luID := getLawyerUserID(db, *task.AssignedTo)
				if luID > 0 {
					notifyLawyer(db, luID, "task_assigned", "Tapşırıq təhkim edildi",
						fmt.Sprintf("Tapşırıq sizə təhkim edildi: %s", task.Title),
						"task", &task.ID)
				}
			}
		}
	}

	// === AVTOMATLAŞDIRMA (2026-09, istifadəçi tapşırığı) ===
	// "assigned_lawyer"/"client" alıcıları üçün bağlı tapşırığın (varsa)
	// AssignedTo/ClientID sahələrini ayrıca yükləyirik — yuxarıdakı bloklar
	// bunu yalnız MÜƏYYƏN şərtlərdə (approval_type/status) edir, avtomatlaşdırma
	// isə HƏR qərar üçün işə düşməlidir.
	var autoAssignedLawyer, autoClientID *uint
	if approval.TaskID != nil {
		var t Task
		if db.Select("assigned_to, client_id").First(&t, *approval.TaskID).Error == nil {
			autoAssignedLawyer = t.AssignedTo
			autoClientID = t.ClientID
		}
	}
	evaluateAutomationRules(db, "approval_decided", automationEvent{
		vars: map[string]string{
			"decision": input.Status, "entity_type": approval.EntityType,
		},
		entityType: "approval", entityID: &approval.ID,
		assignedLawyerID: autoAssignedLawyer, clientID: autoClientID,
	})

	c.JSON(200, approval)
}

// ==================== MESSAGES ====================

func (h *Handler) ListMessages(c *gin.Context) {
	db, _ := h.tenantDB(c)
	taskID := c.Query("task_id")
	contractID := c.Query("contract_id")
	userRole := c.Query("user_role") // manager, lawyer, client
	userIDStr := c.Query("user_id")

	// TƏHLÜKƏSİZLİK: rol və ID sorğu parametrindən yox, token-dən götürülür
	// (bax JWTAuthMiddleware, c.Set("userRole"/...)).
	if roleVal, ok := c.Get("userRole"); ok {
		if r, ok2 := roleVal.(string); ok2 && r != "" {
			userRole = r
		}
		if lawyerIDVal, ok2 := c.Get("lawyerID"); ok2 {
			if lid, ok3 := lawyerIDVal.(int); ok3 && lid > 0 {
				userIDStr = strconv.Itoa(lid)
			}
		}
		if clientIDVal, ok2 := c.Get("clientID"); ok2 {
			if cid, ok3 := clientIDVal.(int); ok3 && cid > 0 {
				userIDStr = strconv.Itoa(cid)
			}
		}
	}

	query := db.Model(&Message{})
	order := "created_at ASC"

	if taskID != "" {
		query = query.Where("task_id = ?", taskID)

		// Channel filtering based on role
		switch userRole {
		case "client":
			// Client sees: "all" + "manager_client"
			query = query.Where("channel IN ?", []string{"all", "manager_client"})
			// Sahiblik yoxlaması: bu task_id HƏQİQƏTƏN bu müştəriyə aiddirmi?
			// (əks halda ID-ni dəyişməklə başqa müştərinin yazışmasını oxumaq olardı)
			if ids, ok := scopedClientIDs(db, c); ok {
				var cnt int64
				db.Model(&Task{}).Where("id = ? AND client_id IN ?", taskID, ids).Count(&cnt)
				if cnt == 0 {
					query = query.Where("1 = 0")
				}
			}
		case "lawyer":
			// Lawyer sees: "all" + "manager_lawyer"
			query = query.Where("channel IN ?", []string{"all", "manager_lawyer"})
			if lawyerIDVal, ok := c.Get("lawyerID"); ok {
				var cnt int64
				db.Model(&Task{}).Where("id = ? AND assigned_to = ?", taskID, lawyerIDVal).Count(&cnt)
				if cnt == 0 {
					query = query.Where("1 = 0")
				}
			}
		case "manager":
			// Manager sees all channels
		default:
			query = query.Where("channel = ?", "all")
		}
	} else if contractID != "" {
		query = query.Where("contract_id = ?", contractID)

		// Eyni kanal + sahiblik qaydaları contract-based yazışma üçün də
		// tətbiq olunur (əvvəllər burada HEÇ bir rol/sahiblik yoxlaması yox
		// idi — contract_id verən istənilən istifadəçi bütün kanalları görürdü).
		switch userRole {
		case "client":
			query = query.Where("channel IN ?", []string{"all", "manager_client"})
			if ids, ok := scopedClientIDs(db, c); ok {
				var cnt int64
				db.Model(&Contract{}).Where("id = ? AND client_id IN ?", contractID, ids).Count(&cnt)
				if cnt == 0 {
					query = query.Where("1 = 0")
				}
			}
		case "lawyer":
			query = query.Where("channel IN ?", []string{"all", "manager_lawyer"})
			if lawyerIDVal, ok := c.Get("lawyerID"); ok {
				if lid, ok2 := lawyerIDVal.(int); ok2 {
					allowedContractIDs := lawyerContractIDs(db, lid)
					found := false
					for _, cid := range allowedContractIDs {
						if strconv.FormatUint(uint64(cid), 10) == contractID {
							found = true
							break
						}
					}
					if !found {
						query = query.Where("1 = 0")
					}
				}
			}
		case "manager":
			// Manager sees all channels
		default:
			query = query.Where("channel = ?", "all")
		}
	} else {
		// Heç bir task_id/contract_id verilməyib — bu, "son çatlar" siyahısı
		// üçün sorğudur (ChatFab). Rol üzrə şəxsi kanal təcridi BURADA DA tətbiq
		// olunmalıdır, əks halda başqa tərəflərin məxfi (manager_client /
		// manager_lawyer) mesajları sızır. Menecerdən başqa hər kəs həmçinin
		// yalnız ÖZ tapşırıqlarına aid mesajları görməlidir — əks halda bütün
		// firmanın mesaj tarixçəsi network cavabında görünərdi.
		switch userRole {
		case "client":
			query = query.Where("channel IN ?", []string{"all", "manager_client"})
		case "lawyer":
			query = query.Where("channel IN ?", []string{"all", "manager_lawyer"})
		case "manager":
			// Menecer bütün mesajlara baxa bilər
		default:
			query = query.Where("channel = ?", "all")
		}

		if uidNum, convErr := strconv.Atoi(userIDStr); convErr == nil && uidNum > 0 {
			if userRole == "lawyer" {
				var taskIDs []uint
				db.Model(&Task{}).Where("assigned_to = ?", uidNum).Pluck("id", &taskIDs)
				query = query.Where("task_id IN ?", taskIDs)
			} else if userRole == "client" {
				var taskIDs []uint
				db.Model(&Task{}).Where("client_id = ?", uidNum).Pluck("id", &taskIDs)
				query = query.Where("task_id IN ?", taskIDs)
			}
		}
		order = "created_at DESC"
	}

	var messages []Message
	query.Order(order).Limit(200).Find(&messages)
	c.JSON(200, messages)
}

func (h *Handler) CreateMessage(c *gin.Context) {
	db, _ := h.tenantDB(c)

	var input struct {
		TaskID      *uint          `json:"task_id"`
		ContractID  *uint          `json:"contract_id"`
		Channel     string         `json:"channel"`
		SenderID    uint           `json:"sender_id"`
		SenderType  string         `json:"sender_type"`
		SenderName  string         `json:"sender_name"`
		Content     string         `json:"content"`
		Attachments datatypes.JSON `json:"attachments"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// TƏHLÜKƏSİZLİK: göndərənin kimliyi və adı sorğu body-sindən yox, token-dən
	// (və ona bağlı DB qeydindən) təyin olunur — başqasının adından mesaj yazmaq
	// və ya özünə aid olmayan məxfi kanala qoşulmaq mümkün deyil.
	if roleVal, ok := c.Get("userRole"); ok {
		if r, ok2 := roleVal.(string); ok2 && r != "" {
			input.SenderType = r
			switch r {
			case "lawyer":
				if lawyerIDVal, ok3 := c.Get("lawyerID"); ok3 {
					if lid, ok4 := lawyerIDVal.(int); ok4 && lid > 0 {
						input.SenderID = uint(lid)
						var lw Lawyer
						if err := db.Select("name").First(&lw, lid).Error; err == nil && lw.Name != "" {
							input.SenderName = lw.Name
						}
					}
				}
			case "client":
				if clientIDVal, ok3 := c.Get("clientID"); ok3 {
					if cid, ok4 := clientIDVal.(int); ok4 && cid > 0 {
						input.SenderID = uint(cid)
						var cl Client
						if err := db.Select("name").First(&cl, cid).Error; err == nil && cl.Name != "" {
							input.SenderName = cl.Name
						}
					}
				}
			case "manager":
				if userIDVal, ok3 := c.Get("userID"); ok3 {
					if uid, ok4 := userIDVal.(int); ok4 && uid > 0 {
						input.SenderID = uint(uid)
						var u User
						if err := db.Select("name").First(&u, uid).Error; err == nil && u.Name != "" {
							input.SenderName = u.Name
						}
					}
				}
			}
		}
	}

	// TƏHLÜKƏSİZLİK (2026-09): kanal-yazma icazəsi — ListMessages-də oxuma
	// tərəfinə tətbiq olunan eyni məhdudiyyət: müştəri "manager_lawyer" kanalına,
	// vəkil isə "manager_client" kanalına yaza bilməz (SenderType artıq yuxarıda
	// token-dən təyin olunduğu üçün bu yoxlama etibarlıdır).
	if input.SenderType == "client" && input.Channel == "manager_lawyer" {
		c.JSON(403, gin.H{"error": "Bu kanala mesaj yazmaq icazəniz yoxdur"})
		return
	}
	if input.SenderType == "lawyer" && input.Channel == "manager_client" {
		c.JSON(403, gin.H{"error": "Bu kanala mesaj yazmaq icazəniz yoxdur"})
		return
	}

	// TƏHLÜKƏSİZLİK: vəkil/müştəri yalnız özünə aid tapşırıq/müqavilə çatına
	// mesaj yaza bilər.
	switch input.SenderType {
	case "client":
		if ids, ok := scopedClientIDs(db, c); ok {
			if input.TaskID != nil {
				var cnt int64
				db.Model(&Task{}).Where("id = ? AND client_id IN ?", *input.TaskID, ids).Count(&cnt)
				if cnt == 0 {
					c.JSON(403, gin.H{"error": "Bu tapşırığa mesaj yazmaq icazəniz yoxdur"})
					return
				}
			}
			if input.ContractID != nil {
				var cnt int64
				db.Model(&Contract{}).Where("id = ? AND client_id IN ?", *input.ContractID, ids).Count(&cnt)
				if cnt == 0 {
					c.JSON(403, gin.H{"error": "Bu müqaviləyə mesaj yazmaq icazəniz yoxdur"})
					return
				}
			}
		}
	case "lawyer":
		if lawyerIDVal, ok3 := c.Get("lawyerID"); ok3 {
			if lid, ok4 := lawyerIDVal.(int); ok4 && lid > 0 {
				if input.TaskID != nil {
					var cnt int64
					db.Model(&Task{}).Where("id = ? AND assigned_to = ?", *input.TaskID, lid).Count(&cnt)
					if cnt == 0 {
						c.JSON(403, gin.H{"error": "Bu tapşırığa mesaj yazmaq icazəniz yoxdur"})
						return
					}
				}
				if input.ContractID != nil {
					allowed := false
					for _, cid := range lawyerContractIDs(db, lid) {
						if cid == *input.ContractID {
							allowed = true
							break
						}
					}
					if !allowed {
						c.JSON(403, gin.H{"error": "Bu müqaviləyə mesaj yazmaq icazəniz yoxdur"})
						return
					}
				}
			}
		}
	}

	if input.Channel == "" {
		input.Channel = "all"
	}

	message := Message{
		TaskID:      input.TaskID,
		ContractID:  input.ContractID,
		Channel:     input.Channel,
		SenderID:    input.SenderID,
		SenderType:  input.SenderType,
		SenderName:  input.SenderName,
		Content:     input.Content,
		Attachments: input.Attachments,
	}

	if err := db.Create(&message).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to create message"})
		return
	}

	// Notifications based on channel
	if input.TaskID != nil {
		var task Task
		if err := db.First(&task, *input.TaskID).Error; err == nil {
			switch input.Channel {
			case "all":
				// Notify all parties except sender
				notifyManagers(db, "chat_message", "Yeni mesaj",
					fmt.Sprintf("%s tapşırıq chatında mesaj yazdı", input.SenderName), "task", input.TaskID)
				if task.AssignedTo != nil {
					luID := getLawyerUserID(db, *task.AssignedTo)
					if luID > 0 && luID != input.SenderID {
						notifyLawyer(db, luID, "chat_message", "Yeni mesaj",
							fmt.Sprintf("%s tapşırıq chatında mesaj yazdı", input.SenderName), "task", input.TaskID)
					}
				}
				if task.ClientID != nil && input.SenderType != "client" {
					notifyClient(db, *task.ClientID, "chat_message", "Yeni mesaj",
						fmt.Sprintf("%s tapşırıq chatında mesaj yazdı", input.SenderName), "task", input.TaskID)
				}
			case "manager_client":
				// Only manager and client
				if input.SenderType == "client" {
					notifyManagers(db, "chat_message", "Yeni şəxsi mesaj",
						fmt.Sprintf("%s sizə şəxsi mesaj göndərdi", input.SenderName), "task", input.TaskID)
				} else if task.ClientID != nil {
					notifyClient(db, *task.ClientID, "chat_message", "Yeni şəxsi mesaj",
						fmt.Sprintf("%s sizə şəxsi mesaj göndərdi", input.SenderName), "task", input.TaskID)
				}
			case "manager_lawyer":
				// Only manager and lawyer
				if input.SenderType == "lawyer" {
					notifyManagers(db, "chat_message", "Yeni şəxsi mesaj",
						fmt.Sprintf("%s sizə şəxsi mesaj göndərdi", input.SenderName), "task", input.TaskID)
				} else if task.AssignedTo != nil {
					luID := getLawyerUserID(db, *task.AssignedTo)
					if luID > 0 {
						notifyLawyer(db, luID, "chat_message", "Yeni şəxsi mesaj",
							fmt.Sprintf("%s sizə şəxsi mesaj göndərdi", input.SenderName), "task", input.TaskID)
					}
				}
			}
		}
	}

	c.JSON(201, message)
}

func (h *Handler) MarkMessagesRead(c *gin.Context) {
	db, _ := h.tenantDB(c)

	var input struct {
		IDs []uint `json:"ids"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	query := db.Model(&Message{}).Where("id IN ?", input.IDs)

	// TƏHLÜKƏSİZLİK: oxundu işarəsi yalnız istifadəçinin öz kanallarına qoyulur
	// (ListMessages/CreateMessage-dəki eyni kanal+sahiblik modeli).
	if roleVal, ok := c.Get("userRole"); ok {
		if r, ok2 := roleVal.(string); ok2 && r != "" {
			switch r {
			case "client":
				query = query.Where("channel IN ?", []string{"all", "manager_client"})
				if ids, ok3 := scopedClientIDs(db, c); ok3 {
					var taskIDs []uint
					db.Model(&Task{}).Where("client_id IN ?", ids).Pluck("id", &taskIDs)
					var contractIDs []uint
					db.Model(&Contract{}).Where("client_id IN ?", ids).Pluck("id", &contractIDs)
					query = query.Where("(task_id IN ? OR contract_id IN ?)", taskIDs, contractIDs)
				}
			case "lawyer":
				query = query.Where("channel IN ?", []string{"all", "manager_lawyer"})
				if lawyerIDVal, ok3 := c.Get("lawyerID"); ok3 {
					if lid, ok4 := lawyerIDVal.(int); ok4 && lid > 0 {
						taskIDs := lawyerTaskIDs(db, lid)
						contractIDs := lawyerContractIDs(db, lid)
						query = query.Where("(task_id IN ? OR contract_id IN ?)", taskIDs, contractIDs)
					}
				}
			case "manager":
				// Menecer bütün mesajları oxunmuş kimi işarələyə bilər
			}
		}
	}

	now := time.Now()
	query.Updates(map[string]interface{}{
		"is_read": true,
		"read_at": now,
	})
	c.JSON(200, gin.H{"success": true})
}

// ==================== NOTIFICATIONS ====================

func (h *Handler) ListNotifications(c *gin.Context) {
	db, _ := h.tenantDB(c)
	userID := c.Query("user_id")
	userType := c.Query("user_type")
	unreadOnly := c.Query("unread_only")

	// TƏHLÜKƏSİZLİK (2026-09): ListMessages ilə eyni səbəbdən — bu endpoint
	// əvvəllər user_id/user_type-ı HƏMİŞƏ sorğu parametrindən götürürdü, yəni
	// istənilən autentifikasiya olunmuş istifadəçi "&user_id=<başqasının ID-si>"
	// ötürməklə HƏR HANSI başqa istifadəçinin (menecer, vəkil, müştəri) bütün
	// bildirişlərini (məzmunu daxil olmaqla) oxuya bilərdi. JWT konteksti
	// mövcuddursa (sf/* marşrutu, rol-əsaslı giriş), user_id/user_type ORADAN
	// (token-dən) götürülür; JWT konteksti yoxdursa (menecer admin paneli),
	// köhnə sorğu-parametri davranışı saxlanılır.
	if roleVal, ok := c.Get("userRole"); ok {
		if r, ok2 := roleVal.(string); ok2 && r != "" {
			userType = r
		}
		if uidVal, ok2 := c.Get("userID"); ok2 {
			if uid, ok3 := uidVal.(int); ok3 && uid > 0 {
				userID = strconv.Itoa(uid)
			}
		}
	}

	query := db.Model(&Notification{})
	if userID != "" {
		query = query.Where("user_id = ?", userID)
	}
	if userType != "" {
		query = query.Where("user_type = ?", userType)
	}
	if unreadOnly == "true" {
		query = query.Where("is_read = ?", false)
	}

	var notifications []Notification
	query.Order("created_at DESC").Limit(50).Find(&notifications)
	c.JSON(200, notifications)
}

func (h *Handler) MarkNotificationsRead(c *gin.Context) {
	db, _ := h.tenantDB(c)

	var input struct {
		IDs []uint `json:"ids"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	query := db.Model(&Notification{}).Where("id IN ?", input.IDs)

	// TƏHLÜKƏSİZLİK (2026-09): JWT konteksti mövcuddursa, yalnız ÖZ
	// bildirişlərini "oxunmuş" kimi işarələməyə icazə verilir — əks halda
	// başqa istifadəçinin bildiriş ID-lərini ötürməklə onları (səbəbsiz yerə)
	// "oxunmuş" etmək mümkün olardı.
	if roleVal, ok := c.Get("userRole"); ok {
		if r, ok2 := roleVal.(string); ok2 && r != "" {
			if uidVal, ok3 := c.Get("userID"); ok3 {
				if uid, ok4 := uidVal.(int); ok4 && uid > 0 {
					query = query.Where("user_id = ? AND user_type = ?", uid, r)
				}
			}
		}
	}

	now := time.Now()
	query.Updates(map[string]interface{}{
		"is_read": true,
		"read_at": now,
	})
	c.JSON(200, gin.H{"success": true})
}

// ==================== TASK TYPES ====================

func (h *Handler) ListTaskTypes(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}

	// Ensure table exists (handles cases where migration wasn't applied on initial setup)
	if migrateErr := db.AutoMigrate(&TaskType{}); migrateErr != nil {
		c.JSON(500, gin.H{"error": "Migration error: " + migrateErr.Error()})
		return
	}

	var taskTypes []TaskType
	db.Order("sort_order ASC, name ASC").Find(&taskTypes)
	if taskTypes == nil {
		taskTypes = []TaskType{}
	}
	c.JSON(200, taskTypes)
}

func (h *Handler) GetTaskType(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}
	id := c.Param("id")

	var taskType TaskType
	if err := db.First(&taskType, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Task type not found"})
		return
	}
	c.JSON(200, taskType)
}

func (h *Handler) CreateTaskType(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}
	if !requirePermission(c, db, "manage_library", "İş növü yaratmaq") {
		return
	}

	// Ensure table exists before creating
	if migrateErr := db.AutoMigrate(&TaskType{}); migrateErr != nil {
		c.JSON(500, gin.H{"error": "Migration error: " + migrateErr.Error()})
		return
	}

	var taskType TaskType
	if err := c.ShouldBindJSON(&taskType); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	if err := db.Create(&taskType).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to create task type: " + err.Error()})
		return
	}

	c.JSON(201, taskType)
}

func (h *Handler) UpdateTaskType(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "manage_library", "İş növünü redaktə etmək") {
		return
	}
	id := c.Param("id")

	var taskType TaskType
	if err := db.First(&taskType, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Task type not found"})
		return
	}

	var input TaskType
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	taskType.Name = input.Name
	taskType.Description = input.Description
	taskType.RequiredDocuments = input.RequiredDocuments
	taskType.SortOrder = input.SortOrder
	if input.IsActive {
		taskType.IsActive = input.IsActive
	}
	if input.SortOrder > 0 {
		taskType.SortOrder = input.SortOrder
	}

	db.Save(&taskType)
	c.JSON(200, taskType)
}

func (h *Handler) DeleteTaskType(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "manage_library", "İş növünü silmək") {
		return
	}
	id := c.Param("id")

	// Bu iş növünə istinad edən müqavilə/tapşırıqlar varsa, FK constraint
	// (contracts.task_type_id / tasks.task_type_id -> law_task_types.id)
	// silinməyə mane olur — məlumatları itirmədən sadəcə istinadı ayırırıq
	// (klient/vəkil silmə düzəlişi ilə eyni səbəbdən, bax: DeleteClient).
	txErr := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&Contract{}).Where("task_type_id = ?", id).Update("task_type_id", nil).Error; err != nil {
			return err
		}
		if err := tx.Model(&Task{}).Where("task_type_id = ?", id).Update("task_type_id", nil).Error; err != nil {
			return err
		}
		return tx.Delete(&TaskType{}, id).Error
	})
	if txErr != nil {
		c.JSON(500, gin.H{"error": "İş növü silinmədi: " + txErr.Error()})
		return
	}
	c.JSON(200, gin.H{"success": true})
}
// ==================== ARCHIVE ====================

// Archive/Unarchive Task
func (h *Handler) ArchiveTask(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "edit_tasks", "Tapşırığı arxivləşdirmək") {
		return
	}
	id := c.Param("id")
	var input struct {
		IsArchived bool `json:"is_archived"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	now := time.Now()
	updates := map[string]interface{}{"is_archived": input.IsArchived}
	if input.IsArchived {
		updates["archived_at"] = now
	} else {
		updates["archived_at"] = nil
	}
	db.Model(&Task{}).Where("id = ?", id).Updates(updates)

	if taskIDNum, err := strconv.ParseUint(id, 10, 64); err == nil {
		reason := "Arxivə köçürüldü"
		if !input.IsArchived {
			reason = "Arxivdən çıxarıldı"
		}
		logTaskHistory(db, uint(taskIDNum), currentUserID(db, c), "archived", reason, "", "", nil)
	}

	c.JSON(200, gin.H{"success": true})
}

// Archive/Unarchive Contract
func (h *Handler) ArchiveContract(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "edit_contracts", "Müqaviləni arxivləşdirmək") {
		return
	}
	id := c.Param("id")
	var input struct {
		IsArchived bool `json:"is_archived"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	now := time.Now()
	updates := map[string]interface{}{"is_archived": input.IsArchived}
	if input.IsArchived {
		updates["archived_at"] = now
	} else {
		updates["archived_at"] = nil
	}
	db.Model(&Contract{}).Where("id = ?", id).Updates(updates)
	c.JSON(200, gin.H{"success": true})
}

// Archive/Unarchive Client (+ cascade to contracts and tasks)
func (h *Handler) ArchiveClient(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "edit_clients", "Müştərini arxivləşdirmək") {
		return
	}
	id := c.Param("id")
	var input struct {
		IsArchived bool `json:"is_archived"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	now := time.Now()
	updates := map[string]interface{}{"is_archived": input.IsArchived}
	if input.IsArchived {
		updates["archived_at"] = now
	} else {
		updates["archived_at"] = nil
	}

	// Bu funksiya klient ID-lərin siyahısı üzərində (özü + Hüquqi şəxsdirsə bağlı
	// Fərdi hesablar) müqavilə/tapşırıq kaskadını tətbiq edir.
	cascadeForClientIDs := func(ids []uint) int {
		if len(ids) == 0 {
			return 0
		}
		db.Model(&Client{}).Where("id IN ?", ids).Updates(updates)
		db.Model(&Contract{}).Where("client_id IN ?", ids).Updates(updates)
		var cids []uint
		db.Model(&Contract{}).Where("client_id IN ?", ids).Pluck("id", &cids)
		if len(cids) > 0 {
			db.Model(&Task{}).Where("contract_id IN ?", cids).Updates(updates)
		}
		db.Model(&Task{}).Where("client_id IN ?", ids).Updates(updates)
		return len(cids)
	}

	// Hüquqi şəxsdirsə, ona bağlı bütün Fərdi hesabları da tap ki, birgə deaktiv/bərpa olsun
	var client Client
	db.First(&client, id)
	targetIDs := []uint{client.ID}
	var linkedChildIDs []uint
	if isLegalClientType(client.Type) {
		db.Model(&Client{}).Where("parent_client_id = ?", client.ID).Pluck("id", &linkedChildIDs)
		targetIDs = append(targetIDs, linkedChildIDs...)
	}

	contractCount := cascadeForClientIDs(targetIDs)

	action := "arxivləşdirildi"
	if !input.IsArchived {
		action = "bərpa edildi"
	}

	db.First(&client, id)

	// Notify managers
	msg := fmt.Sprintf("%s müştərisi %s", client.Name, action)
	if len(linkedChildIDs) > 0 {
		msg += fmt.Sprintf(" (bağlı %d fərdi hesabla birgə)", len(linkedChildIDs))
	}
	notifyManagers(db, "client_archived", "Müştəri "+action, msg, "client", &client.ID)

	c.JSON(200, gin.H{"success": true, "cascaded_contracts": contractCount, "cascaded_linked_clients": len(linkedChildIDs)})
}

// Get all archived items
// GetArchivedItems - GET /archived — role-a görə əhatə dairəsi məhdudlaşdırılır:
// menecer bütün firmanın arxivini görür; vəkil YALNIZ öz təhkim olunduğu
// arxivləşmiş tapşırıqları; müştəri YALNIZ öz arxivləşmiş müqavilə/tapşırıqlarını.
func (h *Handler) GetArchivedItems(c *gin.Context) {
	db, _ := h.tenantDB(c)

	roleVal, _ := c.Get("userRole")
	role, _ := roleVal.(string)

	var clients []Client
	var contracts []Contract
	var tasks []Task

	switch role {
	case "lawyer":
		lawyerIDVal, exists := c.Get("lawyerID")
		lawyerID, _ := lawyerIDVal.(int)
		if exists && lawyerID > 0 {
			db.Where("is_archived = ? AND assigned_to = ?", true, lawyerID).Preload("Contract").Preload("Assignee").Find(&tasks)
		}
	case "client":
		clientIDVal, exists := c.Get("clientID")
		clientID, _ := clientIDVal.(int)
		if exists && clientID > 0 {
			db.Where("is_archived = ? AND client_id = ?", true, clientID).Preload("Contract").Preload("Assignee").Find(&tasks)
			db.Where("is_archived = ? AND client_id = ?", true, clientID).Preload("Client").Find(&contracts)
		}
	default: // manager / digər tam-icazəli rollar
		if !requirePermission(c, db, "view_clients", "Arxivi görmək") {
			return
		}
		db.Where("is_archived = ?", true).Find(&clients)
		db.Where("is_archived = ?", true).Preload("Client").Find(&contracts)
		db.Where("is_archived = ?", true).Preload("Contract").Preload("Assignee").Find(&tasks)
	}

	c.JSON(200, gin.H{
		"clients":   clients,
		"contracts": contracts,
		"tasks":     tasks,
	})
}

// ==================== HÜQUQİ ŞƏXS — BAĞLI FƏRDİ HESABLAR ====================
// Hüquqi şəxs tipli müştəri özünə bağlı Fərdi hesabları görə, yenisini yarada
// və onlara menecerin "Rolların idarəedilməsi" mərkəzindəkinin eyni formasında
// fərdi icazələr (permission_overrides) təyin edə bilir — YALNIZ öz bağlı
// hesabları üzərində, sistemdəki digər müştərilərə əsla təsir etmədən.

// currentClientRecord — JWT-dəki clientID-yə uyğun Client sətrini gətirir.
func currentClientRecord(db *gorm.DB, c *gin.Context) (*Client, bool) {
	clientIDVal, exists := c.Get("clientID")
	if !exists {
		return nil, false
	}
	clientID, ok := clientIDVal.(int)
	if !ok || clientID <= 0 {
		return nil, false
	}
	var client Client
	if err := db.First(&client, clientID).Error; err != nil {
		return nil, false
	}
	return &client, true
}

// ListMyLinkedClients - GET /sf/my-linked-clients — Hüquqi şəxsin özünə bağlı
// Fərdi hesablarının siyahısı, hər birinin giriş (User) məlumatı ilə birgə.
func (h *Handler) ListMyLinkedClients(c *gin.Context) {
	db, _ := h.tenantDB(c)
	client, ok := currentClientRecord(db, c)
	if !ok {
		c.JSON(401, gin.H{"error": "Müştəri autentifikasiya olunmayıb"})
		return
	}
	if !isLegalClientType(client.Type) {
		c.JSON(403, gin.H{"error": "Bu funksiya yalnız Hüquqi şəxs hesabları üçün əlçatandır"})
		return
	}

	var children []Client
	db.Where("parent_client_id = ?", client.ID).Order("created_at DESC").Find(&children)

	type linkedUserOut struct {
		ID                   int             `json:"id"`
		Email                string          `json:"email"`
		Name                 string          `json:"name"`
		Phone                string          `json:"phone"`
		SubRoleID            *uint           `json:"sub_role_id"`
		RestrictedContractID *uint           `json:"restricted_contract_id"`
		PermissionOverrides  map[string]bool `json:"permission_overrides"`
		IsActive             bool            `json:"is_active"`
	}
	type linkedOut struct {
		Client
		User *linkedUserOut `json:"user"`
	}
	out := make([]linkedOut, 0, len(children))
	for _, ch := range children {
		item := linkedOut{Client: ch}
		if ch.UserID != nil {
			var u User
			if db.First(&u, *ch.UserID).Error == nil {
				item.User = &linkedUserOut{
					ID: u.ID, Email: u.Email, Name: u.Name, Phone: u.Phone,
					SubRoleID: u.SubRoleID, RestrictedContractID: u.RestrictedContractID,
					PermissionOverrides: parsePermMap(u.PermissionOverrides), IsActive: u.IsActive,
				}
			}
		}
		out = append(out, item)
	}
	c.JSON(200, out)
}

// CreateMyLinkedClient - POST /sf/my-linked-clients — Hüquqi şəxs özünə bağlı Fərdi
// hesab yaradır: Client (Type=individual, ParentClientID=özü) + law_users girişi.
// Eyni axın CreateClient-in "password" yolu kimidir, amma menecer yox, Hüquqi şəxsin
// özü çağırır və yalnız öz altında hesab aça bilər.
func (h *Handler) CreateMyLinkedClient(c *gin.Context) {
	db, _ := h.tenantDB(c)
	parent, ok := currentClientRecord(db, c)
	if !ok {
		c.JSON(401, gin.H{"error": "Müştəri autentifikasiya olunmayıb"})
		return
	}
	if !isLegalClientType(parent.Type) {
		c.JSON(403, gin.H{"error": "Bu funksiya yalnız Hüquqi şəxs hesabları üçün əlçatandır"})
		return
	}

	var input struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Phone    string `json:"phone"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	input.Name = strings.TrimSpace(input.Name)
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	if input.Name == "" {
		c.JSON(400, gin.H{"error": "Ad Soyad tələb olunur"})
		return
	}
	if input.Email == "" || input.Password == "" {
		c.JSON(400, gin.H{"error": "E-poçt və şifrə tələb olunur"})
		return
	}
	var existingUser User
	if db.Where("email = ?", input.Email).First(&existingUser).Error == nil {
		c.JSON(409, gin.H{"error": "Bu e-poçt ünvanı artıq başqa hesabda istifadə edilir. Fərqli e-poçt daxil edin."})
		return
	}
	hash, err := security.HashPassword(input.Password)
	if err != nil {
		c.JSON(500, gin.H{"error": "Şifrə hazırlanarkən xəta baş verdi"})
		return
	}

	parentID := parent.ID
	client := Client{
		Name:           input.Name,
		Email:          input.Email,
		Phone:          input.Phone,
		Type:           "individual",
		CompanyName:    parent.CompanyName,
		Status:         "active",
		ParentClientID: &parentID,
	}
	if err := db.Create(&client).Error; err != nil {
		c.JSON(500, gin.H{"error": "Fərdi hesab yaradılarkən xəta baş verdi"})
		return
	}
	tenantID := c.MustGet("tenantID").(uint)
	clientID := int(client.ID)
	user := User{
		Name:          input.Name,
		Email:         input.Email,
		PasswordHash:  hash,
		Role:          "client",
		ClientID:      &clientID,
		IsActive:      true,
		EmailVerified: false,
		TenantID:     int(tenantID),
	}
	if err := db.Create(&user).Error; err != nil {
		db.Delete(&client)
		c.JSON(500, gin.H{"error": "İstifadəçi hesabı yaradılarkən xəta baş verdi: " + err.Error()})
		return
	}
	uid := uint(user.ID)
	db.Model(&client).Update("user_id", uid)
	if err := issueVerificationCode(db, &user); err != nil {
		log.Printf("professional-law: CreateMyLinkedClient verification email failed for %s: %v", user.Email, err)
	}
	notifyManagers(db, "client_created", "Yeni bağlı hesab yaradıldı",
		fmt.Sprintf("%s özünə bağlı Fərdi hesab yaratdı: %s", parent.Name, client.Name), "client", &client.ID)

	c.JSON(201, gin.H{
		"client":  client,
		"message": fmt.Sprintf("Fərdi hesab yaradıldı. %s ünvanına təsdiq kodu göndərildi.", input.Email),
	})
}

// UpdateMyLinkedClientPermissions - PUT /sf/my-linked-clients/:id/permissions —
// Hüquqi şəxsin öz bağlı Fərdi hesabına fərdi icazə (permission_overrides) və
// istəyə görə müqavilə-məhdudiyyəti təyin etməsi — manager rol mərkəzindəki
// "Fərdi icazələr" panelinin eynisi, YALNIZ öz hesabları üzərində işləyir.
func (h *Handler) UpdateMyLinkedClientPermissions(c *gin.Context) {
	db, _ := h.tenantDB(c)
	parent, ok := currentClientRecord(db, c)
	if !ok {
		c.JSON(401, gin.H{"error": "Müştəri autentifikasiya olunmayıb"})
		return
	}
	if !isLegalClientType(parent.Type) {
		c.JSON(403, gin.H{"error": "Bu funksiya yalnız Hüquqi şəxs hesabları üçün əlçatandır"})
		return
	}

	childID := c.Param("id")
	var child Client
	if err := db.First(&child, childID).Error; err != nil {
		c.JSON(404, gin.H{"error": "Fərdi hesab tapılmadı"})
		return
	}
	if child.ParentClientID == nil || *child.ParentClientID != parent.ID {
		c.JSON(403, gin.H{"error": "Bu hesab sizə bağlı deyil"})
		return
	}
	if child.UserID == nil {
		c.JSON(400, gin.H{"error": "Bu hesabın hələ giriş (login) məlumatı yoxdur"})
		return
	}

	var input struct {
		PermissionOverrides  map[string]bool `json:"permission_overrides"`
		RestrictedContractID *uint           `json:"restricted_contract_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if input.PermissionOverrides != nil {
		// Təhlükəsizlik: Hüquqi şəxs bağlı Fərdi hesabına YALNIZ müştəri
		// interfeysinə aid icazə açarlarını (CLIENT_PERMISSIONS matrisi,
		// bax RoleManagementModal.tsx) təyin edə bilər. Əks halda "sərbəst"
		// açar göndərməklə (məs. delete_clients, manage_roles) öz bağlı
		// hesabına menecerə aid icazələr verə bilərdi.
		clientSafeKeys := map[string]bool{
			"view_clients": true, "edit_clients": true,
			"view_lawyers": true,
			"view_contracts": true,
			"view_tasks": true, "create_tasks": true,
			"upload_documents": true,
			"view_amounts": true,
		}
		filtered := map[string]bool{}
		for k, v := range input.PermissionOverrides {
			if clientSafeKeys[k] {
				filtered[k] = v
			}
		}
		b, _ := json.Marshal(filtered)
		updates["permission_overrides"] = datatypes.JSON(b)
	}
	// Müqaviləyə bağlanan müqavilə mütləq bu Hüquqi şəxsin öz müqaviləsi olmalıdır
	if input.RestrictedContractID != nil {
		var ct Contract
		if err := db.First(&ct, *input.RestrictedContractID).Error; err != nil || (ct.ClientID != parent.ID && ct.ClientID != child.ID) {
			c.JSON(400, gin.H{"error": "Yalnız öz müqavilələrinizə bağlaya bilərsiniz"})
			return
		}
		updates["restricted_contract_id"] = *input.RestrictedContractID
	}

	db.Model(&User{}).Where("id = ?", *child.UserID).Updates(updates)
	c.JSON(200, gin.H{"success": true})
}

// ==================== LIBRARY ====================

func (h *Handler) ListLibraryItems(c *gin.Context) {
	db, _ := h.tenantDB(c)
	itemType := c.Query("type")
	parentID := c.Query("parent_id")

	query := db.Model(&LibraryItem{}).Where("is_active = ?", true)
	if itemType != "" {
		query = query.Where("type = ?", itemType)
	}
	if parentID != "" {
		query = query.Where("parent_id = ?", parentID)
	} else if parentID == "" && itemType == "" {
		query = query.Where("parent_id IS NULL")
	}

	var items []LibraryItem
	query.Preload("Children").Order("sort_order ASC, name ASC").Find(&items)
	c.JSON(200, items)
}

func (h *Handler) CreateLibraryItem(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "manage_library", "Kitabxanaya əlavə etmək") {
		return
	}
	var item LibraryItem
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	if err := db.Create(&item).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to create library item"})
		return
	}
	c.JSON(201, item)
}

func (h *Handler) UpdateLibraryItem(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "manage_library", "Kitabxananı redaktə etmək") {
		return
	}
	id := c.Param("id")
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	delete(updates, "id")
	delete(updates, "created_at")
	db.Model(&LibraryItem{}).Where("id = ?", id).Updates(updates)
	var item LibraryItem
	db.Preload("Children").First(&item, id)
	c.JSON(200, item)
}

func (h *Handler) DeleteLibraryItem(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "manage_library", "Kitabxanadan silmək") {
		return
	}
	id := c.Param("id")
	// Soft delete: set is_active = false
	db.Model(&LibraryItem{}).Where("id = ?", id).Update("is_active", false)
	// Also deactivate children
	db.Model(&LibraryItem{}).Where("parent_id = ?", id).Update("is_active", false)
	c.JSON(200, gin.H{"success": true})
}

// ==================== SUB-ROLES ====================

func (h *Handler) ListSubRoles(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "manage_roles", "Rolları görmək") {
		return
	}
	baseRole := c.Query("base_role")

	query := db.Model(&SubRole{}).Where("is_active = ?", true)
	if baseRole != "" {
		query = query.Where("base_role = ?", baseRole)
	}

	var roles []SubRole
	query.Order("base_role ASC, name ASC").Find(&roles)
	c.JSON(200, roles)
}

func (h *Handler) CreateSubRole(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "manage_roles", "Rol yaratmaq") {
		return
	}
	var role SubRole
	if err := c.ShouldBindJSON(&role); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	if err := db.Create(&role).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to create role"})
		return
	}
	c.JSON(201, role)
}

func (h *Handler) UpdateSubRole(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "manage_roles", "Rolu redaktə etmək") {
		return
	}
	id := c.Param("id")
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	delete(updates, "id")
	// permissions jsonb sütununu düzgün marşallaşdır (map[string]bool → datatypes.JSON)
	if rawPerms, ok := updates["permissions"]; ok {
		if b, err := json.Marshal(rawPerms); err == nil {
			updates["permissions"] = datatypes.JSON(b)
		}
	}
	db.Model(&SubRole{}).Where("id = ?", id).Updates(updates)
	var role SubRole
	db.First(&role, id)
	c.JSON(200, role)
}

func (h *Handler) DeleteSubRole(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "manage_roles", "Rolu silmək") {
		return
	}
	id := c.Param("id")
	db.Model(&SubRole{}).Where("id = ?", id).Update("is_active", false)
	c.JSON(200, gin.H{"success": true})
}

// ==================== TASK FIELD UPDATE (Subject, etc.) ====================

func (h *Handler) UpdateTaskField(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "edit_tasks", "Tapşırıq sahəsini redaktə etmək") {
		return
	}
	id := c.Param("id")

	var input struct {
		Field string `json:"field"`
		Value string `json:"value"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Only allow specific fields to be updated
	allowed := map[string]bool{
		"subject": true, "claim_deadline": true,
		"client_role": true, "opposite_role": true, "opposite_party_name": true,
		"claim_type": true, "unvalued_claim_text": true,
		"completion_result": true,
	}
	if !allowed[input.Field] {
		c.JSON(400, gin.H{"error": "Field not allowed: " + input.Field})
		return
	}

	if restrictedID := getRestrictedContractID(db, c); restrictedID != nil {
		var existing Task
		if err := db.Select("contract_id").First(&existing, id).Error; err != nil || !contractAccessAllowed(restrictedID, existing.ContractID) {
			denyContractAccess(c)
			return
		}
	}

	db.Model(&Task{}).Where("id = ?", id).Update(input.Field, input.Value)

	var task Task
	db.Preload("Contract").Preload("Assignee").First(&task, id)

	// Notify about field update
	notifyManagers(db, "task_updated", "Tapşırıq yeniləndi",
		fmt.Sprintf("%s tapşırığının %s sahəsi yeniləndi", task.Title, input.Field), "task", &task.ID)

	// Tarixçəyə qeyd et
	logTaskHistory(db, task.ID, currentUserID(db, c), "edited", describeFieldChanges([]string{input.Field}), "", "", nil)

	c.JSON(200, task)
}

// ==================== SEED DEFAULTS ====================

func (h *Handler) SeedDefaults(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "manage_library", "Standart məlumatları yükləmək") {
		return
	}
	Seed(db)
	c.JSON(200, gin.H{"success": true, "message": "Defaults seeded"})
}

// Seed fills a new office's task types, library and sub-roles; existing rows are left alone.
func Seed(db *gorm.DB) {
	// Seed Azerbaijan e-court task types
	taskTypes := []TaskType{
		{Name: "Mülki iddia", Description: "Mülki hüquq mübahisələri üzrə iddialar", IsActive: true, SortOrder: 1},
		{Name: "Əmək mübahisəsi", Description: "İşçi-işəgötürən münasibətləri üzrə mübahisələr", IsActive: true, SortOrder: 2},
		{Name: "Ailə mübahisəsi", Description: "Ailə hüququ ilə bağlı mübahisələr", IsActive: true, SortOrder: 3},
		{Name: "Əmlak mübahisəsi", Description: "Daşınmaz və daşınar əmlak mübahisələri", IsActive: true, SortOrder: 4},
		{Name: "Borc mübahisəsi", Description: "Pul borcları və öhdəliklər üzrə mübahisələr", IsActive: true, SortOrder: 5},
		{Name: "Lizinq mübahisəsi", Description: "Lizinq müqavilələri üzrə mübahisələr", IsActive: true, SortOrder: 6},
		{Name: "İcarə mübahisəsi", Description: "İcarə münasibətləri üzrə mübahisələr", IsActive: true, SortOrder: 7},
		{Name: "İstehlakçı mübahisəsi", Description: "İstehlakçı hüquqlarının müdafiəsi", IsActive: true, SortOrder: 8},
		{Name: "Miras mübahisəsi", Description: "Vərəsəlik hüququ üzrə mübahisələr", IsActive: true, SortOrder: 9},
		{Name: "İnzibati iş", Description: "Dövlət orqanlarının qərarlarına etiraz", IsActive: true, SortOrder: 10},
		{Name: "Vergi mübahisəsi", Description: "Vergi orqanları ilə mübahisələr", IsActive: true, SortOrder: 11},
		{Name: "Gömrük mübahisəsi", Description: "Gömrük orqanları ilə mübahisələr", IsActive: true, SortOrder: 12},
		{Name: "Kommersiya mübahisəsi", Description: "Kommersiya hüququ üzrə mübahisələr", IsActive: true, SortOrder: 13},
		{Name: "Korporativ mübahisə", Description: "Şirkət daxili mübahisələr", IsActive: true, SortOrder: 14},
		{Name: "İflas işi", Description: "İflas və müflisləşmə işləri", IsActive: true, SortOrder: 15},
		{Name: "Xüsusi icraat", Description: "Xüsusi icraat qaydasında baxılan işlər", IsActive: true, SortOrder: 16},
		{Name: "Əqli mülkiyyət", Description: "Əqli mülkiyyət hüquqlarının müdafiəsi", IsActive: true, SortOrder: 17},
		{Name: "Sığorta mübahisəsi", Description: "Sığorta münasibətləri üzrə mübahisələr", IsActive: true, SortOrder: 18},
	}
	for _, tt := range taskTypes {
		var existing TaskType
		if db.Where("name = ?", tt.Name).First(&existing).Error != nil {
			db.Create(&tt)
		}
	}

	// Seed default library items
	libraryItems := []struct {
		Type     string
		Name     string
		Code     string
		Children []struct{ Name, Code string }
	}{
		{Type: "status", Name: "Təhkim gözləyir", Code: "tehkim_gozleyir", Children: nil},
		{Type: "status", Name: "Vəkil təhkim edildi", Code: "tehkim_olundu", Children: nil},
		{Type: "status", Name: "Məhkəməyə göndərildi", Code: "mehkemeye_gonderildi", Children: nil},
		{Type: "status", Name: "Pretenziya göndərildi", Code: "pretenziya_gonderildi", Children: nil},
		{Type: "status", Name: "Məhkəmə icraata qəbul etdi", Code: "mehkeme_qebul_etdi", Children: nil},
		{Type: "status", Name: "Apellyasiya şikayəti göndərildi", Code: "apellyasiya_gonderildi", Children: nil},
		{Type: "status", Name: "Kassasiya şikayəti göndərildi", Code: "kassasiya_gonderildi", Children: nil},
		{Type: "status", Name: "İcra məqamına göndərildi", Code: "icra_meqamina_gonderildi", Children: nil},
		{Type: "status", Name: "İş yekunlaşdı", Code: "is_yekunlasdi", Children: nil},
		{Type: "document_category", Name: "İddia ərizəsi", Code: "iddia_erizesi", Children: nil},
		{Type: "document_category", Name: "Müqavilə surəti", Code: "muqavile_sureti", Children: nil},
		{Type: "document_category", Name: "Şəxsiyyət vəsiqəsi", Code: "sexsiyyet_vesiqesi", Children: nil},
		{Type: "document_category", Name: "Etibarnamə", Code: "etibarname", Children: nil},
		{Type: "document_category", Name: "Dövlət rüsumu qəbzi", Code: "dovlet_rusumu", Children: nil},
		{Type: "document_category", Name: "Ekspertiza rəyi", Code: "ekspertiza_reyi", Children: nil},
		{Type: "document_category", Name: "Məhkəmə qərarı", Code: "mehkeme_qerari", Children: nil},
		{Type: "document_category", Name: "Çıxarış və arayışlar", Code: "cixaris_arayis", Children: nil},
		{Type: "court_type", Name: "Birinci instansiya məhkəməsi", Code: "birinci_instansiya", Children: nil},
		{Type: "court_type", Name: "Apellyasiya məhkəməsi", Code: "apellyasiya", Children: nil},
		{Type: "court_type", Name: "Kassasiya məhkəməsi", Code: "kassasiya", Children: nil},
		{Type: "court_type", Name: "Ali Məhkəmə", Code: "ali_mehkeme", Children: nil},
		{Type: "court_type", Name: "Konstitusiya Məhkəməsi", Code: "konstitusiya", Children: nil},
		{Type: "party_role", Name: "İddiaçı", Code: "iddiaci", Children: nil},
		{Type: "party_role", Name: "Cavabdeh", Code: "cavabdeh", Children: nil},
		{Type: "party_role", Name: "Ərizəçi", Code: "erizeci", Children: nil},
		{Type: "party_role", Name: "Maraqlı şəxs", Code: "maraqli_sexs", Children: nil},
		{Type: "party_role", Name: "Üçüncü şəxs", Code: "ucuncu_sexs", Children: nil},
	}
	for _, li := range libraryItems {
		var existing LibraryItem
		if db.Where("type = ? AND code = ?", li.Type, li.Code).First(&existing).Error != nil {
			item := LibraryItem{Type: li.Type, Name: li.Name, Code: li.Code, IsActive: true}
			db.Create(&item)
		}
	}

	// Seed default sub-roles — hər birinin REAL (boş olmayan) imtiyaz matrisi var,
	// belə ki "seed-defaults" düyməsi ilə yaradılan rollar heç bir icazə
	// olmadan (defakto bağlı) istifadəçini kilidləməsin.
	fullPerms := permsJSON(map[string]bool{
		"view_clients": true, "edit_clients": true, "delete_clients": true,
		"view_lawyers": true, "edit_lawyers": true, "delete_lawyers": true,
		"view_contracts": true, "edit_contracts": true, "delete_contracts": true,
		"view_tasks": true, "edit_tasks": true, "create_tasks": true, "delete_tasks": true, "change_status": true, "assign_tasks": true,
		"view_documents": true, "upload_documents": true, "delete_documents": true,
		"view_amounts": true, "edit_amounts": true,
		"view_reports": true, "export_reports": true,
		"manage_users": true, "manage_settings": true, "manage_library": true, "manage_roles": true,
	})
	managerOperatorPerms := permsJSON(map[string]bool{
		"view_clients": true, "edit_clients": true,
		"view_lawyers": true, "edit_lawyers": true,
		"view_contracts": true, "edit_contracts": true,
		"view_tasks": true, "edit_tasks": true, "create_tasks": true, "change_status": true, "assign_tasks": true,
		"view_documents": true, "upload_documents": true,
		"view_amounts": true, "edit_amounts": false,
		"view_reports": true, "export_reports": false,
		"manage_library": true,
	})
	seniorLawyerPerms := permsJSON(map[string]bool{
		"view_clients": true, "view_contracts": true,
		"view_tasks": true, "edit_tasks": true, "create_tasks": true, "change_status": true, "assign_tasks": true,
		"view_documents": true, "upload_documents": true, "delete_documents": true,
		"view_amounts": true, "edit_amounts": true,
		"view_reports": true, "export_reports": true,
	})
	juniorLawyerPerms := permsJSON(map[string]bool{
		"view_clients": true, "view_contracts": true,
		"view_tasks": true, "edit_tasks": true, "create_tasks": false, "change_status": false, "assign_tasks": false,
		"view_documents": true, "upload_documents": true, "delete_documents": false,
		"view_amounts": false, "edit_amounts": false,
		"view_reports": false, "export_reports": false,
	})
	clientStaffPerms := permsJSON(map[string]bool{
		"view_contracts": true, "view_tasks": true, "create_tasks": true,
		"view_documents": true, "upload_documents": true,
		"view_amounts": false, "view_reports": false,
	})
	clientLeadPerms := permsJSON(map[string]bool{
		"view_contracts": true, "view_tasks": true, "create_tasks": true,
		"view_documents": true, "upload_documents": true,
		"view_amounts": true, "view_reports": true, "export_reports": true,
	})
	clientCoordinatorPerms := permsJSON(map[string]bool{
		"view_contracts": true, "view_tasks": true, "create_tasks": true, "change_status": false,
		"view_documents": true, "upload_documents": true,
		"view_amounts": false, "view_reports": true, "export_reports": false,
	})

	defaultRoles := []SubRole{
		{BaseRole: "client", Name: "Müştəri - İşçi", Description: "Müştəri şirkətinin əməkdaşı", IsDefault: false, IsActive: true, Permissions: clientStaffPerms},
		{BaseRole: "client", Name: "Müştəri - Rəhbərlik", Description: "Müştəri şirkətinin rəhbəri", IsDefault: false, IsActive: true, Permissions: clientLeadPerms},
		{BaseRole: "client", Name: "Müştəri - Koordinator", Description: "Müştəri şirkətinin hüquqi koordinatoru", IsDefault: false, IsActive: true, Permissions: clientCoordinatorPerms},
		{BaseRole: "lawyer", Name: "Vəkil - Baş vəkil", Description: "Baş vəkil - tam səlahiyyətli", IsDefault: false, IsActive: true, Permissions: seniorLawyerPerms},
		{BaseRole: "lawyer", Name: "Vəkil - Köməkçi", Description: "Vəkil köməkçisi - məhdud səlahiyyət", IsDefault: false, IsActive: true, Permissions: juniorLawyerPerms},
		{BaseRole: "manager", Name: "Menecer - Admin", Description: "Tam səlahiyyətli menecer", IsDefault: true, IsActive: true, Permissions: fullPerms},
		{BaseRole: "manager", Name: "Menecer - Operator", Description: "Əməliyyat meneceri - məhdud", IsDefault: false, IsActive: true, Permissions: managerOperatorPerms},
	}
	for _, sr := range defaultRoles {
		var existing SubRole
		if db.Where("base_role = ? AND name = ?", sr.BaseRole, sr.Name).First(&existing).Error != nil {
			db.Create(&sr)
		}
	}

}


// ==================== MANAGER TASKS HANDLERS ====================
// Menecer → vəkil arasında körpü kimi işləyir.
// Menecer tapşırıq yaradır, vəkilə təhkim edir, vəkil icra edir.

func (h *Handler) ListManagerTasks(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "view_tasks", "Tapşırıqları görmək") {
		return
	}

	var tasks []ManagerTask
	q := db.Order("created_at desc")

	// Vəkil yalnız özünə təhkim olunan tapşırıqları görsün.
	// QEYD: bu yoxlama əvvəllər "userType" context açarına baxırdı, amma
	// JWTAuthMiddleware heç vaxt "userType" adlı açar yazmır (yalnız
	// "userRole") — ona görə bu şərt həmişə false idi və HƏR vəkil BÜTÜN
	// menecer tapşırıqlarını görürdü. Düzgün açarla ("userRole") əvəz edildi.
	if currentUserRole(c) == "lawyer" {
		if lawyerID, ok2 := c.Get("lawyerID"); ok2 {
			q = q.Where("assigned_to = ?", lawyerID)
		}
	}

	// Status filter
	if status := c.Query("status"); status != "" {
		q = q.Where("status = ?", status)
	}
	// Assigned filter (menecer üçün)
	if assignedTo := c.Query("assigned_to"); assignedTo != "" {
		q = q.Where("assigned_to = ?", assignedTo)
	}

	if err := q.Preload("Assignee").Find(&tasks).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch manager tasks"})
		return
	}

	c.JSON(200, tasks)
}

func (h *Handler) GetManagerTask(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "view_tasks", "Tapşırığı görmək") {
		return
	}
	id := c.Param("id")

	var task ManagerTask
	if err := db.Preload("Assignee").First(&task, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Manager task not found"})
		return
	}
	c.JSON(200, task)
}

func (h *Handler) CreateManagerTask(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "create_tasks", "Tapşırıq yaratmaq") {
		return
	}

	var input struct {
		Title       string      `json:"title"`
		Description string      `json:"description"`
		Priority    string      `json:"priority"`
		Status      string      `json:"status"`
		Deadline    *time.Time  `json:"deadline"`
		AssignedTo  *uint       `json:"assigned_to"`
		Label       string      `json:"label"`
		Location    string      `json:"location"`
		Attachments interface{} `json:"attachments"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	if input.Title == "" {
		c.JSON(400, gin.H{"error": "Title is required"})
		return
	}

	// CreatedBy: cari menecerin ID-si
	var createdBy uint = 0
	if uid, ok := c.Get("userID"); ok {
		if v, ok2 := uid.(uint); ok2 {
			createdBy = v
		}
	}

	task := ManagerTask{
		Title:       input.Title,
		Description: input.Description,
		Priority:    input.Priority,
		Status:      "new",
		Deadline:    input.Deadline,
		AssignedTo:  input.AssignedTo,
		CreatedBy:   createdBy,
		Label:       input.Label,
		Location:    input.Location,
	}
	if input.Status != "" {
		task.Status = input.Status
	}
	if input.Priority == "" {
		task.Priority = "normal"
	}
	if input.Attachments != nil {
		if b, err := json.Marshal(input.Attachments); err == nil {
			task.Attachments = datatypes.JSON(b)
		}
	}

	if err := db.Create(&task).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to create manager task"})
		return
	}

	// Vəkilə bildirim
	if input.AssignedTo != nil {
		var lawyer Lawyer
		if err := db.First(&lawyer, *input.AssignedTo).Error; err == nil && lawyer.UserID != nil {
			notification := Notification{
				UserID:     *lawyer.UserID,
				UserType:   "lawyer",
				Type:       "manager_task_assigned",
				Title:      "Yeni menecer tapşırığı",
				Message:    fmt.Sprintf("Menecer sizə yeni tapşırıq verdi: %s", task.Title),
				EntityType: "manager_task",
				EntityID:   &task.ID,
			}
			db.Create(&notification)
		}
	}

	db.Preload("Assignee").First(&task, task.ID)
	c.JSON(201, task)
}

func (h *Handler) UpdateManagerTask(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "edit_tasks", "Tapşırığı redaktə etmək") {
		return
	}
	id := c.Param("id")

	var task ManagerTask
	if err := db.First(&task, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Manager task not found"})
		return
	}

	var input struct {
		Title          *string     `json:"title"`
		Description    *string     `json:"description"`
		Priority       *string     `json:"priority"`
		Status         *string     `json:"status"`
		Deadline       *time.Time  `json:"deadline"`
		AssignedTo     *uint       `json:"assigned_to"`
		Label          *string     `json:"label"`
		Location       *string     `json:"location"`
		CompletionNote *string     `json:"completion_note"`
		CompletionDocs interface{} `json:"completion_docs"`
		Attachments    interface{} `json:"attachments"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	ep := loadEffectivePerms(db, c)
	if input.Status != nil && !ep.Allowed("change_status") {
		c.JSON(403, gin.H{"error": "Tapşırığın statusunu dəyişmək üçün icazəniz yoxdur. Admin ilə əlaqə saxlayın.", "permission_key": "change_status", "permission_denied": true})
		return
	}
	if input.AssignedTo != nil && !ep.Allowed("assign_tasks") {
		c.JSON(403, gin.H{"error": "Tapşırığı təhkim etmək üçün icazəniz yoxdur. Admin ilə əlaqə saxlayın.", "permission_key": "assign_tasks", "permission_denied": true})
		return
	}

	updates := map[string]interface{}{}
	if input.Title != nil {
		updates["title"] = *input.Title
	}
	if input.Description != nil {
		updates["description"] = *input.Description
	}
	if input.Priority != nil {
		updates["priority"] = *input.Priority
	}
	if input.Status != nil {
		updates["status"] = *input.Status
		// Tamamlandıqda completed_at qoy
		if *input.Status == "completed" {
			now := time.Now()
			updates["completed_at"] = &now
			// Menecerə bildirim
			notifyManagers(db, "manager_task_completed", "Tapşırıq icra edildi",
				fmt.Sprintf("Vəkil tapşırığı tamamladı: %s", task.Title),
				"manager_task", &task.ID)
		}
	}
	if input.Deadline != nil {
		updates["deadline"] = *input.Deadline
	}
	if input.AssignedTo != nil {
		updates["assigned_to"] = *input.AssignedTo
	}
	if input.Label != nil {
		updates["label"] = *input.Label
	}
	if input.Location != nil {
		updates["location"] = *input.Location
	}
	if input.CompletionNote != nil {
		updates["completion_note"] = *input.CompletionNote
	}
	if input.CompletionDocs != nil {
		if b, err := json.Marshal(input.CompletionDocs); err == nil {
			updates["completion_docs"] = datatypes.JSON(b)
		}
	}
	if input.Attachments != nil {
		if b, err := json.Marshal(input.Attachments); err == nil {
			updates["attachments"] = datatypes.JSON(b)
		}
	}

	if err := db.Model(&task).Updates(updates).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to update manager task"})
		return
	}

	db.Preload("Assignee").First(&task, task.ID)
	c.JSON(200, task)
}

func (h *Handler) DeleteManagerTask(c *gin.Context) {
	db, _ := h.tenantDB(c)
	if !requirePermission(c, db, "delete_tasks", "Tapşırığı silmək") {
		return
	}
	id := c.Param("id")

	if err := db.Delete(&ManagerTask{}, id).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to delete manager task"})
		return
	}
	c.JSON(200, gin.H{"success": true})
}