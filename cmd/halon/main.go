package main

import (
	"os"

	"halo/internal/halon"
)

func main() {
	os.Exit(halon.RunCLI(os.Args[1:], os.Stdout, os.Stderr))
}
