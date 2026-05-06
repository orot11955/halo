package domaincheck

import (
	"context"
	"crypto/tls"
	"io"
	"math"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Report struct {
	DNS  DNSReport  `json:"dns"`
	HTTP HTTPReport `json:"http"`
	SSL  SSLReport  `json:"ssl"`
}

type DNSReport struct {
	Host            string   `json:"host"`
	ResolvedIPs     []string `json:"resolved_ips"`
	ExpectedIP      string   `json:"expected_ip,omitempty"`
	ExpectedIPMatch *bool    `json:"expected_ip_match,omitempty"`
	ErrorMessage    string   `json:"error_message,omitempty"`
}

type HTTPReport struct {
	HTTPStatus          int      `json:"http_status,omitempty"`
	HTTPSStatus         int      `json:"https_status,omitempty"`
	HTTPResponseTimeMS  int64    `json:"http_response_time_ms,omitempty"`
	HTTPSResponseTimeMS int64    `json:"https_response_time_ms,omitempty"`
	HTTPRedirect        bool     `json:"http_redirect"`
	HTTPSRedirect       bool     `json:"https_redirect"`
	HTTPRedirectChain   []string `json:"http_redirect_chain,omitempty"`
	HTTPSRedirectChain  []string `json:"https_redirect_chain,omitempty"`
	ErrorMessage        string   `json:"error_message,omitempty"`
}

type SSLReport struct {
	Host          string     `json:"host"`
	Issuer        string     `json:"issuer,omitempty"`
	Subject       string     `json:"subject,omitempty"`
	SAN           []string   `json:"san,omitempty"`
	ExpiresAt     *time.Time `json:"expires_at,omitempty"`
	DaysRemaining int        `json:"days_remaining,omitempty"`
	Warning       bool       `json:"warning"`
	Critical      bool       `json:"critical"`
	ErrorMessage  string     `json:"error_message,omitempty"`
}

func Check(ctx context.Context, name string, expectedIP string) Report {
	target := normalizeTarget(name)
	report := Report{}
	report.DNS = checkDNS(ctx, target.Hostname, expectedIP)
	report.HTTP = checkHTTP(ctx, target)
	report.SSL = checkSSL(ctx, target)
	return report
}

type target struct {
	Host     string
	Hostname string
	HTTPURL  string
	HTTPSURL string
	TLSAddr  string
}

func normalizeTarget(name string) target {
	raw := strings.TrimSpace(name)
	host := raw
	if parsed, err := url.Parse(raw); err == nil && parsed.Host != "" {
		host = parsed.Host
	}

	hostname := hostOnly(host)
	return target{
		Host:     host,
		Hostname: hostname,
		HTTPURL:  "http://" + host,
		HTTPSURL: "https://" + host,
		TLSAddr:  tlsAddress(host),
	}
}

func checkDNS(ctx context.Context, host string, expectedIP string) DNSReport {
	report := DNSReport{Host: host, ExpectedIP: expectedIP}
	if host == "" {
		report.ErrorMessage = "host is empty"
		return report
	}
	if ip := net.ParseIP(host); ip != nil {
		report.ResolvedIPs = []string{ip.String()}
		setExpectedIPMatch(&report)
		return report
	}

	ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		report.ErrorMessage = err.Error()
		return report
	}
	for _, ip := range ips {
		report.ResolvedIPs = append(report.ResolvedIPs, ip.IP.String())
	}
	setExpectedIPMatch(&report)
	return report
}

func setExpectedIPMatch(report *DNSReport) {
	if report.ExpectedIP == "" {
		return
	}
	match := false
	for _, ip := range report.ResolvedIPs {
		if ip == report.ExpectedIP {
			match = true
			break
		}
	}
	report.ExpectedIPMatch = &match
}

