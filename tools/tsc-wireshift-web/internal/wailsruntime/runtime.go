package wailsruntime

import (
	"context"
	"encoding/json"
	"log"
	"sync"

	"tsc-wireshift-web/internal/sse"
)

var (
	hub *sse.Hub
	mu  sync.Mutex
)

func SetHub(h *sse.Hub) {
	mu.Lock()
	defer mu.Unlock()
	hub = h
}

func GetHub() *sse.Hub {
	mu.Lock()
	defer mu.Unlock()
	return hub
}

// EventsEmit sends an event through the SSE hub
// This mirrors the wails runtime.EventsEmit signature used by internal packages
func EventsEmit(ctx context.Context, eventName string, optionalData ...interface{}) {
	h := GetHub()
	if h == nil {
		return
	}

	var data interface{}
	if len(optionalData) == 0 {
		data = nil
	} else if len(optionalData) == 1 {
		data = optionalData[0]
	} else {
		data = optionalData
	}

	// Convert to JSON string for SSE
	js, err := json.Marshal(data)
	if err != nil {
		log.Printf("EventsEmit marshal error: %v", err)
		return
	}

	h.Emit(eventName, string(js))
}

// EventsOnce is a no-op stub for web mode
func EventsOnce(ctx context.Context, eventName string, callback func(optionalData ...interface{})) {
	log.Printf("EventsOnce stub called for: %s", eventName)
}

// BrowserOpenURL opens a URL in the browser
func BrowserOpenURL(ctx context.Context, url string) {
	log.Printf("BrowserOpenURL: %s", url)
}

// WindowExecJS is a no-op stub for web mode
func WindowExecJS(ctx context.Context, js string) {
	log.Printf("WindowExecJS stub called (not supported in web mode)")
}

// MessageDialog is a no-op stub for web mode
func MessageDialog(ctx context.Context, opts interface{}) {
	log.Printf("MessageDialog stub called")
}
