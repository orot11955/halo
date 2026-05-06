# halo-engine 최종 설계안

## 0. 문서 목적

`halo-engine`은 개인 홈서버와 내부 인프라를 관리하기 위한 Go 기반 core-node 관리 엔진이다.

목표는 단순한 리소스 모니터링 도구가 아니라, 홈서버와 내부망의 상태를 수집하고 저장하며, Web UI에서 운영 상황을 한눈에 확인할 수 있는 개인 인프라 운영 콘솔을 만드는 것이다.

## 0.1 현재 점검 결과와 고도화 기준

2026-05-06 기준 실제 구현은 이 문서의 Step 1을 넘어 Step 2 기능 일부까지 진입했다.

이미 동작하는 축:

```md
- haloc / halon 바이너리 분리
- haloc REST API / SSE / embedded web 제공
- haloc -> halon REST Pull metrics 수집
- SQLite 기반 nodes, metrics, services, domains, events 저장
- admin auth / session / audit log 기초
- domain / SSL check
- service health check
- topology asset / connection / impact view 기초
- notes / runbooks / maintenance 기초
- halon read-only logs / containers / ports endpoint 기초
```

따라서 다음 작업은 기능 추가보다 안정화와 정책 정렬을 우선한다.

우선순위:

```md
1. Dashboard / Node List가 latest metrics를 실제로 소비하도록 API 응답 정렬
2. halon Step 2 read-only endpoint에 enable flag, tail limit, log source allowlist 적용
3. node token raw 저장 정책을 문서와 코드에서 명확히 재정의
4. schema migration / retention / downsampling 체계 도입
5. service-domain-node-asset 관계 모델을 명시적 binding table로 확장
6. maintenance window와 event suppress / resolve 흐름 연결
7. safe action은 action registry + allowlist + audit + result history가 준비된 뒤 추가
```

현재 단계 이름은 다음처럼 재해석한다.

```txt
Phase 1. Foundation Stabilization
Phase 2. Ops Data Model
Phase 3. Operational Intelligence
Phase 4. Safe Actions
```

기존 Step 1/Step 2 범위는 유지하되, 이미 구현된 Step 2 항목은 "신규 기능"이 아니라 "stabilization 대상"으로 본다.

엔진은 두 개의 바이너리로 구성한다.

```txt
halo-engine
├── haloc  # 중앙 제어 엔진 / API 서버 / 저장소 / 이벤트 허브
└── halon  # 각 서버에 설치되는 노드 런타임 / read-only collector
```

Web UI는 `haloc` API만 사용하고, `halon`을 직접 호출하지 않는다.

```txt
Browser Web UI
  ↓ REST / SSE
haloc
  ↓ REST Pull
halon
```

---

## 1. 핵심 방향

```md
- core-node 구조
- haloc / halon 바이너리 분리
- Web UI는 haloc만 호출
- halon은 외부 Web에 직접 노출하지 않음
- 초기 기능은 read-only 중심
- action은 allowlist 기반으로만 후속 제공
- Web ↔ haloc는 REST + SSE
- haloc ↔ halon은 Step 1에서 REST Pull 방식으로 고정
- RPC/gRPC는 Step 1에서 제외하고 필요성이 생긴 뒤 검토
- SQLite 기반 local-first 저장
- 단일 홈서버 또는 소규모 내부망에 최적화
- 복잡한 분산 모니터링 시스템이 아니라 개인 운영 콘솔을 목표로 함
```

---

## 2. 전체 구조

## 2.1 구성요소

```txt
┌────────────────────┐
│    Browser Web UI   │
│  Dashboard / Graph  │
│  Ops Console / Map  │
└─────────┬──────────┘
          │ REST / SSE
          ▼
┌────────────────────┐
│       haloc         │
│ Central API Server  │
│ SQLite Storage      │
│ Node Registry       │
│ Event Stream        │
│ Domain/SSL Checker  │
└─────────┬──────────┘
          │ REST Pull
          ▼
┌────────────────────┐
│       halon         │
│ Node Runtime        │
│ Host Info Collector │
│ Metrics Collector   │
│ Read-only Endpoint  │
└────────────────────┘
```

## 2.2 역할 분리

### haloc

`haloc`는 중앙 제어 엔진이다.

역할:

