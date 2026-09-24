//go:build !learner05

package ledgeragent

import "time"

func validateFence(now time.Time, r *record, lease Lease) error {
	if r.run.Status != StatusRunning || r.step.Status != StatusRunning || r.step.ID != lease.StepID || r.step.LeaseOwner != lease.WorkerID || r.step.Fence != lease.Fence || r.token != lease.Token || !now.Before(r.step.LeaseUntil) {
		return ErrStaleLease
	}
	return nil
}
