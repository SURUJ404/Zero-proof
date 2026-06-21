package main

import (
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"tsc-wireshift-web/internal/sse"
	"tsc-wireshift-web/internal/wailsruntime"

	fuzzer2 "tsc-wireshift-web/internal/fuzzer"
	"tsc-wireshift-web/internal/history"
	listener2 "tsc-wireshift-web/internal/listener"
	llm2 "tsc-wireshift-web/internal/llm"
	logger2 "tsc-wireshift-web/internal/logger"
	matchreplace "tsc-wireshift-web/internal/matchreplace"
	"tsc-wireshift-web/internal/plugins"
	"tsc-wireshift-web/internal/projects"
	proxy2 "tsc-wireshift-web/internal/proxy"
	resender2 "tsc-wireshift-web/internal/resender"
	"tsc-wireshift-web/internal/rules"
	"tsc-wireshift-web/internal/scope"
	"tsc-wireshift-web/internal/settings"
	"tsc-wireshift-web/internal/sitemap"
	storage2 "tsc-wireshift-web/internal/storage"

	_ "github.com/mattn/go-sqlite3"
)

//go:embed frontend/dist/*
var frontendAssets embed.FS

type Server struct {
	db             *sql.DB
	dbMutex        sync.RWMutex
	hub            *sse.Hub
	historyClient  *history.Client
	pluginsClient  *plugins.Client
	rulesClient    *rules.Client
	mrClient       *matchreplace.Client
	scopeClient    *scope.Client
	sitemapClient  *sitemap.Client
	settingsClient *settings.Client
	projectsClient *projects.Client
	fuzzer         *fuzzer2.Fuzzer
	resender       *resender2.Resender
	llmClient      *llm2.Client
	listener       *listener2.Client
	logger         *logger2.Logger
	proxy          *proxy2.Proxy
	requestStorage *storage2.RequestStorage
}