```md
- REST API 서버
- Web UI용 API 제공
- SSE 이벤트 스트림 제공
- SQLite 저장소 관리
- node registry 관리
- node token 발급 / 검증
- halon으로부터 metrics 수집
- metrics current cache 유지
- metrics history 저장
- domain / SSL check 수행
- service catalog 관리
- event / audit log 저장
```

### halon

`halon`은 각 서버에 설치되는 read-only 노드 런타임이다.

역할:

```md
- host info 수집
- CPU / Memory / Disk / Network metrics 수집
- read-only status endpoint 제공
- haloc의 REST Pull 요청에 응답
- Step 1에서는 action 수행 금지
- Step 1에서는 logs / containers / ports 제외
```

### Web UI

Web UI는 운영 화면만 담당한다.

역할:

```md
- haloc API 호출
- dashboard 표시
- node list 표시
- metrics graph 표시
- domain / SSL 상태 표시
- service catalog 표시
- SSE 이벤트 수신
- Step 2에서 topology, logs, impact view 제공
```

Web UI는 `halon`을 직접 호출하지 않는다.

---

## 3. 구현 단계

구현 단계는 2단계로 제한한다.

```txt
Step 1. Engine Foundation + Web MVP
Step 2. Ops Console + Infra Map
```

세부 버전 단위 로드맵은 만들지 않는다. 대신 각 Step 내부를 A/B/C 작업 순서로 나눈다.

---

# Step 1. Engine Foundation + Web MVP

## 4. Step 1 목표

Step 1의 목표는 `halo`가 실제로 동작하는 최소 관제 시스템이 되는 것이다.

완료 후 다음 흐름이 가능해야 한다.

```txt
halon이 각 서버의 상태를 read-only로 제공한다.
haloc가 halon에서 상태와 metrics를 수집한다.
haloc가 데이터를 SQLite에 저장한다.
Web이 haloc API를 통해 상태와 그래프를 보여준다.
```

Step 1의 핵심 목표:

```md
- haloc / halon 통신 구조 완성
- 노드 등록과 인증 구조 완성
- 리소스 metrics 수집
- SQLite 저장
- Metrics History API 제공
- Domain / SSL 상태 확인
- Service Catalog 기본 모델 제공
- Web Dashboard가 소비할 API 제공
- SSE 기반 이벤트 스트림 기초 제공
```

---

## 5. Step 1 통신 정책

Step 1에서는 통신 방식을 단순하게 고정한다.

```md
- Web ↔ haloc: REST + SSE
- haloc ↔ halon: REST Pull
- halon → haloc heartbeat push: Step 1 제외
- RPC/gRPC: Step 1 제외
```

기본 구조:

```txt
Web
  ↓ REST / SSE
haloc
  ↓ REST Pull
halon
```

선택 이유:

```md
- 중앙에서 수집 주기를 제어하기 쉽다.
- halon을 단순한 read-only agent로 유지할 수 있다.
- Web/API와 데이터 흐름이 명확하다.
- 노드 offline 판단이 쉽다.
- 인증 흐름이 단순하다.
```

추후 NAT 환경, 외부망 노드, 원격 노드 지원이 필요하면 Push 또는 Relay 구조를 별도 검토한다.

---

## 6. Step 1 구현 범위

## 6.1 haloc 기본 기능

```md
- haloc init
- haloc serve
- config 로딩
- SQLite 초기화
- node registry 관리
- node token 발급 / 검증
- REST API 서버
- SSE stream endpoint
- metrics current cache
- metrics history 저장
- event 생성
- domain / SSL check
- service catalog 기본 CRUD
```

## 6.2 halon 기본 기능

```md
- halon init
- halon serve
- host info 수집
- CPU / RAM / Disk / Network metrics 수집
- token 기반 인증
- read-only status endpoint 제공
- haloc의 REST Pull 요청에 응답
```

## 6.3 Step 1에서 제외하는 기능

```md
- systemd service 자동 조회
- Docker container 자동 조회
- listening port 조회
- log tail
- arbitrary command execution
- Web shell
- sudo action
- docker exec
- systemd restart
- docker restart
- topology graph
- impact analysis
- notification center 고도화
```

---

## 7. 설치 및 등록 흐름

## 7.1 기본 등록 플로우

