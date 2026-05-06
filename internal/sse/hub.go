package sse

import "sync"

type Message struct {
	Event string
	Value any
}

type Hub struct {
	mu          sync.Mutex
	subscribers map[chan Message]struct{}
}

func NewHub() *Hub {
	return &Hub{subscribers: map[chan Message]struct{}{}}
}

func (h *Hub) Subscribe() (<-chan Message, func()) {
	ch := make(chan Message, 16)
	h.mu.Lock()
	h.subscribers[ch] = struct{}{}
	h.mu.Unlock()

	unsubscribe := func() {
		h.mu.Lock()
		if _, ok := h.subscribers[ch]; ok {
			delete(h.subscribers, ch)
			close(ch)
		}
		h.mu.Unlock()
	}
	return ch, unsubscribe
}

func (h *Hub) Broadcast(event string, value any) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.subscribers {
		select {
		case ch <- Message{Event: event, Value: value}:
		default:
		}
	}
}