func main() {
	configDir, err := os.UserConfigDir()
	if err != nil {
		log.Fatalf("Failed to get config dir: %v", err)
	}
	appDataDir := filepath.Join(configDir, "TSC-Wireshift-Web")
	os.MkdirAll(appDataDir, 0755)
	dbPath := filepath.Join(appDataDir, "default_project.db")

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		log.Fatalf("Failed to open DB: %v", err)
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)

	hub := sse.NewHub()
	wailsruntime.SetHub(hub)

	s := &Server{
		db:  db,
		hub: hub,
	}

	s.initClients()

	mux := http.NewServeMux()

	// API routes
	mux.HandleFunc("/api/events", s.hub.ServeHTTP)
	mux.HandleFunc("/api/event", s.handleEventBridge)

	mux.HandleFunc("/api/requests", s.handleRequests)
	mux.HandleFunc("/api/requests/", s.handleRequestByID)
	mux.HandleFunc("/api/scope", s.handleScope)
	mux.HandleFunc("/api/settings", s.handleSettings)
	mux.HandleFunc("/api/rules", s.handleRules)
	mux.HandleFunc("/api/match-replace", s.handleMatchReplace)
	mux.HandleFunc("/api/plugins", s.handlePlugins)
	mux.HandleFunc("/api/sitemap/domains", s.handleDomains)
	mux.HandleFunc("/api/sitemap/", s.handleSitemap)
	mux.HandleFunc("/api/projects", s.handleProjects)

	// Serve frontend (SPA with fallback)
	var staticFS http.FileSystem
	sub, err := fs.Sub(frontendAssets, "frontend/dist")
	if err != nil {
		log.Printf("Embedded frontend not found, trying local dist/ directory")
		if info, statErr := os.Stat("frontend/dist"); statErr == nil && info.IsDir() {
			staticFS = http.Dir("frontend/dist")
		} else {
			log.Fatal("No frontend build found. Run: cd frontend && npx vite build")
		}
	} else {
		staticFS = http.FS(sub)
	}
	mux.Handle("/", s.SPAHandler(staticFS))

	port := "8081"
	if p := os.Getenv("PORT"); p != "" {
		port = p
	}
	log.Printf("TSC-Wireshift-Web server starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, corsMiddleware(mux)))
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) initClients() {
	var err error

	s.historyClient, err = history.NewClient(s.db)
	if err != nil {
		log.Fatalf("history client: %v", err)
	}

	s.pluginsClient, err = plugins.NewClient(s.db)
	if err != nil {
		log.Fatalf("plugins client: %v", err)
	}

	s.rulesClient, err = rules.NewClient(s.db)
	if err != nil {
		log.Fatalf("rules client: %v", err)
	}

	s.mrClient, err = matchreplace.NewClient(s.db)
	if err != nil {
		log.Fatalf("matchreplace client: %v", err)
	}

	s.scopeClient, err = scope.NewClient(s.db)
	if err != nil {
		log.Fatalf("scope client: %v", err)
	}

	s.sitemapClient, err = sitemap.NewClient(s.db)
	if err != nil {
		log.Fatalf("sitemap client: %v", err)
	}

	s.settingsClient, err = settings.NewClient(s.db)
	if err != nil {
		log.Fatalf("settings client: %v", err)
	}

	s.projectsClient = projects.NewClient(nil, s.db, &s.dbMutex)

	// Initialize request storage
	s.requestStorage = storage2.NewRequestStorage(s.db, &s.dbMutex)

	// Initialize logger
	s.logger = logger2.NewLogger(s.db, context.Background(), nil)
	if err := s.logger.EnsureLogsTableExists(); err != nil {
		log.Printf("Failed to create logs table: %v", err)
	}

	// Load settings
	settings, err := s.settingsClient.LoadSettings()
	if err != nil {
		log.Fatalf("Failed to load settings: %v", err)
	}

	// Initialize LLM client
	s.llmClient = llm2.NewClient(context.Background(), s.db)

	// Initialize fuzzer
	s.fuzzer = fuzzer2.NewFuzzer(context.Background(), s.db)

	// Initialize resender
	s.resender = resender2.NewResender(context.Background(), s.db, s.requestStorage)

	// Initialize listener
	s.listener = listener2.NewClient(context.Background(), settings.InteractshHost, settings.InteractshPort)
	s.listener.GenerateKeys()

	// Initialize proxy
	s.proxy = proxy2.NewProxy()
	if err := s.proxy.SetupCertificates(); err != nil {
		log.Printf("Failed to setup certificates: %v", err)
	}
	s.proxy.SetupHandlers()

	// Setup proxy handlers (no actual request/response handling in web mode yet)
	// s.proxy.HandleRequest(...)
	// s.proxy.HandleResponse(...)

	log.Printf("All services initialized")
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func jsonOK(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

// ---- Request History ----

func (s *Server) handleRequests(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 {
		limit = 50
	}
	sortKey := r.URL.Query().Get("sortKey")
	if sortKey == "" {
		sortKey = "id"
	}
	sortDir := r.URL.Query().Get("sortDirection")
	if sortDir == "" {
		sortDir = "descending"
	}
	searchQuery := r.URL.Query().Get("search")

	requests, pagination, err := s.historyClient.GetAllRequests(page, limit, sortKey, sortDir, searchQuery)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]interface{}{
		"requests":   requests,
		"pagination": pagination,
	})
}

func (s *Server) handleRequestByID(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/requests/")
	if id == "" {
		jsonError(w, "missing request ID", http.StatusBadRequest)
		return
	}

	details, err := s.historyClient.GetRequestByID(id)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOK(w, details)
}

// ---- Scope ----

func (s *Server) handleScope(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		inScope, outScope := s.scopeClient.GetScopeLists()
		jsonOK(w, map[string]interface{}{
			"inScope":    inScope,
			"outOfScope": outScope,
		})

	case "PUT":
		var data struct {
			InScope    []string `json:"inScope"`
			OutOfScope []string `json:"outOfScope"`
		}
		if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
			jsonError(w, "invalid data", http.StatusBadRequest)
			return
		}
		if data.InScope != nil {
			s.scopeClient.UpdateInScopeList(data.InScope)
		}
		if data.OutOfScope != nil {
			s.scopeClient.UpdateOutScopeList(data.OutOfScope)
		}
		inScope, outScope := s.scopeClient.GetScopeLists()
		jsonOK(w, map[string]interface{}{
			"inScope":    inScope,
			"outOfScope": outScope,
		})

	default:
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// ---- Settings ----