```txt
1. haloc에서 node 등록
2. haloc에서 node token 생성
3. 대상 서버에 halon 설치
4. halon init 시 node name, listen address, token 설정
5. haloc가 주기적으로 halon API를 호출
6. haloc가 metrics와 status를 SQLite에 저장
```

## 7.2 CLI 예시

### haloc 초기화

```bash
haloc init
```

### haloc 실행

```bash
haloc serve
```

### node 등록

```bash
haloc node add orbit --url http://10.10.10.70:7311
```

### node token 발급

```bash
haloc node token issue orbit
```

출력 예시:

```txt
Node token created.

node: orbit
token: halo_node_xxxxxxxxxxxxxxxxxxxx

This token is shown only once.
```

### halon 초기화

```bash
halon init \
  --name orbit \
  --listen :7311 \
  --token halo_node_xxxxxxxxxxxxxxxxxxxx
```

### halon 실행

```bash
halon serve
```

## 7.3 join-command 후보

반복 작업을 줄이기 위해 다음 명령을 제공할 수 있다.

```bash
haloc node join-command orbit --url http://10.10.10.70:7311
```

출력 예시:

```bash
halon init --name orbit --listen :7311 --token halo_node_xxxxxxxxxxxxxxxxxxxx
```

---

## 8. 저장소 정책

Step 1부터 SQLite를 사용한다.

```bash
# system mode
/var/lib/halo/halo.db

# user mode
~/.halo/halo.db
```

저장 대상:

```md
- nodes
- node metric snapshots
- domains
- services
- events
- audit logs 일부
```

Step 1에서는 SQLite 하나로 충분하다. Prometheus, InfluxDB, TimescaleDB 같은 별도 time-series DB는 도입하지 않는다.

---

## 9. Step 1 데이터 모델

## 9.1 Node

```md
- id
- name
- display_name
- role
- url
- ip_address
- status
- hostname
- os
- arch
- version
- tags_json
- token_hash
- enabled
- last_seen_at
- last_error_at
- error_message
- created_at
- updated_at
```

상태 후보:

```md
- online
- offline
- warning
- unknown
- disabled
```

## 9.2 Node Metric Snapshot

```md
- id
- node_id
- cpu_load_1
- cpu_load_5
- cpu_load_15
- cpu_used_percent
- memory_used_percent
- disk_root_used_percent
- network_rx_bytes_total
- network_tx_bytes_total
- raw_json
- collected_at
```

`raw_json` 예시:

```json
{
  "disks": [
    {
      "mount": "/",
      "device": "/dev/sda1",
      "used_percent": 54.2
    }
  ],
  "networks": [
    {
      "name": "eth0",
      "rx_bytes": 123456,
      "tx_bytes": 789012
    }
  ]
}
```

Step 1의 graph API는 대표 값을 우선 사용한다.

```md
- CPU: cpu_used_percent
- Memory: memory_used_percent
- Disk: disk_root_used_percent
- Network: rx/tx total bytes
```

디스크별, NIC별 상세 표시는 Step 2 이후에 확장한다.

## 9.3 Service

Step 1의 Service Catalog는 수동 등록 기반이다.

```md
- id
- name
- node_id
- kind
- port
- domain_id
- health_check_url
- health_status
- note
- created_at
- updated_at
```

`systemd_unit`, `docker_container` 자동 연결은 Step 2에서 추가한다.

상태 후보:

```md
- healthy
- warning
- critical
- unknown
- disabled
```

## 9.4 Domain

```md
- id
- name
- service_id
- expected_ip
- dns_json
- http_json
- ssl_json
- last_checked_at
- created_at
- updated_at
```

Domain check 저장 항목:

```md
- resolved_ips
- expected_ip_match
- http_status
- https_status
- response_time_ms
- redirect 여부
- redirect_chain
- SSL issuer
- SSL subject
- SSL SAN
- SSL expires_at
- days_remaining
- error_message
```

## 9.5 Event

```md
- id
- level
- type
- source_type
- source_id
- message
- created_at
- resolved_at
```

level 후보:

```md
- info
- warning
- critical
```

source_type 후보:

```md
- node
- service
- domain
- system
```

## 9.6 Audit Log

Step 1에서는 최소한의 audit log만 저장한다.

```md
- id
- actor
- action
- target_type
- target_id
- message
- created_at
```

---

## 10. Step 1 API 설계

## 10.1 Health

