package main

import (
	"os"

	"halo/internal/haloc"
)

func main() {
	os.Exit(haloc.RunCLI(os.Args[1:], os.Stdout, os.Stderr))
}