func (s *Server) handleSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		settings, err := s.settingsClient.LoadSettings()
		if err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonOK(w, settings)

	case "PUT":
		var data map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
			jsonError(w, "invalid data", http.StatusBadRequest)
			return
		}
		st := &settings.Settings{
			ID:             int(getFloat(data, "id")),
			ProjectName:    getString(data, "project_name"),
			OpenAIAPIURL:   getString(data, "openai_api_url"),
			OpenAIAPIKey:   getString(data, "openai_api_key"),
			LLMModel:       getString(data, "llm_model"),
			ProxyPort:      getString(data, "proxy_port"),
			InteractshHost: getString(data, "interactsh_host"),
			InteractshPort: int(getFloat(data, "interactsh_port")),
		}
		if err := s.settingsClient.UpdateSettings(st); err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonOK(w, map[string]bool{"success": true})

	default:
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// ---- Rules ----

func (s *Server) handleRules(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		rules, err := s.rulesClient.GetAllRules()
		if err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonOK(w, map[string]interface{}{"rules": rules})

	case "POST":
		var data map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
			jsonError(w, "invalid data", http.StatusBadRequest)
			return
		}
		rule := rules.Rule{
			RuleName:     getString(data, "RuleName"),
			Operator:     getString(data, "Operator"),
			MatchType:    getString(data, "MatchType"),
			Relationship: getString(data, "Relationship"),
			Pattern:      getString(data, "Pattern"),
			Enabled:      getBool(data, "Enabled"),
		}
		if err := s.rulesClient.AddRule(rule); err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonOK(w, map[string]bool{"success": true})

	case "DELETE":
		idStr := r.URL.Query().Get("id")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			jsonError(w, "invalid id", http.StatusBadRequest)
			return
		}
		s.rulesClient.DeleteRule(id)
		jsonOK(w, map[string]bool{"success": true})

	default:
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// ---- Match Replace ----

func (s *Server) handleMatchReplace(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		rules, err := s.mrClient.GetAllRules()
		if err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonOK(w, map[string]interface{}{"rules": rules})

	case "POST":
		var data map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
			jsonError(w, "invalid data", http.StatusBadRequest)
			return
		}
		rule := matchreplace.Rule{
			RuleName:       getString(data, "RuleName"),
			MatchType:      getString(data, "MatchType"),
			MatchContent:   getString(data, "MatchContent"),
			ReplaceContent: getString(data, "ReplaceContent"),
			Target:         getString(data, "Target"),
			Enabled:        getBool(data, "Enabled"),
		}
		if err := s.mrClient.AddRule(rule); err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonOK(w, map[string]bool{"success": true})

	case "PUT":
		var data map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
			jsonError(w, "invalid data", http.StatusBadRequest)
			return
		}
		rule := matchreplace.Rule{
			ID:             int(getFloat(data, "id")),
			RuleName:       getString(data, "rule_name"),
			MatchType:      getString(data, "match_type"),
			MatchContent:   getString(data, "match_content"),
			ReplaceContent: getString(data, "replace_content"),
			Target:         getString(data, "target"),
			Enabled:        getBool(data, "enabled"),
		}
		if err := s.mrClient.UpdateRule(rule); err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonOK(w, map[string]bool{"success": true})

	case "DELETE":
		idStr := r.URL.Query().Get("id")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			jsonError(w, "invalid id", http.StatusBadRequest)
			return
		}
		s.mrClient.DeleteRule(id)
		jsonOK(w, map[string]bool{"success": true})

	default:
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// ---- Plugins ----

func (s *Server) handlePlugins(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		plugins, err := s.pluginsClient.LoadPlugins()
		if err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonOK(w, plugins)

	case "POST":
		var data struct {
			Data string `json:"data"`
		}
		plugin, err := s.pluginsClient.SavePlugin(data.Data)
		if err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonOK(w, plugin)

	case "PUT":
		var data struct {
			Data string `json:"data"`
		}
		plugin, err := s.pluginsClient.UpdatePlugin(data.Data)
		if err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonOK(w, plugin)

	case "DELETE":
		idStr := r.URL.Query().Get("id")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			jsonError(w, "invalid id", http.StatusBadRequest)
			return
		}
		s.pluginsClient.DeletePlugin(id)
		jsonOK(w, map[string]bool{"success": true})

	default:
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// ---- Sitemap ----

func (s *Server) handleDomains(w http.ResponseWriter, r *http.Request) {
	domains, err := s.sitemapClient.GetDomains()
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]interface{}{"domains": domains})
}

