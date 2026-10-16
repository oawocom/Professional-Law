package professionallaw

import (
	"time"

	"gorm.io/datatypes"
)

// ==================== LAWYERS ====================

type Lawyer struct {
	ID             uint           `json:"id" gorm:"primaryKey"`
	UserID         *uint          `json:"user_id" gorm:"index"`
	Name           string         `json:"name" gorm:"size:255;not null"`
	Email          string         `json:"email" gorm:"size:255;index"`
	Phone          string         `json:"phone" gorm:"size:50"`
	Avatar         string         `json:"avatar" gorm:"size:500"`
	Specialization string         `json:"specialization" gorm:"size:255"`
	Specializations datatypes.JSON `json:"specializations" gorm:"type:jsonb"`
	LicenseNumber  string         `json:"license_number" gorm:"size:100"`
	BarAssociation string         `json:"bar_association" gorm:"size:255"`
	Experience     int            `json:"experience"`
	Rating         float32        `json:"rating" gorm:"default:0"`
	Education      datatypes.JSON `json:"education" gorm:"type:jsonb"`
	CareerHistory  datatypes.JSON `json:"career_history" gorm:"type:jsonb"`
	Certifications datatypes.JSON `json:"certifications" gorm:"type:jsonb"`
	Languages      datatypes.JSON `json:"languages" gorm:"type:jsonb"`
	Achievements   datatypes.JSON `json:"achievements" gorm:"type:jsonb"`
	WorkingHours   datatypes.JSON `json:"working_hours" gorm:"type:jsonb"`
	Status         string         `json:"status" gorm:"size:50;default:active"`
	IsArchived     bool           `json:"is_archived" gorm:"default:false"`
	ActiveCases    int            `json:"active_cases" gorm:"default:0"`
	CompletedCases int            `json:"completed_cases" gorm:"default:0"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

// ==================== CLIENTS ====================

type Client struct {
	ID            uint           `json:"id" gorm:"primaryKey"`
	UserID        *uint          `json:"user_id" gorm:"index"`
	// Type: "individual" (Fiziki şəxs) | "legal" (Hüquqi şəxs). Köhnə "company"
	// dəyəri geriyə uyğunluq üçün "legal" kimi rəftar edilir (bax: isLegalType()).
	Type string `json:"type" gorm:"size:50;default:individual"`
	// ParentClientID — yalnız Hüquqi şəxsə bağlı Fərdi hesablarda dolu olur.
	// Hüquqi şəxsin özündə (Type=="legal") bu sahə NULL qalır — o, kökdür.
	ParentClientID *uint          `json:"parent_client_id" gorm:"index"`
	Name           string         `json:"name" gorm:"size:255;not null"`
	Email          string         `json:"email" gorm:"size:255;index"`
	Phone          string         `json:"phone" gorm:"size:50"`
	Address        string         `json:"address" gorm:"type:text"`
	CompanyName    string         `json:"company_name" gorm:"size:255"`
	TaxNumber      string         `json:"tax_number" gorm:"size:50"`
	ContactPerson  string         `json:"contact_person" gorm:"size:255"`
	Notes          string         `json:"notes" gorm:"type:text"`
	Documents      datatypes.JSON `json:"documents" gorm:"type:jsonb"`
	Status         string         `json:"status" gorm:"size:50;default:active"`
	IsArchived     bool           `json:"is_archived" gorm:"default:false"`
	ArchivedAt     *time.Time     `json:"archived_at"`
	Source         string         `json:"source" gorm:"size:100"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

// isLegalType — "legal" və köhnə "company" dəyərini eyni davranış üçün normallaşdırır.
func isLegalClientType(t string) bool {
	return t == "legal" || t == "company"
}

// ==================== CONTRACTS ====================

type Contract struct {
	ID                uint           `json:"id" gorm:"primaryKey"`
	ContractNumber    string         `json:"contract_number" gorm:"size:100;index"`
	ClientID          uint           `json:"client_id" gorm:"index;not null"`
	TaskTypeID        *uint          `json:"task_type_id" gorm:"index"`
	Title             string         `json:"title" gorm:"size:255;not null"`
	Description       string         `json:"description" gorm:"type:text"`
	Category          string         `json:"category" gorm:"size:100"`
	Type              string         `json:"type" gorm:"size:100"`
	Status            string         `json:"status" gorm:"size:50;default:active"`
	Priority          string         `json:"priority" gorm:"size:20;default:normal"`
	StartDate         *time.Time     `json:"start_date"`
	EndDate           *time.Time     `json:"end_date"`
	Value             float64        `json:"value" gorm:"type:decimal(15,2)"`
	Currency          string         `json:"currency" gorm:"size:10;default:AZN"`
	PaymentStatus     string         `json:"payment_status" gorm:"size:50;default:pending"`
	PaymentTerms      string         `json:"payment_terms" gorm:"type:text"`
	CourtName         string         `json:"court_name" gorm:"size:255"`
	CaseNumber        string         `json:"case_number" gorm:"size:100"`
	ClaimAmount       float64        `json:"claim_amount" gorm:"type:decimal(15,2)"`
	ClaimDeadline     *time.Time     `json:"claim_deadline"`
	Documents         datatypes.JSON `json:"documents" gorm:"type:jsonb"`
	Notes             string         `json:"notes" gorm:"type:text"`
	Terms             string         `json:"terms" gorm:"type:text"`
	TaskQuota         int            `json:"task_quota" gorm:"default:100"`
	TasksUsed         int            `json:"tasks_used" gorm:"default:0"`
	AutoRenew         bool           `json:"auto_renew" gorm:"default:false"`
	StaticLawyerFee   float64        `json:"static_lawyer_fee" gorm:"type:decimal(15,2);default:0"`
	AllowedCategories datatypes.JSON `json:"allowed_categories" gorm:"type:jsonb;default:'[]'"`
	WorkLocations     datatypes.JSON `json:"work_locations" gorm:"type:jsonb;default:'[]'"`

	// === İDDİANIN NÖVÜ (e-məhkəmə uyğun) ===
	ClaimCategory          string `json:"claim_category" gorm:"size:100;index"`
	ClaimSubcategory       string `json:"claim_subcategory" gorm:"size:500"`
	CustomClaimLabel       string `json:"custom_claim_label" gorm:"size:500"`
	CustomSubcategoryLabel string `json:"custom_subcategory_label" gorm:"size:500"`

	IsArchived  bool       `json:"is_archived" gorm:"default:false"`
	ArchivedAt  *time.Time `json:"archived_at"`
	CreatedBy   uint       `json:"created_by"`
	ApprovedBy  *uint      `json:"approved_by"`
	ApprovedAt  *time.Time `json:"approved_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`

	Client   *Client   `json:"client,omitempty" gorm:"foreignKey:ClientID"`
	TaskType *TaskType `json:"task_type,omitempty" gorm:"foreignKey:TaskTypeID"`
}

// ==================== TASK TYPES ====================
// Tapşırıq növləri — hər növ üçün lazım olan sənədlər + mərhələlər (addımlar)

type TaskType struct {
	ID                uint           `json:"id" gorm:"primaryKey"`
	Name              string         `json:"name" gorm:"size:255;not null"`
	Description       string         `json:"description" gorm:"type:text"`
	RequiredDocuments datatypes.JSON `json:"required_documents" gorm:"type:jsonb;default:'[]'"`
	Steps             datatypes.JSON `json:"steps" gorm:"type:jsonb;default:'[]'"`
	IsActive          bool           `json:"is_active" gorm:"default:true"`
	SortOrder         int            `json:"sort_order" gorm:"default:0"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
}

// ==================== KİTABXANA (Library) ====================

type LibraryItem struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	ParentID  *uint          `json:"parent_id" gorm:"index"`
	Type      string         `json:"type" gorm:"size:100;not null;index"`
	Name      string         `json:"name" gorm:"size:255;not null"`
	Code      string         `json:"code" gorm:"size:100;index"`
	Config    datatypes.JSON `json:"config" gorm:"type:jsonb;default:'{}'"`
	SortOrder int            `json:"sort_order" gorm:"default:0"`
	IsActive  bool           `json:"is_active" gorm:"default:true"`
	Version   int            `json:"version" gorm:"default:1"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	Children  []LibraryItem  `json:"children,omitempty" gorm:"foreignKey:ParentID"`
}

func (LibraryItem) TableName() string { return "law_library_items" }

// ==================== ALT-ROLLAR (RBAC) ====================

type SubRole struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	BaseRole    string         `json:"base_role" gorm:"size:50;not null"`
	Name        string         `json:"name" gorm:"size:255;not null"`
	Description string         `json:"description" gorm:"type:text"`
	Permissions datatypes.JSON `json:"permissions" gorm:"type:jsonb;default:'{}'"`
	IsActive    bool           `json:"is_active" gorm:"default:true"`
	IsDefault   bool           `json:"is_default" gorm:"default:false"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

func (SubRole) TableName() string { return "law_sub_roles" }

// ==================== TASKS ====================
// Müştəri tapşırıqları — müştəri yaradır, menecer təsdiqləyir, vəkil icra edir

type Task struct {
	ID           uint  `json:"id" gorm:"primaryKey"`
	ContractID   *uint `json:"contract_id" gorm:"index"`
	TaskTypeID   *uint `json:"task_type_id" gorm:"index"`
	ParentTaskID *uint `json:"parent_task_id" gorm:"index"`

	Title          string `json:"title" gorm:"size:500;not null"`
	RespondentName string `json:"respondent_name" gorm:"size:255"`
	TaskNumber     string `json:"task_number" gorm:"size:50;index"`
	Description    string `json:"description" gorm:"type:text"`
	Category       string `json:"category" gorm:"size:100"`

	Status      string `json:"status" gorm:"size:100;default:new"`
	CurrentStep int    `json:"current_step" gorm:"default:0"`
	Priority    string `json:"priority" gorm:"size:20;default:normal"`

	Deadline        *time.Time `json:"deadline"`
	ManagerDeadline *time.Time `json:"manager_deadline"`
	ClaimDeadline   *time.Time `json:"claim_deadline"`
	CompletedAt     *time.Time `json:"completed_at"`

	ClaimAmounts datatypes.JSON `json:"claim_amounts" gorm:"type:jsonb;default:'[]'"`
	TotalClaim   float64        `json:"total_claim" gorm:"type:decimal(15,2);default:0"`

	EstimatedHours float32 `json:"estimated_hours"`
	ActualHours    float32 `json:"actual_hours"`

	DocumentChecklist datatypes.JSON `json:"document_checklist" gorm:"type:jsonb;default:'[]'"`
	Attachments       datatypes.JSON `json:"attachments" gorm:"type:jsonb"`
	Checklist         datatypes.JSON `json:"checklist" gorm:"type:jsonb"`

	Notes   string `json:"notes" gorm:"type:text"`
	Subject string `json:"subject" gorm:"type:text"`

	ClientRole        string `json:"client_role" gorm:"size:100"`
	OppositeRole      string `json:"opposite_role" gorm:"size:100"`
	OppositePartyName string `json:"opposite_party_name" gorm:"size:255"`

	ClaimType         string `json:"claim_type" gorm:"size:50;default:valued"`
	UnvaluedClaimText string `json:"unvalued_claim_text" gorm:"type:text"`

	// === İDDİANIN NÖVÜ (e-məhkəmə uyğun) ===
	ClaimCategory          string `json:"claim_category" gorm:"size:100;index"`
	ClaimSubcategory       string `json:"claim_subcategory" gorm:"size:500"`
	CustomClaimLabel       string `json:"custom_claim_label" gorm:"size:500"`
	CustomSubcategoryLabel string `json:"custom_subcategory_label" gorm:"size:500"`

	CompletionResult string         `json:"completion_result" gorm:"size:100"`
	ResultAmounts    datatypes.JSON `json:"result_amounts" gorm:"type:jsonb"`

	RejectionReason string `json:"rejection_reason" gorm:"type:text"`

	CreatedBy  uint  `json:"created_by"`
	AssignedTo *uint `json:"assigned_to"`
	ClientID   *uint `json:"client_id" gorm:"index"`

	IsArchived bool       `json:"is_archived" gorm:"default:false"`
	ArchivedAt *time.Time `json:"archived_at"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Contract *Contract `json:"contract,omitempty" gorm:"foreignKey:ContractID"`
	Assignee *Lawyer   `json:"assignee,omitempty" gorm:"foreignKey:AssignedTo"`
	TaskType *TaskType `json:"task_type,omitempty" gorm:"foreignKey:TaskTypeID"`
	Client   *Client   `json:"client_info,omitempty" gorm:"foreignKey:ClientID"`
}