```http
GET /api/v1/healthz
```

응답 예시:

```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

## 10.2 Overview

Web dashboard 첫 화면용 요약 API다.

```http
GET /api/v1/overview
```

응답 예시:

```json
{
  "nodes": {
    "total": 4,
    "online": 3,
    "offline": 1
  },
  "services": {
    "total": 12,
    "healthy": 10,
    "warning": 1,
    "unknown": 1
  },
  "domains": {
    "total": 8,
    "ssl_warning": 1
  },
  "events": {
    "unresolved": 3
  }
}
```

## 10.3 Dashboard

```http
GET /api/v1/dashboard
```

응답 예시:

```json
{
  "overview": {},
  "nodes": [],
  "recent_events": [],
  "domain_warnings": []
}
```

## 10.4 Nodes

```http
GET    /api/v1/nodes
POST   /api/v1/nodes
GET    /api/v1/nodes/{name}
DELETE /api/v1/nodes/{name}

GET  /api/v1/nodes/{name}/summary
GET  /api/v1/nodes/{name}/status
GET  /api/v1/nodes/{name}/metrics/current
GET  /api/v1/nodes/{name}/metrics/history?range=1h&step=30s
POST /api/v1/nodes/{name}/refresh
```

### Metrics current 응답 예시

```json
{
  "node": "orbit",
  "collected_at": "2026-05-01T12:00:00Z",
  "cpu_used_percent": 12.4,
  "memory_used_percent": 61.2,
  "disk_root_used_percent": 48.1,
  "network_rx_bytes_total": 123456,
  "network_tx_bytes_total": 789012
}
```

### Metrics history 응답 예시

```json
{
  "node": "orbit",
  "range": "1h",
  "step": "30s",
  "points": [
    {
      "time": "2026-05-01T12:00:00Z",
      "cpu_used_percent": 12.4,
      "memory_used_percent": 61.2,
      "disk_root_used_percent": 48.1,
      "network_rx_bytes_total": 123456,
      "network_tx_bytes_total": 789012
    }
  ]
}
```

## 10.5 Services

```http
GET    /api/v1/services
POST   /api/v1/services
GET    /api/v1/services/{id}
PATCH  /api/v1/services/{id}
DELETE /api/v1/services/{id}