func (s *Server) handleSitemap(w http.ResponseWriter, r *http.Request) {
	domain := strings.TrimPrefix(r.URL.Path, "/api/sitemap/")
	if domain == "" {
		jsonError(w, "missing domain", http.StatusBadRequest)
		return
	}

	path := r.URL.Query().Get("path")
	if path != "" {
		reqs, err := s.sitemapClient.GetRequestsByEndpoint(domain, path)
		if err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonOK(w, map[string]interface{}{"requests": reqs})
		return
	}

	root, err := s.sitemapClient.GetSiteMap(domain)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]interface{}{"Sitemap": root})
}

// ---- Projects ----

func (s *Server) handleProjects(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		projects, err := s.projectsClient.ListProjects()
		if err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonOK(w, map[string]interface{}{"projects": projects})

	default:
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// ---- SPA Handler ----

func (s *Server) SPAHandler(fsys http.FileSystem) http.Handler {
	fileServer := http.FileServer(fsys)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip API routes
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}

		path := r.URL.Path
		if path == "/" {
			path = "/index.html"
		}

		f, err := fsys.Open(path)
		if err == nil {
			f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}

		// SPA fallback: serve index.html for all other routes
		index, err := fsys.Open("/index.html")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		index.Close()

		r2 := *r
		r2.URL.Path = "/index.html"
		fileServer.ServeHTTP(w, &r2)
	})
}

// ---- Event Bridge ----

