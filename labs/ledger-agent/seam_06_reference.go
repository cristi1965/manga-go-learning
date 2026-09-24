//go:build !learner06

package ledgeragent

import "encoding/json"

func copyEventsAfter(events []Event, after int64) []Event {
	var out []Event
	for _, event := range events {
		if event.Sequence <= after {
			continue
		}
		copyEvent := event
		copyEvent.Data = append(json.RawMessage(nil), event.Data...)
		out = append(out, copyEvent)
	}
	return out
}
