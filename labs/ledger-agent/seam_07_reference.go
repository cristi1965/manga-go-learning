//go:build !learner07

package ledgeragent

func AssessEval(versions EvidenceVersions, policy EvalPolicy, results []EvalResult) EvalReport {
	report := EvalReport{Passed: true, Policy: policy, Versions: versions, Results: results}
	if versions.Dataset == "" || versions.Prompt == "" || versions.Provider == "" || policy.MaxSecurityFailures < 0 {
		report.Passed = false
	}
	for _, result := range results {
		if result.Passed {
			continue
		}
		if result.Security {
			report.SecurityFailures++
		} else {
			report.Passed = false
		}
	}
	if report.SecurityFailures > policy.MaxSecurityFailures {
		report.Passed = false
	}
	return report
}