GET /api/v1/nodes/{name}/services
```

## 10.6 Domains

```http
GET    /api/v1/domains
POST   /api/v1/domains
GET    /api/v1/domains/{domain}
PATCH  /api/v1/domains/{domain}
DELETE /api/v1/domains/{domain}
POST   /api/v1/domains/{domain}/check
```

## 10.7 Events / SSE

```http
GET /api/v1/events
GET /api/v1/events/history
GET /api/v1/stream
```

SSE event types:

```md
- node.online
- node.offline
- node.warning
- service.warning
- domain.warning
- alert.created
- alert.resolved
```

Step 1에서 SSE는 상태 변화 이벤트 중심으로 사용한다.

```md
- metrics graph는 REST history API를 사용한다.
- metrics 전체를 SSE로 계속 흘리는 구조는 Step 1에서 기본값으로 사용하지 않는다.
- 필요한 경우 dashboard current refresh 용도로 제한적으로 node.metrics를 추가할 수 있다.
```

---

## 11. Step 1 halon 내부 API

`halon`은 `haloc`의 Pull 요청에 응답하는 read-only API만 제공한다.

```http
GET /v1/healthz
GET /v1/info
GET /v1/status
GET /v1/metrics
```

## 11.1 /v1/info 응답 예시

```json
{
  "name": "orbit",
  "hostname": "orbit",
  "os": "linux",
  "arch": "amd64",
  "version": "0.1.0"
}
```

## 11.2 /v1/metrics 응답 예시

```json
{
  "collected_at": "2026-05-01T12:00:00Z",
  "cpu": {
    "load_1": 0.4,
    "load_5": 0.3,
    "load_15": 0.2,
    "used_percent": 12.4
  },
  "memory": {
    "used_percent": 61.2
  },
  "disk": {
    "root_used_percent": 48.1,
    "disks": []
  },
  "network": {
    "rx_bytes_total": 123456,
    "tx_bytes_total": 789012,
    "interfaces": []
  }
}
```

---

## 12. Step 1 수집 정책

## 12.1 Metrics

기본 수집 주기:

```md
- 기본값: 30s
- 옵션: 15s, 30s, 60s
```

초기 저장 정책:

```md
- raw snapshot 저장
- current metrics는 haloc memory cache에 유지
- history range query는 SQLite에서 조회
- downsampling은 Step 2에서 검토
```

권장 range:

```md
- 5m
- 1h
- 6h
- 24h
- 7d
```

Step 1의 `step` 처리 정책:

```md
- requested step에 가장 가까운 snapshot을 반환한다.
- avg/min/max 집계는 Step 1에서 필수로 구현하지 않는다.
- 정확한 downsampling은 Step 2 이후로 미룬다.
```

## 12.2 Domain / SSL

수집 항목:

```md
- DNS A/AAAA 조회
- resolved_ips
- expected_ip 비교
- HTTP status
- HTTPS status
- response_time_ms
- redirect 여부
- redirect_chain
- SSL issuer
- SSL subject
- SSL SAN
- SSL expires_at
- days_remaining
- error_message
```

추천 경고 기준:

```md
- SSL 만료 30일 이하: warning
- SSL 만료 7일 이하: critical
- DNS expected_ip 불일치: warning
- HTTPS 연결 실패: critical
- HTTP 5xx: warning 또는 critical
```

---

## 13. Step 1 완료 기준

Step 1은 다음이 가능하면 완료로 본다.

```md
- haloc init 실행 가능
- haloc serve 실행 가능
- halon init 실행 가능
- halon serve 실행 가능
- haloc에 node 등록 가능
- node token 발급 가능
- haloc가 halon metrics 수집 가능
- SQLite에 metrics history 저장 가능
- Web에서 node list 표시 가능
- Web에서 metrics graph 표시 가능
- domain/SSL 상태 확인 가능
- service catalog 기본 등록 가능
- dashboard API가 실제 데이터를 반환
- SSE로 기본 이벤트 수신 가능
```

---

## 14. Step 1 작업 순서

```md
Step 1-A. haloc / halon 프로젝트 구조 생성
Step 1-B. config 로딩과 init 명령 구현
Step 1-C. halon read-only API 구현
Step 1-D. haloc node registry 구현
Step 1-E. node token 발급 / 검증 구현
Step 1-F. haloc → halon REST Pull 구현
Step 1-G. metrics 수집 구현
Step 1-H. SQLite schema / repository 구현
Step 1-I. metrics current / history API 구현
Step 1-J. overview / dashboard API 구현
Step 1-K. domain / SSL check 구현
Step 1-L. service catalog 기본 CRUD 구현
Step 1-M. SSE event stream 구현
Step 1-N. Web MVP 연동
```

---

# Step 2. Ops Console + Infra Map

## 15. Step 2 목표

Step 2의 목표는 `halo`를 단순 모니터링 도구가 아니라 실제 홈 인프라 운영 콘솔로 확장하는 것이다.

추가되는 핵심 기능:

```md
- systemd service view
- Docker container view
- port listener map
- log source registry
- 지정 서비스 로그 조회
- 수동 topology asset 관리
- IP 없는 하드웨어 asset 관리
- topology connection 관리
- service-domain-node-asset 관계 연결
- impact analysis
- runbook / notes
- maintenance mode
- audit log 강화
- notification center
- safe action foundation
```

---

## 16. Step 2 구현 범위

## 16.1 Read-only Ops 기능

```md
- systemd service 상태 조회
- Docker container 상태 조회
- listening port 조회
- 지정 log source tail 조회
- service와 log source 연결
- service와 container/systemd unit 연결
- service와 port 연결
```

## 16.2 Topology 기능

```md
- topology asset CRUD
- topology connection CRUD
- IP 없는 장비 등록
- node와 asset 연결
- service와 asset 연결
- domain과 service 연결
- topology graph API
```

지원 asset type:

```md
- router
- switch
- access_point
- server
- nas
- desktop
- laptop
- lxc
- vm
- docker_host
- ups
- external_disk
- camera
- monitor
- patch_panel
- kvm
```

## 16.3 Impact View

```md
- 특정 node 장애 시 영향받는 service 표시
- 특정 switch 장애 시 연결된 장비 표시
- reverse proxy 장애 시 영향받는 domain 표시
- NAS 장애 시 영향받는 backup/service 표시 후보
- 특정 domain 장애 시 연결된 service/node 표시
```

## 16.4 Runbook / Notes

```md
- node별 메모
- service별 메모
- domain별 메모
- asset별 메모
- 장애 대응 절차
- 설정 파일 위치
- 복구 절차
- 관련 링크
```

## 16.5 Notification / Maintenance

```md
- Web UI 내부 notification center
- event resolve
- maintenance mode
- 점검 중 alert 억제
- 점검 사유 기록
- 점검 종료 예정 시간 기록
```

## 16.6 Safe Action Foundation

Step 2에서 action 기반을 만들 수 있지만 기본값은 비활성화한다.

허용 후보:

```md
- 등록된 health check 재실행
- 등록된 domain check 재실행
- allowlist된 systemd service restart
- allowlist된 docker container restart
```

금지:

```md
- Web shell
- arbitrary command execution
- sudo 기반 임의 명령
- Docker exec
- Docker remove
- 전체 파일 브라우저
- 임의 파일 다운로드
- 임의 파일 수정
```

---

## 17. Step 2 추가 데이터 모델

## 17.1 Log Source

```md
- id
- node_id
- source_id
- type
- systemd_unit
- docker_container
- file_path
- enabled
- created_at
- updated_at
```

## 17.2 Topology Asset

```md
- id
- name
- type
- has_ip
- ip_address
- mac_address
- vendor
- model
- location
- note
- created_at
- updated_at
```

## 17.3 Topology Connection

```md
- id
- from_asset_id
- to_asset_id
- from_port_label
- to_port_label
- connection_type
- note
```

## 17.4 Service Binding

```md
- id
- service_id
- node_id
- asset_id
- systemd_unit
- docker_container
- port
- created_at
- updated_at
```

## 17.5 Note / Runbook

```md
- id
- target_type
- target_id
- title
- body
- created_at
- updated_at
```

## 17.6 Maintenance Window

```md
- id
- target_type
- target_id
- reason
- starts_at
- ends_at
- created_at
```

## 17.7 Audit Log

```md
- id
- actor
- action
- target_type
- target_id
- message
- created_at
```

---

## 18. Step 2 추가 API

## 18.1 Logs

```http
GET /api/v1/nodes/{name}/logs/sources
GET /api/v1/nodes/{name}/logs/{source_id}?tail=200
GET /api/v1/nodes/{name}/logs/{source_id}/stream
```

초기에는 stream 제외 가능.

## 18.2 Containers

```http
GET /api/v1/nodes/{name}/containers
```

## 18.3 Systemd

```http
GET /api/v1/nodes/{name}/systemd/services
GET /api/v1/nodes/{name}/systemd/services/{unit}
```

## 18.4 Ports

```http
GET /api/v1/nodes/{name}/ports
```

## 18.5 Topology

```http
GET    /api/v1/topology/assets
POST   /api/v1/topology/assets
GET    /api/v1/topology/assets/{id}
PATCH  /api/v1/topology/assets/{id}
DELETE /api/v1/topology/assets/{id}

