package professionallaw

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ============================================================
// ROUTES
// The office comes from the address: the tenant middleware has set
// "tenantID" before any of these runs.
//
// Public : /api/auth/... (login, codes, password links)
// Panel  : /api/sf/...   (the office's own users: manager, lawyer, client)
// ============================================================

// RegisterRoutes puts an office's API under api; getDB opens an office's own database.
func RegisterRoutes(api *gin.RouterGroup, getDB func(uint) (*gorm.DB, error)) {
	handler := NewHandler(getDB)
	{
		api.POST("/auth/login", handler.Login)
		api.POST("/auth/logout", handler.Logout)
		api.GET("/auth/me", handler.GetMe)
		api.POST("/auth/forgot-code", handler.ForgotLoginCode)
		api.POST("/auth/setup-password", handler.SetupPassword)
		api.GET("/auth/verify-setup-token", handler.VerifySetupToken)

		sf := api.Group("/sf")
		sf.Use(JWTAuthMiddleware())
		{
			sf.GET("/stats", handler.GetStats)
			sf.GET("/auth/permissions", handler.GetMyPermissions)
			sf.GET("/auth/me", handler.GetMe)
			sf.POST("/auth/verify-email", handler.VerifyEmailCode)
			sf.POST("/auth/resend-code", handler.ResendVerificationCode)
			sf.POST("/auth/password-otp/request", handler.RequestPasswordChangeOTP)
			sf.POST("/auth/password-otp/confirm", handler.ConfirmPasswordChangeOTP)
			sf.PUT("/auth/me", handler.UpdateMyProfile)
			sf.DELETE("/auth/me", handler.DeleteMyAccount)

			sf.GET("/lawyers", handler.ListLawyers)
			sf.GET("/lawyers/:id", handler.GetLawyer)
			sf.POST("/lawyers", handler.CreateLawyer)
			sf.PUT("/lawyers/:id", handler.UpdateLawyer)
			sf.DELETE("/lawyers/:id", handler.DeleteLawyer)
			sf.GET("/lawyers/:id/pending-tasks", handler.GetLawyerPendingTasks)

			sf.GET("/clients", handler.ListClients)
			sf.GET("/clients/:id", handler.GetClient)
			sf.POST("/clients", handler.CreateClient)
			sf.PUT("/clients/:id", handler.UpdateClient)
			sf.DELETE("/clients/:id", handler.DeleteClient)
			sf.POST("/clients/:id/set-login", handler.SetClientLogin)

			sf.GET("/contracts", handler.ListContracts)
			sf.GET("/contracts/:id", handler.GetContract)
			sf.POST("/contracts", handler.CreateContract)
			sf.PUT("/contracts/:id", handler.UpdateContract)
			sf.DELETE("/contracts/:id", handler.DeleteContract)

			sf.GET("/tasks", handler.ListTasks)
			sf.GET("/tasks/:id", handler.GetTask)
			sf.POST("/tasks", handler.CreateTask)
			sf.PUT("/tasks/:id", handler.UpdateTask)
			sf.DELETE("/tasks/:id", handler.DeleteTask)

			sf.GET("/task-comments", handler.ListTaskComments)
			sf.POST("/task-comments", handler.CreateTaskComment)
			sf.DELETE("/task-comments/:id", handler.DeleteTaskComment)

			sf.GET("/approvals", handler.ListApprovals)
			sf.GET("/approvals/:id", handler.GetApproval)
			sf.POST("/approvals", handler.CreateApproval)
			sf.PUT("/approvals/:id", handler.ProcessApproval)

			sf.GET("/messages", handler.ListMessages)
			sf.POST("/messages", handler.CreateMessage)
			sf.POST("/messages/mark-read", handler.MarkMessagesRead)

			sf.GET("/notifications", handler.ListNotifications)
			sf.POST("/notifications/mark-read", handler.MarkNotificationsRead)

			sf.GET("/task-types", handler.ListTaskTypes)
			sf.GET("/task-types/:id", handler.GetTaskType)
			sf.POST("/task-types", handler.CreateTaskType)
			sf.PUT("/task-types/:id", handler.UpdateTaskType)
			sf.DELETE("/task-types/:id", handler.DeleteTaskType)

			sf.PUT("/tasks/:id/archive", handler.ArchiveTask)
			sf.PUT("/contracts/:id/archive", handler.ArchiveContract)
			sf.PUT("/clients/:id/archive", handler.ArchiveClient)
			sf.GET("/archived", handler.GetArchivedItems)

			sf.GET("/library", handler.ListLibraryItems)
			sf.POST("/library", handler.CreateLibraryItem)
			sf.PUT("/library/:id", handler.UpdateLibraryItem)
			sf.DELETE("/library/:id", handler.DeleteLibraryItem)

			sf.GET("/sub-roles", handler.ListSubRoles)
			sf.POST("/sub-roles", handler.CreateSubRole)
			sf.PUT("/sub-roles/:id", handler.UpdateSubRole)
			sf.DELETE("/sub-roles/:id", handler.DeleteSubRole)

			// Hüquqi şəxs — özünə bağlı Fərdi hesabların idarəedilməsi
			sf.GET("/my-linked-clients", handler.ListMyLinkedClients)
			sf.POST("/my-linked-clients", handler.CreateMyLinkedClient)
			sf.PUT("/my-linked-clients/:id/permissions", handler.UpdateMyLinkedClientPermissions)

			sf.PUT("/tasks/:id/field", handler.UpdateTaskField)

			sf.POST("/seed-defaults", handler.SeedDefaults)

			sf.GET("/users", handler.ListUsers)
			sf.POST("/users/:id/reset-password", handler.ResetUserPassword)
			sf.PUT("/users/:id", handler.UpdateUser)
			sf.DELETE("/users/:id", handler.DeleteUser)

			sf.POST("/auth/change-password", handler.ChangePassword)
			sf.POST("/files/upload", handler.UploadFile)
			sf.GET("/files/:filename", handler.ServeFile)

			// Mərkəzi "Sənədlər" bölməsi (2026-09, istifadəçi tapşırığı) — mövcud
			// Client/Contract/Task sənəd sahələrini bir yerdə göstərir (bax documents.go).
			sf.GET("/documents", handler.ListDocuments)

			// Daxili avtomatlaşdırma qaydaları (2026-09, istifadəçi tapşırığı) —
			// trigger/şərt/əməliyyat mühərriki, bax automation.go.
			sf.GET("/automation-rules", handler.ListAutomationRules)
			sf.POST("/automation-rules", handler.CreateAutomationRule)
			sf.PUT("/automation-rules/:id", handler.UpdateAutomationRule)
			sf.DELETE("/automation-rules/:id", handler.DeleteAutomationRule)

			// === Manager Tasks (menecer ↔ vəkil körpüsü) ===
			sf.GET("/manager-tasks", handler.ListManagerTasks)
			sf.GET("/manager-tasks/:id", handler.GetManagerTask)
			sf.POST("/manager-tasks", handler.CreateManagerTask)
			sf.PUT("/manager-tasks/:id", handler.UpdateManagerTask)
			sf.DELETE("/manager-tasks/:id", handler.DeleteManagerTask)
		}
	}
}
