package haloc

import (
	"testing"
	"time"

	"halo/internal/storage"
)

func TestMaintenanceStateAt(t *testing.T) {
	now := time.Date(2026, 5, 6, 12, 0, 0, 0, time.UTC)
	cases := []struct {
		name string
		win  storage.MaintenanceWindow
		want string
	}{
		{
			name: "scheduled",
			win: storage.MaintenanceWindow{
				State:    "scheduled",
				StartsAt: now.Add(time.Hour),
				EndsAt:   now.Add(2 * time.Hour),
			},
			want: "scheduled",
		},
		{
			name: "active by time",
			win: storage.MaintenanceWindow{
				State:    "scheduled",
				StartsAt: now.Add(-time.Minute),
				EndsAt:   now.Add(time.Hour),
			},
			want: "active",
		},
		{
			name: "completed by time",
			win: storage.MaintenanceWindow{
				State:    "scheduled",
				StartsAt: now.Add(-2 * time.Hour),
				EndsAt:   now.Add(-time.Hour),
			},
			want: "completed",
		},
		{
			name: "explicit completed wins",
			win: storage.MaintenanceWindow{
				State:    "completed",
				StartsAt: now.Add(-time.Minute),
				EndsAt:   now.Add(time.Hour),
			},
			want: "completed",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := maintenanceStateAt(tc.win, now); got != tc.want {
				t.Fatalf("maintenanceStateAt() = %q, want %q", got, tc.want)
			}
		})
	}
}
