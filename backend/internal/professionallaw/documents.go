package professionallaw

import (
	"encoding/json"
	"sort"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
)

// QEYD: bu fayl yeni fayl saxlama qurmur — Client/Contract/Task üzərindəki
// `documents`/`document_checklist` JSON sütunlarını (fayllar files.go ilə
// saxlanılır) bir yerdə, axtarıla/süzülə bilən siyahı kimi göstərir.

// docSourceItem - mənbədən (Client/Contract/Task) çıxarılan hər fayl qeydinin
// xam sahələrini (name/url/file_type/file_size/uploaded_by/uploaded_at və s.,
// mənbədən asılı olaraq dəyişə bilən açarlar) + aggregation metadatasını
// birləşdirən çevik cavab strukturu.
type docSourceItem map[string]interface{}

// parseDocJSONArray - datatypes.JSON sütununu (Client.Documents,
// Contract.Documents, Task.DocumentChecklist) obyekt massivinə çevirir.
// Format fərqli ola bilər (bəzi yerlərdə birbaşa array, boş halda null/[]);
// hər hansı xəta halında sadəcə boş massiv qaytarılır (fail-safe, 500 vermir).
func parseDocJSONArray(raw datatypes.JSON) []map[string]interface{} {
	if len(raw) == 0 {
		return nil
	}
	var arr []map[string]interface{}
	if err := json.Unmarshal(raw, &arr); err != nil {
		return nil
	}
	return arr
}

// docItemTimestamp - sıralama üçün item-in tarix sahəsini (uploaded_at
// üstünlük, sonra created_at) mətn kimi qaytarır; yoxdursa boş sətir (ən
// köhnə kimi sıralanar).
func docItemTimestamp(item map[string]interface{}) string {
	for _, k := range []string{"uploaded_at", "created_at", "date"} {
		if v, ok := item[k]; ok {
			if s, ok := v.(string); ok && s != "" {
				return s
			}
		}
	}
	return ""
}