func checkHTTP(ctx context.Context, target target) HTTPReport {
	report := HTTPReport{}

	httpResult := request(ctx, target.HTTPURL)
	report.HTTPStatus = httpResult.Status
	report.HTTPResponseTimeMS = httpResult.ResponseTimeMS
	report.HTTPRedirect = len(httpResult.RedirectChain) > 0
	report.HTTPRedirectChain = httpResult.RedirectChain

	httpsResult := request(ctx, target.HTTPSURL)
	report.HTTPSStatus = httpsResult.Status
	report.HTTPSResponseTimeMS = httpsResult.ResponseTimeMS
	report.HTTPSRedirect = len(httpsResult.RedirectChain) > 0
	report.HTTPSRedirectChain = httpsResult.RedirectChain

	errors := []string{}
	if httpResult.ErrorMessage != "" {
		errors = append(errors, "http: "+httpResult.ErrorMessage)
	}
	if httpsResult.ErrorMessage != "" {
		errors = append(errors, "https: "+httpsResult.ErrorMessage)
	}
	report.ErrorMessage = strings.Join(errors, "; ")
	return report
}

type requestResult struct {
	Status         int
	ResponseTimeMS int64
	RedirectChain  []string
	ErrorMessage   string
}

func request(ctx context.Context, rawURL string) requestResult {
	var chain []string
	client := &http.Client{
		Timeout: 6 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			chain = append(chain, req.URL.String())
			if len(via) >= 10 {
				return http.ErrUseLastResponse
			}
			return nil
		},
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return requestResult{ErrorMessage: err.Error()}
	}
	started := time.Now()
	resp, err := client.Do(req)
	if err != nil {
		return requestResult{ResponseTimeMS: elapsedMS(started), RedirectChain: chain, ErrorMessage: err.Error()}
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	return requestResult{
		Status:         resp.StatusCode,
		ResponseTimeMS: elapsedMS(started),
		RedirectChain:  chain,
	}
}

func checkSSL(ctx context.Context, target target) SSLReport {
	report := SSLReport{Host: target.Host}
	serverName := target.Hostname
	if net.ParseIP(serverName) != nil {
		serverName = ""
	}

	dialer := tls.Dialer{
		Config: &tls.Config{
			InsecureSkipVerify: true,
			ServerName:         serverName,
		},
	}
	conn, err := dialer.DialContext(ctx, "tcp", target.TLSAddr)
	if err != nil {
		report.ErrorMessage = err.Error()
		report.Warning = true
		report.Critical = true
		return report
	}
	defer conn.Close()

	tlsConn, ok := conn.(*tls.Conn)
	if !ok {
		report.ErrorMessage = "connection is not TLS"
		report.Warning = true
		report.Critical = true
		return report
	}
	state := tlsConn.ConnectionState()
	if len(state.PeerCertificates) == 0 {
		report.ErrorMessage = "no peer certificate"
		report.Warning = true
		report.Critical = true
		return report
	}

	cert := state.PeerCertificates[0]
	report.Issuer = cert.Issuer.String()
	report.Subject = cert.Subject.String()
	report.SAN = append(report.SAN, cert.DNSNames...)
	for _, ip := range cert.IPAddresses {
		report.SAN = append(report.SAN, ip.String())
	}
	expiresAt := cert.NotAfter.UTC()
	report.ExpiresAt = &expiresAt
	report.DaysRemaining = int(math.Ceil(time.Until(expiresAt).Hours() / 24))
	report.Warning = report.DaysRemaining <= 30
	report.Critical = report.DaysRemaining <= 7
	return report
}

func hostOnly(host string) string {
	if strings.HasPrefix(host, "[") {
		if parsed, _, err := net.SplitHostPort(host); err == nil {
			return strings.Trim(parsed, "[]")
		}
		return strings.Trim(host, "[]")
	}
	if parsed, _, err := net.SplitHostPort(host); err == nil {
		return parsed
	}
	return host
}

func tlsAddress(host string) string {
	if _, _, err := net.SplitHostPort(host); err == nil {
		return host
	}
	return net.JoinHostPort(host, "443")
}

func elapsedMS(started time.Time) int64 {
	return time.Since(started).Milliseconds()
}
