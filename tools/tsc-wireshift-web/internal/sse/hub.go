package sse

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
)

type Event struct {
	Event string
	Data  interface{}
}

type Hub struct {
	mu      sync.RWMutex
	clients map[chan Event]struct{}
}

func NewHub() *Hub {
	return &Hub{
		clients: make(map[chan Event]struct{}),
	}
}

func (h *Hub) Subscribe() chan Event {
	h.mu.Lock()
	defer h.mu.Unlock()
	ch := make(chan Event, 64)
	h.clients[ch] = struct{}{}
	return ch
}

func (h *Hub) Unsubscribe(ch chan Event) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients, ch)
	close(ch)
}

func (h *Hub) Emit(event string, data interface{}) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for ch := range h.clients {
		select {
		case ch <- Event{Event: event, Data: data}:
		default:
		}
	}
}

func (h *Hub) EmitJSON(event string, data interface{}) {
	js, err := json.Marshal(data)
	if err != nil {
		log.Printf("SSE marshal error: %v", err)
		return
	}
	h.Emit(event, string(js))
}

func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	ch := h.Subscribe()
	defer h.Unsubscribe(ch)

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case evt, ok := <-ch:
			if !ok {
				return
			}
			eventName := evt.Event
			dataStr := ""
			switch d := evt.Data.(type) {
			case string:
				dataStr = d
			default:
				b, _ := json.Marshal(d)
				dataStr = string(b)
			}
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", eventName, dataStr)
			flusher.Flush()
		}
	}
}