// ==================== MANAGER TASKS ====================
// Menecer tapşırıqları — menecer→vəkil arasında administrativ tapşırıqlar

type ManagerTask struct {
	ID             uint           `json:"id" gorm:"primaryKey"`
	Title          string         `json:"title" gorm:"size:255;not null"`
	Description    string         `json:"description" gorm:"type:text"`
	Priority       string         `json:"priority" gorm:"size:20;default:normal"`
	Status         string         `json:"status" gorm:"size:50;default:new"`
	Deadline       *time.Time     `json:"deadline"`
	AssignedTo     *uint          `json:"assigned_to" gorm:"index"`
	CreatedBy      uint           `json:"created_by"`
	Label          string         `json:"label" gorm:"size:100"`
	Location       string         `json:"location" gorm:"size:255"`
	Attachments    datatypes.JSON `json:"attachments" gorm:"type:jsonb"`
	CompletionNote string         `json:"completion_note" gorm:"type:text"`
	CompletionDocs datatypes.JSON `json:"completion_docs" gorm:"type:jsonb"`
	CompletedAt    *time.Time     `json:"completed_at"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`

	Assignee *Lawyer `json:"assignee,omitempty" gorm:"foreignKey:AssignedTo"`
}

// ==================== TASK COMMENTS ====================

