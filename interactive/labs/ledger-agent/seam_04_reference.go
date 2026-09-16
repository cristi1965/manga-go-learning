//go:build !learner04

package ledgeragent

import (
	"errors"
	"path/filepath"
)

func validateToolPath(path string) error {
	if path == "" {
		return errors.New("path is required")
	}
	if filepath.IsAbs(path) {
		return errors.New("relative path is required")
	}
	return nil
}
