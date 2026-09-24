//go:build !learner08

package ledgeragent

func reserveWorkerSlot(slots chan struct{}) bool {
	select {
	case slots <- struct{}{}:
		return true
	default:
		return false
	}
}