type TaskComment struct {
	ID             uint           `json:"id" gorm:"primaryKey"`
	TaskID         uint           `json:"task_id" gorm:"index;not null"`
	UserID         uint           `json:"user_id" gorm:"index;not null"`
	UserType       string         `json:"user_type" gorm:"size:50"`
	UserName       string         `json:"user_name" gorm:"size:255"`
	Content        string         `json:"content" gorm:"type:text;not null"`
	Attachments    datatypes.JSON `json:"attachments" gorm:"type:jsonb"`
	IsApproved     bool           `json:"is_approved" gorm:"default:false"`
	IsPending      bool           `json:"is_pending" gorm:"default:true"`
	IsRejected     bool           `json:"is_rejected" gorm:"default:false"`
	ManagerNote    string         `json:"manager_note" gorm:"type:text"`
	ApprovedAt     *time.Time     `json:"approved_at"`
	ApprovedBy     *uint          `json:"approved_by"`
	TargetUserType string         `json:"target_user_type" gorm:"size:50"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

// ==================== APPROVALS ====================

type Approval struct {
	ID           uint   `json:"id" gorm:"primaryKey"`
	ApprovalType string `json:"approval_type" gorm:"size:50;not null;default:'new_task'"`
	EntityType   string `json:"entity_type" gorm:"size:50;not null"`
	EntityID     uint   `json:"entity_id" gorm:"index;not null"`
	TaskID       *uint  `json:"task_id" gorm:"index"`

	RequestedBy uint      `json:"requested_by" gorm:"not null"`
	RequestedAt time.Time `json:"requested_at"`
	ApproverID  *uint     `json:"approver_id"`
	Status      string    `json:"status" gorm:"size:50;default:pending"`

	PreviousData  datatypes.JSON `json:"previous_data" gorm:"type:jsonb"`
	RequestedData datatypes.JSON `json:"requested_data" gorm:"type:jsonb"`

	PreviousStatus string `json:"previous_status" gorm:"size:100"`
	NewStatus      string `json:"new_status" gorm:"size:100"`
	StepIndex      int    `json:"step_index" gorm:"default:0"`

	Attachments datatypes.JSON `json:"attachments" gorm:"type:jsonb"`

	Reason    string     `json:"reason" gorm:"type:text"`
	Decision  string     `json:"decision" gorm:"type:text"`
	DecidedAt *time.Time `json:"decided_at"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

// ==================== MESSAGES ====================

type Message struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	TaskID      *uint          `json:"task_id" gorm:"index"`
	ContractID  *uint          `json:"contract_id" gorm:"index"`
	Channel     string         `json:"channel" gorm:"size:50;default:all"`
	SenderID    uint           `json:"sender_id" gorm:"index;not null"`
	SenderType  string         `json:"sender_type" gorm:"size:50"`
	SenderName  string         `json:"sender_name" gorm:"size:255"`
	ReceiverID  *uint          `json:"receiver_id" gorm:"index"`
	Content     string         `json:"content" gorm:"type:text;not null"`
	Attachments datatypes.JSON `json:"attachments" gorm:"type:jsonb"`
	IsRead      bool           `json:"is_read" gorm:"default:false"`
	ReadAt      *time.Time     `json:"read_at"`
	CreatedAt   time.Time      `json:"created_at"`
}

