// Package singleinstance prevents more than one running copy of the app.
// It binds a TCP listener on localhost; if the port is already taken another
// instance is running and the caller should exit gracefully.
package singleinstance

import (
	"fmt"
	"net"
)

const lockPort = 37415

// Acquire tries to take the single-instance lock.
// Returns (release, true) on success or (noop, false) when already running.
func Acquire() (release func(), ok bool) {
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", lockPort))
	if err != nil {
		return func() {}, false
	}
	return func() { _ = ln.Close() }, true
}
