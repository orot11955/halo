package web

import (
	"embed"
	"io/fs"
)

//go:embed dist
var dist embed.FS

func Dist() fs.FS {
	sub, err := fs.Sub(dist, "dist")
	if err != nil {
		panic(err)
	}
	return sub
}

func Index() ([]byte, error) {
	return dist.ReadFile("dist/index.html")
}