GET    /api/v1/topology/connections
POST   /api/v1/topology/connections
DELETE /api/v1/topology/connections/{id}

GET /api/v1/topology/graph
GET /api/v1/topology/impact/{asset_id}
```

## 18.6 Notes

```http
GET    /api/v1/notes
POST   /api/v1/notes
PATCH  /api/v1/notes/{id}
DELETE /api/v1/notes/{id}
```

## 18.7 Maintenance

```http
GET  /api/v1/maintenance
POST /api/v1/maintenance
POST /api/v1/maintenance/{id}/end
```

## 18.8 Actions 후보

```http
POST /api/v1/actions
GET  /api/v1/actions/{action_id}
GET  /api/v1/actions/history
```

---

## 19. Step 2 작업 순서

```md
Step 2-A. systemd / Docker / ports read-only
Step 2-B. Service와 systemd/docker/port 연결
Step 2-C. log source allowlist + tail API
Step 2-D. topology asset / connection
Step 2-E. service-domain-node-asset 관계 연결
Step 2-F. impact view
Step 2-G. notes / runbook / maintenance
Step 2-H. notification center
Step 2-I. safe action foundation
```

---

## 20. 보안 정책

## 20.1 기본 원칙

```md
- admin token과 node token 분리
- node token은 특정 node에만 유효
- node token hash는 검증/표시 상태용으로 저장
- haloc가 halon을 Pull 호출해야 하므로 agent credential raw value는 별도 보호 저장 정책이 필요
- token raw value는 생성 시 1회만 표시
- token rotate 지원
- config 파일 권한은 0600 권장
- halon은 비 root 실행 우선
- halon은 read-only 우선
- halon listen address는 내부망 IP 또는 127.0.0.1 우선
- halon logs / containers / ports endpoint는 config flag로 비활성화 가능해야 함
- journal log source는 allowed_journal_units 기반 제한을 지원해야 함
- log tail은 max_log_tail로 제한해야 함
- Docker socket 직접 접근 지양
- Docker는 CLI read-only 호출 우선
- log source allowlist
- action allowlist
- audit log 저장
- Web shell 금지
- arbitrary command execution 금지
- sudo 기반 action 금지 또는 극히 제한
```

## 20.2 인증 방향

```txt
haloc → halon
Authorization: Bearer <node-token>
```

`halon`은 요청 token이 자기 node에 발급된 token인지 검증한다.

## 20.3 Action 보안

Action은 Step 2 후반까지 기본 비활성화한다.

Action을 추가하더라도 다음 조건을 만족해야 한다.

```md
- action id 기반 등록
- allowlist에 등록된 action만 실행
- 사용자 입력을 shell command로 직접 전달하지 않음
- action 실행 전 대상 service/container/unit 검증
- action 결과 audit log 저장
- 실패 결과도 audit log 저장
```

---

## 21. 권장 프로젝트 구조

```txt
halo-engine/
├── cmd/
│   ├── haloc/
│   │   └── main.go
│   └── halon/
│       └── main.go
├── internal/
│   ├── config/
│   ├── database/
│   ├── haloc/
│   │   ├── api/
│   │   ├── node/
│   │   ├── metrics/
│   │   ├── domain/
│   │   ├── service/
│   │   ├── event/
│   │   └── collector/
│   ├── halon/
│   │   ├── api/
│   │   ├── host/
│   │   ├── metrics/
│   │   └── auth/
│   ├── security/
│   └── version/
├── pkg/
│   └── haloapi/
├── migrations/
├── web/
└── README.md
```

---

## 22. Web UI 범위

## 22.1 Step 1 Web MVP

```md
- Dashboard overview
- Node list
- Node detail
- CPU / Memory / Disk / Network graph
- Domain / SSL status
- Service catalog list
- Recent events
- SSE 연결 상태 표시
```

## 22.2 Step 2 Web

```md
- Ops Console
- systemd view
- Docker container view
- port listener view
- log viewer
- topology map
- asset editor
- impact view
- runbook / notes editor
- maintenance mode
- notification center
- safe action panel
```

---

## 23. 최종 구현 우선순위

가장 먼저 만들어야 하는 최소 경로는 다음이다.

```txt
halon /v1/metrics
  ↓