func (s *Server) handleEventBridge(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var msg struct {
		Event string      `json:"event"`
		Data  interface{} `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	log.Printf("Event bridge: %s", msg.Event)

	// Extract data as map or string
	dataMap, _ := msg.Data.(map[string]interface{})
	dataStr, _ := msg.Data.(string)

	switch msg.Event {

	case "frontend:approveRequest":
		log.Printf("Approve request (proxy not active in web mode): %+v", msg.Data)

	case "frontend:getCurrentVersion":
		jsonOK(w, map[string]string{"version": "1.2.0-web"})

	case "frontend:getLogs":
		logs := s.logger.GetRecentLogs(map[string]interface{}{"page": 1, "limit": 50})
		s.hub.EmitJSON("backend:logs", logs)

	case "frontend:getTrafficData":
		s.hub.EmitJSON("backend:trafficData", map[string]string{"info": "Traffic data available via /api/requests"})

	case "frontend:getInterceptionState":
		state := s.proxy.GetInterceptionState()
		s.hub.EmitJSON("backend:interceptionState", state)

	case "frontend:toggleInterception":
		newState := s.proxy.ToggleInterception()
		s.hub.EmitJSON("backend:interceptionToggled", newState)

	case "frontend:listProjects":
		projects, err := s.projectsClient.ListProjects()
		if err != nil {
			s.hub.EmitJSON("backend:listProjects", map[string]string{"error": err.Error()})
		} else {
			s.hub.EmitJSON("backend:listProjects", map[string]interface{}{"projects": projects})
		}

	case "frontend:switchProject":
		if dataStr != "" {
			s.hub.EmitJSON("backend:clearState", nil)
			s.hub.EmitJSON("backend:switchProject", map[string]interface{}{"success": true, "project": dataStr})
		}

	case "frontend:createNewProject":
		if dataStr != "" {
			if err := s.projectsClient.CreateNewProject(dataStr); err != nil {
				s.hub.EmitJSON("backend:switchProject", map[string]string{"error": err.Error()})
				break
			}
		}
		s.hub.EmitJSON("backend:switchProject", map[string]bool{"success": true})

	// ---- LLM / Chat ----
	case "frontend:getChatContexts":
		contexts, err := s.llmClient.GetChatContexts()
		if err != nil {
			log.Printf("Failed to get chat contexts: %v", err)
		} else {
			s.hub.EmitJSON("backend:chatContexts", contexts)
		}

	case "frontend:createChatContext":
		requestStr := ""
		if dataStr != "" {
			requestStr = dataStr
		}
		id, err := s.llmClient.CreateChatContext(requestStr)
		if err != nil {
			log.Printf("Failed to create chat context: %v", err)
			s.hub.EmitJSON("backend:error", map[string]interface{}{"error": err.Error()})
		} else {
			s.hub.EmitJSON("backend:chatContextCreated", map[string]interface{}{"id": id, "name": fmt.Sprintf("Chat %d", id)})
		}

	case "frontend:getChatMessages":
		chatId := 0
		if id, ok := msg.Data.(float64); ok {
			chatId = int(id)
		} else if id, ok := getFloat64(dataMap, "chatContextId"); ok {
			chatId = int(id)
		}
		if chatId > 0 {
			messages, err := s.llmClient.GetChatMessages(chatId)
			if err != nil {
				log.Printf("Failed to get messages: %v", err)
			} else {
				s.hub.EmitJSON("backend:chatMessages", map[string]interface{}{"chatContextId": chatId, "messages": messages})
			}
		}

	case "frontend:sendMessage":
		if dataMap != nil {
			settings, _ := s.settingsClient.LoadSettings()
			settingsMap := map[string]interface{}{
				"OpenAIAPIURL": settings.OpenAIAPIURL,
				"OpenAIAPIKey": settings.OpenAIAPIKey,
				"LLMModel":     settings.LLMModel,
			}
			if err := s.llmClient.SendMessage(dataMap, settingsMap); err != nil {
				log.Printf("Failed to send message: %v", err)
				s.hub.EmitJSON("backend:error", map[string]interface{}{"error": err.Error()})
			}
		}

	case "frontend:deleteChatContext":
		id := extractFloat64(msg.Data, 0)
		if id > 0 {
			s.llmClient.DeleteChatContext(int(id))
			s.hub.EmitJSON("backend:chatContextDeleted", map[string]interface{}{"id": int(id)})
		}

	case "frontend:editChatContextName":
		chatId := extractFloat64(msg.Data, 0)
		newName := extractString(msg.Data, 1)
		if chatId > 0 {
			s.llmClient.EditChatContextName(int(chatId), newName)
			s.hub.EmitJSON("backend:chatContextNameUpdated", map[string]interface{}{"id": int(chatId), "newName": newName})
		}

	// ---- Fuzzer ----
	case "frontend:getFuzzerTabs":
		tabs := s.fuzzer.GetFuzzerTabs()
		s.hub.EmitJSON("backend:FuzzerTabs", tabs)

	case "frontend:addFuzzerTab":
		if dataMap != nil {
			s.fuzzer.AddFuzzerTab(dataMap)
		}

	case "frontend:removeFuzzerTab":
		id := extractFloat64(msg.Data, 0)
		if id > 0 {
			s.fuzzer.RemoveFuzzerTab(int(id))
		}

	case "frontend:updateFuzzerTab":
		if dataMap != nil {
			s.fuzzer.UpdateFuzzerTab(dataMap)
		}

	case "frontend:updateFuzzerTabName":
		if dataMap != nil {
			tabId, _ := dataMap["tabId"].(float64)
			newName, _ := dataMap["newName"].(string)
			s.fuzzer.UpdateFuzzerTabName(tabId, newName)
		} else if arr, ok := msg.Data.([]interface{}); ok && len(arr) >= 2 {
			tabId, _ := arr[0].(float64)
			newName, _ := arr[1].(string)
			s.fuzzer.UpdateFuzzerTabName(tabId, newName)
		}

	case "frontend:startFuzzer":
		if dataMap != nil {
			s.fuzzer.StartFuzzer(dataMap)
		}

	case "frontend:sendToFuzzer":
		if dataMap != nil {
			s.fuzzer.AddFuzzerTab(dataMap)
		}

	case "frontend:stopFuzzer":
		s.fuzzer.StopFuzzer()

	// ---- Resender ----
	case "frontend:sendToResender":
		if dataMap != nil {
			s.resender.SendToResender(dataMap)
		}

	case "frontend:getResenderTabs":
		tabs, err := s.resender.GetTabs()
		if err != nil {
			log.Printf("Failed to get resender tabs: %v", err)
		} else {
			s.hub.EmitJSON("backend:resenderTabs", tabs)
		}

	case "frontend:createNewResenderTab":
		if dataMap != nil {
			s.resender.CreateNewTab(dataMap)
		}

	case "frontend:deleteResenderTab":
		id := extractFloat64(msg.Data, 0)
		if id > 0 {
			s.resender.DeleteTab(int(id))
		}

	case "frontend:updateResenderTabName":
		if dataMap != nil {
			tabID, _ := dataMap["tabId"].(float64)
			newName := getStr(dataMap, "newName")
			s.resender.UpdateTabName(int(tabID), newName)
		} else if arr, ok := msg.Data.([]interface{}); ok && len(arr) >= 2 {
			tabID, _ := arr[0].(float64)
			newName, _ := arr[1].(string)
			s.resender.UpdateTabName(int(tabID), newName)
		}

	case "frontend:sendResenderRequest":
		if dataMap != nil {
			tabId, _ := dataMap["tabId"].(float64)
			details, _ := dataMap["request"].(map[string]interface{})
			if details != nil {
				s.resender.SendRequest(tabId, details)
			}
		}

	case "frontend:cancelResenderRequest":
		id := extractFloat64(msg.Data, 0)
		if id > 0 {
			s.resender.CancelRequest(int(id))
		}

	case "frontend:getResenderRequest":
		id := extractFloat64(msg.Data, 0)
		if id > 0 {
			s.resender.GetRequest(int(id))
		}

	// ---- Listener ----
	case "frontend:startListening":
		s.listener.StartListening()
		s.logger.LogMessage("info", "Starting Interactsh listener", "Interactsh")

	case "frontend:stopListening":
		s.listener.StopListening()
		s.logger.LogMessage("info", "Stopping Interactsh listener", "Interactsh")

	case "frontend:generateNewDomain":
		s.listener.GenerateNewDomain()

	case "frontend:getInteractshHost":
		s.listener.GetInteractshHost()

	// ---- Auth/Plugins ----
	case "frontend:savePlugin":
		if dataStr != "" {
			plugin, err := s.pluginsClient.SavePlugin(dataStr)
			if err != nil {
				log.Printf("Failed to save plugin: %v", err)
			} else {
				s.hub.EmitJSON("pluginSaved", plugin)
			}
		}

	case "frontend:updatePlugin":
		if dataStr != "" {
			plugin, err := s.pluginsClient.UpdatePlugin(dataStr)
			if err != nil {
				log.Printf("Failed to update plugin: %v", err)
			} else {
				s.hub.EmitJSON("pluginUpdated", plugin)
			}
		}

	case "frontend:deletePlugin":
		if id, ok := msg.Data.(float64); ok {
			s.pluginsClient.DeletePlugin(int(id))
			s.hub.EmitJSON("pluginDeleted", int(id))
		}

	case "frontend:checkForUpdates":
		s.hub.EmitJSON("backend:updateCheck", map[string]interface{}{"current": "1.2.0-web", "latest": "1.2.0"})

	default:
		log.Printf("Unhandled event: %s", msg.Event)
	}

	jsonOK(w, map[string]string{"status": "ok"})
}

// ---- Helpers ----

func getStr(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
		return fmt.Sprintf("%v", v)
	}
	return ""
}

func getFloat64(m map[string]interface{}, key string) (float64, bool) {
	if v, ok := m[key]; ok {
		switch n := v.(type) {
		case float64:
			return n, true
		case int:
			return float64(n), true
		}
	}
	return 0, false
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
		return fmt.Sprintf("%v", v)
	}
	return ""
}

func getFloat(m map[string]interface{}, key string) float64 {
	if v, ok := m[key]; ok {
		switch n := v.(type) {
		case float64:
			return n
		case int:
			return float64(n)
		}
	}
	return 0
}

func extractFloat64(data interface{}, index int) float64 {
	if v, ok := data.(float64); ok {
		return v
	}
	if arr, ok := data.([]interface{}); ok && len(arr) > index {
		if v, ok := arr[index].(float64); ok {
			return v
		}
	}
	if m, ok := data.(map[string]interface{}); ok {
		keys := []string{"id", "tabId", "chatContextId", "tabID", "requestID"}
		for _, k := range keys {
			if v, ok := m[k]; ok {
				if f, ok := v.(float64); ok {
					return f
				}
			}
		}
	}
	return 0
}

func extractString(data interface{}, index int) string {
	if v, ok := data.(string); ok {
		return v
	}
	if arr, ok := data.([]interface{}); ok && len(arr) > index {
		if v, ok := arr[index].(string); ok {
			return v
		}
	}
	return ""
}

func getBool(m map[string]interface{}, key string) bool {
	if v, ok := m[key]; ok {
		if b, ok := v.(bool); ok {
			return b
		}
	}
	return false
}