// ListDocuments - GET /sf/documents
// Bütün icazəli mənbələrdən (client/contract/task) faylları bir siyahıda
// birləşdirir. Query parametrləri: search, source_type (client|contract|task),
// client_id, contract_id.
func (h *Handler) ListDocuments(c *gin.Context) {
	db, err := h.tenantDB(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}

	ep := loadEffectivePerms(db, c)
	search := strings.ToLower(strings.TrimSpace(c.Query("search")))
	sourceFilter := c.Query("source_type")
	clientIDFilter := c.Query("client_id")
	contractIDFilter := c.Query("contract_id")

	var out []docSourceItem

	appendItems := func(raw []map[string]interface{}, sourceType string, sourceID uint, sourceTitle string, clientName string, contractTitle string) {
		for i, item := range raw {
			row := docSourceItem{}
			for k, v := range item {
				row[k] = v
			}
			row["source_type"] = sourceType
			row["source_id"] = sourceID
			row["source_title"] = sourceTitle
			if clientName != "" {
				row["client_name"] = clientName
			}
			if contractTitle != "" {
				row["contract_title"] = contractTitle
			}
			row["_row_id"] = sourceType + "-" + strconv.FormatUint(uint64(sourceID), 10) + "-" + strconv.Itoa(i)
			out = append(out, row)
		}
	}

	matchesSearch := func(name string) bool {
		if search == "" {
			return true
		}
		return strings.Contains(strings.ToLower(name), search)
	}

	// ---- 1) Müştəri sənədləri (Client.Documents) ----
	if (sourceFilter == "" || sourceFilter == "client") && ep.Allowed("view_clients") {
		q := db.Model(&Client{})
		if clientIDFilter != "" {
			q = q.Where("id = ?", clientIDFilter)
		}
		switch currentUserRole(c) {
		case "client":
			ids, ok := scopedClientIDs(db, c)
			if !ok {
				ids = []uint{0}
			}
			q = q.Where("id IN ?", ids)
		case "lawyer":
			if lawyerIDVal, ok := c.Get("lawyerID"); ok {
				q = q.Where("id IN ?", lawyerClientIDs(db, lawyerIDVal.(int)))
			}
		}
		var clients []Client
		q.Find(&clients)
		for _, cl := range clients {
			items := parseDocJSONArray(cl.Documents)
			var filtered []map[string]interface{}
			for _, it := range items {
				name, _ := it["name"].(string)
				if name == "" {
					name, _ = it["description"].(string)
				}
				if matchesSearch(name) {
					filtered = append(filtered, it)
				}
			}
			appendItems(filtered, "client", cl.ID, cl.Name, cl.Name, "")
		}
	}

	// ---- 2) Müqavilə sənədləri (Contract.Documents) ----
	if (sourceFilter == "" || sourceFilter == "contract") && ep.Allowed("view_contracts") {
		q := db.Model(&Contract{}).Preload("Client")
		if contractIDFilter != "" {
			q = q.Where("id = ?", contractIDFilter)
		}
		if clientIDFilter != "" {
			q = q.Where("client_id = ?", clientIDFilter)
		}
		if restrictedID := getRestrictedContractID(db, c); restrictedID != nil {
			q = q.Where("id = ?", *restrictedID)
		} else {
			switch currentUserRole(c) {
			case "client":
				ids, ok := scopedClientIDs(db, c)
				if !ok {
					ids = []uint{0}
				}
				q = q.Where("client_id IN ?", ids)
			case "lawyer":
				if lawyerIDVal, ok := c.Get("lawyerID"); ok {
					q = q.Where("id IN ?", lawyerContractIDs(db, lawyerIDVal.(int)))
				}
			}
		}
		var contracts []Contract
		q.Find(&contracts)
		for _, ct := range contracts {
			items := parseDocJSONArray(ct.Documents)
			var filtered []map[string]interface{}
			for _, it := range items {
				name, _ := it["name"].(string)
				if name == "" {
					name, _ = it["description"].(string)
				}
				if matchesSearch(name) {
					filtered = append(filtered, it)
				}
			}
			clientName := ""
			if ct.Client != nil {
				clientName = ct.Client.Name
			}
			appendItems(filtered, "contract", ct.ID, ct.Title, clientName, ct.Title)
		}
	}

	// ---- 3) Tapşırıq sənəd-checklisti (Task.DocumentChecklist) ----
	if (sourceFilter == "" || sourceFilter == "task") && ep.Allowed("view_tasks") {
		q := db.Model(&Task{}).Preload("Contract").Preload("Contract.Client").Preload("Client")
		if contractIDFilter != "" {
			q = q.Where("contract_id = ?", contractIDFilter)
		}
		if clientIDFilter != "" {
			q = q.Where("client_id = ?", clientIDFilter)
		}
		if restrictedID := getRestrictedContractID(db, c); restrictedID != nil {
			q = q.Where("contract_id = ?", *restrictedID)
		} else {
			switch currentUserRole(c) {
			case "client":
				ids, ok := scopedClientIDs(db, c)
				if !ok {
					ids = []uint{0}
				}
				q = q.Where("client_id IN ?", ids)
			case "lawyer":
				if lawyerIDVal, ok := c.Get("lawyerID"); ok {
					q = q.Where("assigned_to = ?", lawyerIDVal)
				}
			}
		}
		var tasks []Task
		q.Find(&tasks)
		for _, t := range tasks {
			items := parseDocJSONArray(t.DocumentChecklist)
			var filtered []map[string]interface{}
			for _, it := range items {
				// document_checklist-də hələ yüklənməmiş (sadəcə tələb olunan)
				// sənəd sətirləri də ola bilər — yalnız faktiki fayl (url/file_data
				// mövcud) olanlar "Sənədlər" siyahısına düşür.
				url, _ := it["url"].(string)
				fileData, _ := it["file_data"].(string)
				if url == "" && fileData == "" {
					continue
				}
				name, _ := it["name"].(string)
				if name == "" {
					name, _ = it["description"].(string)
				}
				if matchesSearch(name) {
					filtered = append(filtered, it)
				}
			}
			clientName := ""
			if t.Client != nil {
				clientName = t.Client.Name
			} else if t.Contract != nil && t.Contract.Client != nil {
				clientName = t.Contract.Client.Name
			}
			contractTitle := ""
			if t.Contract != nil {
				contractTitle = t.Contract.Title
			}
			// Qeyd: sənəd adı/URL-i maliyyə sahəsi deyil (view_amounts maskalaması
			// yalnız Value/ClaimAmount kimi rəqəmsal sahələrə aiddir), buna görə
			// bu blokda maskalama tətbiq edilmir — qəsdən, digər List* handler-lərlə
			// eyni "yalnız maliyyə rəqəmləri gizlədilir" qaydasına uyğundur.
			appendItems(filtered, "task", t.ID, t.Title, clientName, contractTitle)
		}
	}

	sort.SliceStable(out, func(i, j int) bool {
		return docItemTimestamp(out[i]) > docItemTimestamp(out[j])
	})

	if out == nil {
		out = []docSourceItem{}
	}
	c.JSON(200, out)
}