haloc node registry
  ↓
haloc collector
  ↓
SQLite metric snapshots
  ↓
/api/v1/nodes/{name}/metrics/current
  ↓
/api/v1/nodes/{name}/metrics/history
  ↓
Web graph
```

이 경로가 완성되면 `halo-engine`은 실제 동작하는 모니터링 엔진이 된다.

그 다음에 다음 순서로 확장한다.

```txt
Domain / SSL check
  ↓
Service Catalog
  ↓
Events / SSE
  ↓
Web Dashboard 완성
  ↓
Step 2 Ops 기능
```

---

## 24. 최종 판단

`halo-engine`의 핵심은 다음 문장으로 정리할 수 있다.

```txt
Engine은 사실을 수집하고 저장한다.
Web은 그 사실을 보기 좋게 연결해서 보여준다.
Action은 가장 마지막에 allowlist로만 추가한다.
```

따라서 Step 1에서는 수집, 저장, API, Web MVP에 집중한다.

Step 2에서는 운영 편의 기능, 로그, 토폴로지, 영향도 분석, runbook, maintenance, 제한적 action 기반을 추가한다.

이 구조는 개인 홈서버와 내부망 관리 도구로 구현 가능성이 높고, 불필요한 복잡도를 피하면서도 이후 Web UI와 운영 콘솔로 확장하기 좋은 형태다.