// ==================== NOTIFICATIONS ====================

type Notification struct {
	ID         uint       `json:"id" gorm:"primaryKey"`
	UserID     uint       `json:"user_id" gorm:"index;not null"`
	UserType   string     `json:"user_type" gorm:"size:50"`
	Type       string     `json:"type" gorm:"size:50"`
	Title      string     `json:"title" gorm:"size:255"`
	Message    string     `json:"message" gorm:"type:text"`
	EntityType string     `json:"entity_type" gorm:"size:50"`
	EntityID   *uint      `json:"entity_id"`
	IsRead     bool       `json:"is_read" gorm:"default:false"`
	ReadAt     *time.Time `json:"read_at"`
	CreatedAt  time.Time  `json:"created_at"`
}

// ==================== AVTOMATLAŞDIRMA QAYDALARI (Automation Rules) ====================
// QEYD (2026-09, istifadəçi tapşırığı: "daxili avtomatlaşdırma qaydaları,
// məs. tapşırıq statusu X-ə dəyişəndə Y-ə bildiriş göndər"). Bax: automation.go
// üçün mühərrik məntiqi. Bu modelin özü sadəcə qaydanın konfiqurasiyasını
// saxlayır — "trigger" (nə vaxt), "trigger_config" (hansı şərtlə, sadə
// açar=dəyər filtri, boşdursa hər zaman), "action_config" (kimə, hansı
// mətnlə bildiriş). v1-də yeganə dəstəklənən ActionType "notify"-dir.
type AutomationRule struct {
	ID            uint           `json:"id" gorm:"primaryKey"`
	Name          string         `json:"name" gorm:"size:255;not null"`
	Description   string         `json:"description" gorm:"type:text"`
	IsActive      bool           `json:"is_active" gorm:"default:true"`
	TriggerType   string         `json:"trigger_type" gorm:"size:100;not null;index"`
	TriggerConfig datatypes.JSON `json:"trigger_config" gorm:"type:jsonb;default:'{}'"`
	ActionType    string         `json:"action_type" gorm:"size:50;default:notify"`
	ActionConfig  datatypes.JSON `json:"action_config" gorm:"type:jsonb;default:'{}'"`
	RunCount      int            `json:"run_count" gorm:"default:0"`
	LastRunAt     *time.Time     `json:"last_run_at"`
	CreatedBy     uint           `json:"created_by"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
}

// ==================== TABLE NAMES ====================

func (Lawyer) TableName() string       { return "law_lawyers" }
func (Client) TableName() string       { return "law_clients" }
func (Contract) TableName() string     { return "law_contracts" }
func (Task) TableName() string         { return "law_tasks" }
func (TaskComment) TableName() string  { return "law_task_comments" }
func (Approval) TableName() string     { return "law_approvals" }
func (Message) TableName() string      { return "law_messages" }
func (Notification) TableName() string { return "law_notifications" }
func (TaskType) TableName() string     { return "law_task_types" }
func (ManagerTask) TableName() string  { return "law_manager_tasks" }
func (AutomationRule) TableName() string { return "law_automation_rules" }

// Models returns all models for auto-migration
func Models() []interface{} {
	return []interface{}{
		&User{},
		&Lawyer{},
		&Client{},
		&Contract{},
		&Task{},
		&TaskComment{},
		&Approval{},
		&Message{},
		&Notification{},
		&TaskType{},
		&ManagerTask{},
		&LibraryItem{},
		&SubRole{},
		&AutomationRule{},
	}
}