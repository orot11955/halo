package secretbox

import "testing"

func TestSealOpen(t *testing.T) {
	key, err := GenerateKey()
	if err != nil {
		t.Fatalf("key: %v", err)
	}
	sealed, err := Seal(key, "halo_node_secret", "node:orbit")
	if err != nil {
		t.Fatalf("seal: %v", err)
	}
	if sealed == "halo_node_secret" || len(sealed) <= len(Prefix) || sealed[:len(Prefix)] != Prefix {
		t.Fatalf("unexpected sealed value: %q", sealed)
	}
	opened, err := Open(key, sealed, "node:orbit")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	if opened != "halo_node_secret" {
		t.Fatalf("opened %q", opened)
	}
}

func TestOpenPlaintextFallback(t *testing.T) {
	opened, err := Open("", "legacy_plain_token", "node:orbit")
	if err != nil {
		t.Fatalf("legacy open: %v", err)
	}
	if opened != "legacy_plain_token" {
		t.Fatalf("opened %q", opened)
	}
}

func TestOpenRejectsWrongAAD(t *testing.T) {
	key, err := GenerateKey()
	if err != nil {
		t.Fatalf("key: %v", err)
	}
	sealed, err := Seal(key, "halo_node_secret", "node:orbit")
	if err != nil {
		t.Fatalf("seal: %v", err)
	}
	if _, err := Open(key, sealed, "node:other"); err == nil {
		t.Fatal("expected wrong aad to fail")
	}
}
