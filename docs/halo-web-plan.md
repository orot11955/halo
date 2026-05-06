# halo-web 최종 설계안

## 0. 문서 목적

`halo-web`은 `halo-engine`의 `haloc` API를 사용하는 브라우저 기반 홈 인프라 관제 콘솔이다.

목표는 단순한 모니터링 대시보드가 아니라, `haloc`가 수집하고 저장한 노드, 서비스, 도메인, 이벤트, 토폴로지 정보를 운영자가 이해하기 쉽게 연결해서 보여주는 개인 인프라 운영 콘솔을 만드는 것이다.

## 0.1 현재 점검 결과와 고도화 기준

2026-05-06 기준 실제 Web 구현은 Step 1 MVP를 넘어 Step 2 화면 일부까지 포함한다.

이미 구현된 축:

```md
- authenticated app shell / sidebar / header
- Dashboard summary, alerts, events, maintenance, audit widgets
- Dashboard widget order / visibility / span localStorage persistence
- Node list / detail / metrics / containers / logs / ports / notes
- Services catalog / health checks / dependencies 기초
- Domains / Events / Audit / Maintenance 화면
- Topology map / hardware assets / impact view
- Runbooks 화면
- TanStack Query 기반 API client와 SSE cache invalidation
```

따라서 다음 Web 작업은 "화면 추가"보다 API 사실성과 운영 UX 정렬을 우선한다.

우선순위:

```md
1. Dashboard와 Node List가 haloc의 latest metrics를 직접 소비하도록 adapter 정리
2. Step 2 read-only 기능이 disabled/forbidden일 때 명확한 empty/error UX 제공
3. service/domain/node/asset 이름 해석을 id 문자열(`#1`)이 아니라 실제 display label로 개선
4. maintenance mode가 alert suppress / event resolve 상태와 연결되도록 UI 보강
5. notification center와 unresolved alert badge를 events model에 맞춰 통합
6. dashboard layout은 localStorage 유지 후 user settings API로 승격
7. Safe Action UI는 action registry/allowlist가 engine에 준비된 뒤 노출
```

현재 단계 이름은 다음처럼 재해석한다.

```txt
Phase 1. Foundation UX Stabilization
Phase 2. Relationship-Aware Ops Console
Phase 3. Notification / Maintenance Intelligence
Phase 4. Safe Action UI
```

기존 Step 1/Step 2 범위는 유지하되, 이미 구현된 Step 2 화면은 "완료"가 아니라 실제 운영 데이터와 보안 정책에 맞춰 다듬는 대상으로 본다.

Electron은 사용하지 않는다.

초기 배포 방식은 `Vite + React` build 결과물을 `haloc` 바이너리에 embed해서 제공하는 방식을 기본으로 한다.

```txt
Browser Web UI
  ↓ REST / SSE
haloc
  ↓ REST Pull
halon
```

Web UI는 `halon`을 직접 호출하지 않는다.

---

## 1. 핵심 방향

```md
- Web은 haloc API만 사용한다.
- Web은 halon을 직접 호출하지 않는다.
- Web은 직접 제어 도구가 아니라 운영 콘솔이다.
- Step 1은 read-only 관제 중심으로 구현한다.
- Step 2에서 logs, containers, ports, topology, impact view를 확장한다.
- Action UI는 가장 마지막에 allowlist 기반으로만 제한적으로 제공한다.
- Dashboard는 처음부터 확장 가능한 card/widget 구조로 설계한다.
- 대시보드 위젯은 추가, 제거, 위치 변경, 크기 변경이 가능한 구조를 목표로 한다.
- 단, Step 1에서는 기본 고정 레이아웃을 먼저 구현하고, 위젯 편집 기능은 Step 2로 미룬다.
```

---

## 2. 제품 목표

`halo-web`이 제공해야 하는 최종 경험은 다음과 같다.

```md
- 홈서버 전체 상태를 한 화면에서 확인한다.
- node별 CPU/RAM/Disk/Network 시계열을 확인한다.
- 서비스 상태와 연결된 node/domain을 확인한다.
- 도메인 DNS/HTTP/SSL 상태를 확인한다.
- 최근 장애, 경고, 이벤트를 확인한다.
- 지정된 서비스 로그를 확인한다.
- Docker container와 systemd service 상태를 확인한다.
- 노드별 listening port를 확인한다.
- IP가 없는 장비까지 포함해 홈 인프라 토폴로지를 도식화한다.
- 특정 장비나 노드 장애 시 영향받는 서비스와 도메인을 확인한다.
- 운영 메모, runbook, 점검 상태를 관리한다.
- 운영 action은 마지막 단계에서 안전하게 제한 제공한다.
```

---

## 3. 기술 스택

## 3.1 초기 확정 스택

```md
- Vite
- React
- TypeScript
- React Router
- TanStack Query
- Recharts
- CSS Modules
- Go embed 정적 파일 배포
```

## 3.2 후보 스택

```md
- uPlot: 대량 시계열 그래프가 필요할 때 Recharts 대체 후보
- React Flow: topology graph 구현 후보
- Tailwind: 빠른 UI 개발이 필요할 때 후보
- Zustand: 전역 UI 상태가 복잡해질 때 후보
```

## 3.3 최종 판단

```md
- Step 1은 Vite + React + TypeScript + TanStack Query + Recharts + CSS Modules로 시작한다.
- 그래프 데이터가 많아져 Recharts 성능이 부족하면 uPlot으로 교체한다.
- Topology Map은 Step 2에서 React Flow 또는 SVG 기반 커스텀 구현을 검토한다.
- 상태 서버 데이터는 TanStack Query가 담당한다.
- UI 전역 상태는 처음에는 React state/context로 시작하고, 복잡해지면 Zustand를 도입한다.
```

---

## 4. 배포 방식

## 4.1 기본 배포

```txt
halo-web build
  ↓
dist/
  ↓
haloc binary embed
  ↓
haloc serve
  ↓
Browser에서 접속
```

## 4.2 권장 구조

```txt
halo/
├── cmd/
│   ├── haloc/
│   └── halon/
├── internal/
│   ├── api/
│   ├── node/
│   ├── metrics/
│   ├── domain/
│   └── storage/
├── web/
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   └── dist/
└── Makefile
```

## 4.3 개발 모드

개발 중에는 Vite dev server와 haloc API를 분리해서 실행한다.

```txt
localhost:5173  → halo-web dev server
localhost:7310  → haloc API server
```

Vite proxy 예시:

```ts
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:7310',
    },
  },
});
```

## 4.4 운영 모드

운영에서는 `haloc`가 정적 파일과 API를 함께 제공한다.

```txt
http://halo.local/
  ├─ /              -> halo-web index.html
  ├─ /assets/*      -> halo-web assets
  ├─ /api/v1/*      -> haloc API
  └─ /api/v1/stream -> SSE
```

---

## 5. 구현 단계

구현 단계는 2단계로 고정한다.

```txt
Step 1. Web MVP
Step 2. Ops Console + Infra Map
```

---

# Step 1. Web MVP

## 6. Step 1 목표

Step 1의 목표는 브라우저에서 홈 인프라의 핵심 상태를 확인할 수 있게 만드는 것이다.

Step 1이 끝나면 다음이 가능해야 한다.

```md
- 전체 Dashboard 확인
- Node 목록 확인
- Node 상세 확인
- CPU/RAM/Disk/Network 시계열 그래프 확인
- Domain / SSL 상태 확인
- 기본 Service Catalog 확인
- 기본 Events 확인
- SSE로 최신 상태 변화 이벤트 수신
- Settings Basic에서 기본 설정 확인
```

Step 1은 운영 action을 제공하지 않는다.

---

## 7. Step 1 화면 구조

```txt
Halo Web
├── Dashboard
├── Nodes
│   ├── Node List
│   └── Node Detail
│       ├── Overview
│       └── Metrics
├── Services
│   └── Catalog Basic
├── Domains
├── Events
└── Settings Basic
```

---

## 8. Step 1 공통 UI 원칙

```md
- 전체 레이아웃은 application-like 구조로 구성한다.
- 좌측 Sidebar + 상단 Header + 본문 Content Layout을 기본으로 한다.
- 상태는 badge, dot, tone color로 빠르게 구분한다.
- 대시보드는 card 기반으로 구성한다.
- 표는 검색, 필터, 새로고침을 기본 패턴으로 둔다.
- 상세 화면은 Overview + Tabs 구조를 사용한다.
- Empty state, Loading state, Error state를 모든 주요 화면에 제공한다.
- API 실패 시 원인을 숨기지 않고 보여준다.
```

---

## 9. Step 1 라우팅

```txt
/                     Dashboard
/nodes                Node List
/nodes/:name          Node Detail
/nodes/:name/metrics  Node Metrics
/services             Service Catalog Basic
/domains              Domain List
/events               Event List
/settings             Settings Basic
```

Step 1에서는 URL 구조를 단순하게 유지하고, Step 2에서 상세 탭 라우팅을 확장한다.

---

## 10. API Client 구조

## 10.1 기본 원칙

```md
- 모든 API 호출은 src/services 또는 src/api 계층에서만 수행한다.
- 컴포넌트에서 fetch/axios를 직접 호출하지 않는다.
- TanStack Query hook을 화면 단위로 제공한다.
- SSE 연결은 별도 event client로 분리한다.
- API 응답 타입은 TypeScript type으로 명시한다.
```

## 10.2 추천 폴더 구조

```txt
web/src/
├── app/
│   ├── App.tsx
│   ├── router.tsx
│   └── providers.tsx
├── components/
│   ├── layout/
│   ├── ui/
│   ├── charts/
│   ├── status/
│   └── table/
├── features/
│   ├── dashboard/
│   ├── nodes/
│   ├── metrics/
│   ├── services/
│   ├── domains/
│   ├── events/
│   └── settings/
├── services/
│   ├── apiClient.ts
│   ├── dashboardApi.ts
│   ├── nodeApi.ts
│   ├── metricsApi.ts
│   ├── serviceApi.ts
│   ├── domainApi.ts
│   ├── eventApi.ts
│   └── streamClient.ts
├── types/
│   ├── api.ts
│   ├── node.ts
│   ├── metrics.ts
│   ├── service.ts
│   ├── domain.ts
│   └── event.ts
├── styles/
│   ├── tokens.css
│   ├── globals.css
│   └── themes.css
└── utils/
    ├── date.ts
    ├── format.ts
    └── status.ts
```

---

## 11. Dashboard

## 11.1 목표

홈 인프라 전체 상태를 한눈에 확인한다.

## 11.2 표시 항목

```md
- 전체 node 수
- online/offline/warning node 수
- 전체 service 수
- healthy/warning/unknown service 수
- CPU/RAM/Disk summary
- 최근 event
- unresolved alert
- SSL 만료 임박 도메인
- 최근 offline node
```

## 11.3 카드 구성

```md
- Nodes Summary Card
- Services Summary Card
- Domains / SSL Card
- Resource Summary Card
- Alerts Card
- Recent Events Card
```

## 11.4 Dashboard Sandbox 정책

최종적으로 Dashboard는 위젯을 추가, 제거, 드래그앤드롭, 크기 변경할 수 있는 sandbox 구조를 목표로 한다.

다만 구현 순서는 다음처럼 나눈다.

```md
Step 1:
- 고정 카드 레이아웃
- 카드 컴포넌트는 위젯처럼 분리
- 추후 위치/크기 저장을 고려해 widget id를 부여

Step 2:
- widget registry
- drag and drop
- resize
- card visibility 설정
- layout persistence
```

## 11.5 필요 API

```http
GET /api/v1/dashboard
GET /api/v1/events/history
GET /api/v1/stream
```

## 11.6 권장 응답 예시

```json
{
  "nodes": {
    "total": 4,
    "online": 3,
    "offline": 1,
    "warning": 0
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
  "resources": {
    "cpu_used_percent_avg": 18.4,
    "memory_used_percent_avg": 61.2,
    "disk_used_percent_max": 74.1
  },
  "events": {
    "unresolved": 3,
    "recent": []
  }
}
```

---

## 12. Nodes

## 12.1 Node List

표시 항목:

```md
- name
- display_name
- hostname
- status
- os
- arch
- cpu_used_percent
- memory_used_percent
- disk_used_percent
- last_seen_at
- version
```

기능:

```md
- online/offline 필터
- warning 필터
- search
- refresh
- row click으로 상세 이동
```

필요 API:

```http
GET /api/v1/nodes
```

## 12.2 Node Detail

탭 구조:

```md
- Overview
- Metrics
```

Overview 표시 항목:

```md
- name
- display_name
- hostname
- OS
- arch
- uptime
- version
- IP
- status
- last_seen_at
- health status
- error_message
```

필요 API:

```http
GET /api/v1/nodes/{name}
GET /api/v1/nodes/{name}/status
GET /api/v1/nodes/{name}/summary
```

`/summary` API가 없다면 Step 1에서는 `nodes/{name}`와 `status`를 조합한다.

---

## 13. Metrics Graph

## 13.1 목표

node 리소스 시계열 정보를 시각화한다.

## 13.2 그래프 종류

```md
- CPU Load
- CPU Usage
- Memory Usage
- Disk Usage
- Network RX/TX
```

## 13.3 Range

```md
- 5m
- 1h
- 6h
- 24h
- 7d
```

## 13.4 Step 기본값

```md
- 5m: 15s
- 1h: 30s
- 6h: 2m
- 24h: 5m
- 7d: 1h
```

## 13.5 기능

```md
- range 선택
- 자동 refresh
- hover tooltip
- warning threshold 표시
- loading skeleton
- no data state
```

## 13.6 SSE 사용 정책

Step 1에서 metrics graph는 기본적으로 REST history API를 사용한다.

SSE는 다음 용도로 제한한다.

```md
- node.online
- node.offline
- domain.warning
- service.warning
- alert.created
- alert.resolved
```

`node.metrics` SSE append는 후보로만 남기고, Step 1 필수 범위에서는 제외한다.

## 13.7 필요 API

```http
GET /api/v1/nodes/{name}/metrics/current
GET /api/v1/nodes/{name}/metrics/history?range=1h&step=30s
GET /api/v1/stream
```

## 13.8 권장 응답 예시

```json
{
  "node": "orbit",
  "range": "1h",
  "step": "30s",
  "points": [
    {
      "time": "2026-05-01T12:00:00Z",
      "cpu_load_1": 0.42,
      "cpu_load_5": 0.38,
      "cpu_load_15": 0.31,
      "cpu_used_percent": 12.4,
      "memory_used_percent": 61.2,
      "disk_root_used_percent": 48.1,
      "network_rx_bytes_total": 123456,
      "network_tx_bytes_total": 789012
    }
  ]
}
```

---

## 14. Services Basic

## 14.1 목표

홈서버에서 운영 중인 서비스를 운영 관점으로 정리한다.

## 14.2 표시 항목

```md
- service name
- node
- kind
- port
- domain
- health
- health_check_url
- last_checked_at
```

## 14.3 Step 1 범위

```md
- 서비스 목록
- 서비스 등록
- 서비스 상세 기본 정보
- node 연결
- domain 연결
- health 상태 표시
```

Step 1의 Service Catalog는 수동 등록 기반이다.

## 14.4 Step 1 제외 범위

```md
- systemd 상세
- Docker 상세
- logs 연결
- dependency graph
- restart action
- 자동 서비스 탐색
```

## 14.5 필요 API

```http
GET  /api/v1/services
POST /api/v1/services
GET  /api/v1/services/{id}
```

---

## 15. Domains

## 15.1 목표

도메인, DNS, HTTP, SSL 상태를 관리한다.

## 15.2 표시 항목

```md
- domain
- DNS A/AAAA
- resolved_ips
- expected_ip
- HTTP status
- HTTPS status
- response_time_ms
- redirect 여부
- SSL issuer
- SSL subject
- SSL expires_at
- days_remaining
- linked service
- error_message
```

## 15.3 기능

```md
- domain add/remove
- check now
- SSL warning
- service 연결
- expected_ip와 resolved_ip 비교
```

## 15.4 필요 API

```http
GET    /api/v1/domains
POST   /api/v1/domains
GET    /api/v1/domains/{domain}
DELETE /api/v1/domains/{domain}
POST   /api/v1/domains/{domain}/check
```

---

## 16. Events Basic

## 16.1 목표

홈 인프라에서 발생한 기본 이벤트를 확인한다.

## 16.2 이벤트 종류

```md
- node.online
- node.offline
- disk.warning
- ssl.expiry.warning
- domain.check.failed
- service.warning
- alert.created
- alert.resolved
```

## 16.3 기능

```md
- severity 필터
- source 필터
- 최근 이벤트 표시
- unresolved 필터
- SSE 수신
```

## 16.4 필요 API

```http
GET /api/v1/events/history
GET /api/v1/stream
```

---

## 17. Settings Basic

Step 1 설정 항목:

```md
- nodes
- tokens
- domains
- polling interval
- retention policy 기본값
```

주의:

```md
- token 값은 생성 시 1회만 표시한다.
- 저장된 token raw value는 다시 보여주지 않는다.
- destructive action은 confirmation을 요구한다.
- Step 1에서는 destructive action 자체를 최소화한다.
```

---

## 18. Step 1 완료 기준

Step 1은 다음이 가능하면 완료로 본다.

```md
- Web 앱이 haloc에 embed되어 제공된다.
- Dashboard가 실제 데이터를 표시한다.
- Node List가 동작한다.
- Node Detail Overview가 동작한다.
- Node Detail Metrics Graph가 동작한다.
- Domain / SSL 상태가 표시된다.
- Service Catalog 기본 목록이 표시된다.
- Events가 표시된다.
- SSE 연결이 동작한다.
- API loading/error/empty 상태가 처리된다.
```

---

# Step 2. Ops Console + Infra Map

## 19. Step 2 목표

Step 2의 목표는 `halo-web`을 실제 운영 콘솔로 확장하는 것이다.

추가되는 핵심 기능:

```md
- systemd service view
- Docker container view
- Port / Listener Map
- 지정 서비스 로그 보기
- Topology Map
- Hardware Assets
- IP 없는 장비 관리
- Impact View
- Runbooks / Notes
- Maintenance Mode
- Notification Center
- Audit Log
- Safe Action UI 후보
- Dashboard widget sandbox
```

---

## 20. Step 2 화면 구조

```txt
Halo Web
├── Dashboard
│   └── Widget Sandbox
├── Nodes
│   ├── Node List
│   └── Node Detail
│       ├── Overview
│       ├── Metrics
│       ├── Services
│       ├── Containers
│       ├── Logs
│       ├── Ports
│       └── Notes
├── Services
│   ├── Catalog
│   ├── Health Checks
│   └── Dependencies
├── Topology
│   ├── Network Map
│   ├── Hardware Assets
│   └── Impact View
├── Domains
├── Events
│   ├── Alerts
│   ├── Audit Log
│   └── Maintenance
├── Runbooks
└── Settings
    ├── Nodes
    ├── Tokens
    ├── Checks
    ├── Log Sources
    └── Notifications
```

---

## 21. Logs

## 21.1 목표

지정된 서비스 또는 로그 소스의 로그를 Web에서 확인한다.

지원 로그:

```md
- systemd journal
- Docker logs
- allowlist file log
```

## 21.2 기능

```md
- log source list
- 최근 N줄 보기
- level 필터
- keyword search
- 시간 범위 필터
- 실시간 tail 후보
- 복사 버튼
```

## 21.3 보안 원칙

```md
- 전체 파일 브라우저 금지
- allowlist 기반 로그 소스만 제공
- 민감정보 마스킹 후보
- log source 등록/변경은 audit log 기록
```

## 21.4 필요 API

```http
GET /api/v1/nodes/{name}/logs/sources
GET /api/v1/nodes/{name}/logs/{source_id}?tail=200
GET /api/v1/nodes/{name}/logs/{source_id}/stream
```

초기에는 stream 없이 tail view만 제공해도 된다.

---

## 22. Containers

## 22.1 목표

Docker container 상태를 read-only로 확인한다.

표시 항목:

```md
- name
- image
- status
- uptime
- restart count
- ports
- CPU
- memory
- compose project
- linked service
```

기능:

```md
- container logs 연결
- service catalog 연결
- restart action은 후순위
```

필요 API:

```http
GET /api/v1/nodes/{name}/containers
```

---

## 23. Ports

## 23.1 목표

노드별 listening port를 확인한다.

표시 항목:

```md
- port
- protocol
- bind address
- process
- pid
- linked service
- public/private 여부
```

기능:

```md
- 0.0.0.0 bind 강조
- localhost bind 구분
- 등록되지 않은 포트 표시
- service catalog와 매칭
```

필요 API:

```http
GET /api/v1/nodes/{name}/ports
```

---

## 24. Topology

## 24.1 목표

IP가 없는 하드웨어까지 포함해 홈 인프라 구조를 도식화한다.

## 24.2 Network Map 노드 종류

```md
- Internet
- Router
- Switch
- Access Point
- Server
- NAS
- Desktop
- Laptop
- LXC
- VM
- Docker Host
- UPS
- External Disk
- Camera
- Monitor
- Patch Panel
- KVM
```

## 24.3 기능

```md
- 장비 등록
- 연결선 등록
- 포트 라벨 등록
- 위치 등록
- IP 없는 장비 등록
- node/service/domain과 연결
- 장애 상태 색상 표시
- 수동 배치 저장
```

## 24.4 필요 API

```http
GET  /api/v1/topology/graph
GET  /api/v1/topology/assets
POST /api/v1/topology/assets
POST /api/v1/topology/connections
```

---

## 25. Hardware Assets

표시 항목:

```md
- name
- type
- vendor
- model
- IP
- MAC
- location
- note
- connected_to
```

기능:

```md
- asset 추가
- asset 수정
- asset 삭제
- node와 연결
- service와 연결
- domain과 연결
```

IP 없는 asset 예시:

```json
{
  "id": "switch-main",
  "name": "ipTIME SG16A",
  "type": "switch",
  "has_ip": false,
  "ip_address": null,
  "location": "desk",
  "connected_to": "router-main",
  "port_label": "LAN1"
}
```

---

## 26. Impact View

## 26.1 목표

특정 장비 장애 시 영향을 받는 서비스와 도메인을 보여준다.

예시:

```txt
nginx-lxc 장애 영향:
- orot.dev
- kit.2juho.com
- npm.2juho.com
- pri.2juho.com
```

필수 선행 조건:

```md
- topology asset
- topology connection
- node mapping
- service catalog
- domain mapping
```

필요 API:

```http
GET /api/v1/topology/impact/{asset_id}
```

---

## 27. Runbooks / Notes

## 27.1 목표

서비스와 장비별 운영 메모를 관리한다.

기능:

```md
- node note
- service note
- domain note
- topology asset note
- 장애 대응 절차
- 설정 파일 위치
- 복구 절차
- 관련 링크
```

필요 API:

```http
GET    /api/v1/notes
POST   /api/v1/notes
PATCH  /api/v1/notes/{id}
DELETE /api/v1/notes/{id}
```

---

## 28. Maintenance Mode

## 28.1 목표

점검 중인 node/service/domain의 alert를 억제하고, 점검 이력을 남긴다.

기능:

```md
- 특정 node/service/domain 점검 모드 전환
- 점검 중 alert 억제
- 점검 사유 기록
- 점검 종료 예정 시간 기록
- 점검 종료 처리
```

필요 API:

```http
GET  /api/v1/maintenance
POST /api/v1/maintenance
POST /api/v1/maintenance/{id}/end
```

---

## 29. Notification Center

초기 알림:

```md
- Web UI 내부 notification center
- Events page
- unresolved alert badge
```

후속 알림 후보:

```md
- Discord webhook
- Telegram bot
- Slack webhook
- Email
```

Step 2에서는 Web 내부 알림을 우선 구현하고, 외부 webhook은 후순위로 둔다.

---

## 30. Dashboard Widget Sandbox

## 30.1 목표

Dashboard를 고정된 화면이 아니라 사용자가 조정 가능한 운영 화면으로 확장한다.

기능:

```md
- widget 추가
- widget 제거
- widget 위치 변경
- widget 크기 변경
- widget별 설정
- layout 저장
- 기본 layout 복구
```

## 30.2 Widget 후보

```md
- Node Summary
- Resource Summary
- Service Health
- Domain SSL
- Recent Events
- Offline Nodes
- Top Disk Usage
- Network Traffic
- Maintenance Windows
```

## 30.3 저장 정책

```md
- 초기에는 browser localStorage 저장 가능
- 이후 haloc user setting API 저장 후보
```

---

## 31. Safe Action UI 후보

Step 2 후반에 제한적으로 추가할 수 있다.

허용 후보:

```md
- domain check now
- node refresh
- health check rerun
- allowlist된 service restart
- allowlist된 container restart
```

UI 원칙:

```md
- 기본값은 read-only
- action 버튼은 명확히 분리
- destructive action 금지
- confirmation 필수
- audit log 필수
- 실행 결과 표시 필수
```

금지:

```md
- Web shell
- arbitrary command execution
- Docker exec
- Docker remove
- 전체 파일 브라우저
- 파일 편집기
- 포트 스캐너
- 보안 취약점 스캐너
```

---

## 32. Step 2 완료 기준

Step 2는 다음이 가능하면 완료로 본다.

```md
- Node Detail에서 Services/Containers/Ports/Logs 확인 가능
- Service Catalog에서 node/domain/log source 연결 가능
- Topology Map에서 IP 없는 장비까지 표시 가능
- Hardware Asset 등록/수정 가능
- Impact View가 영향받는 service/domain을 계산 가능
- Runbook/Notes 작성 가능
- Maintenance Mode로 alert 억제 가능
- Notification Center에서 unresolved event 확인 가능
- Audit Log에서 주요 변경 이력 확인 가능
- Dashboard widget layout을 조정 가능
```

---

## 33. 보안 / UX 정책

```md
- Web은 haloc API만 호출한다.
- Web은 halon endpoint를 알 필요가 없다.
- token raw value는 생성 시 1회만 표시한다.
- action UI는 기본적으로 숨기거나 비활성화한다.
- allowlist 없는 action은 표시하지 않는다.
- 중요한 변경은 confirmation을 요구한다.
- action, token, log source, topology 변경은 audit log로 남긴다.
- 로그 화면에서는 전체 파일 탐색을 제공하지 않는다.
- 민감정보가 포함될 수 있는 값은 복사/노출에 주의한다.
```

---

## 34. 최종 구현 순서

```md
Step 1-A. Vite + React + TypeScript 프로젝트 구성
Step 1-B. API client / TanStack Query 구성
Step 1-C. Layout / Sidebar / Header / Status Badge 구성
Step 1-D. Dashboard 구현
Step 1-E. Node List 구현
Step 1-F. Node Detail Overview 구현
Step 1-G. Metrics Graph 구현
Step 1-H. Domains 구현
Step 1-I. Services Basic 구현
Step 1-J. Events 구현
Step 1-K. SSE 연결
Step 1-L. haloc embed 배포 구성

Step 2-A. Node Detail 탭 확장
Step 2-B. Containers / Ports / Services View 구현
Step 2-C. Logs View 구현
Step 2-D. Topology Map 구현
Step 2-E. Hardware Assets 구현
Step 2-F. Service-Domain-Node-Asset 관계 연결
Step 2-G. Impact View 구현
Step 2-H. Runbooks / Maintenance / Notifications 구현
Step 2-I. Dashboard Widget Sandbox 구현
Step 2-J. Safe Action UI 후보 구현
```

---

## 35. 최종 판단

`halo-web`은 단순 모니터링 화면이 아니라 `halo-engine`이 수집한 사실을 운영자가 이해하기 쉽게 연결해주는 콘솔이다.

가장 중요한 기준은 다음이다.

```txt
Web은 직접 제어하지 않는다.
Web은 haloc가 제공하는 사실을 보여준다.
운영 action은 마지막에 allowlist 기반으로만 제공한다.
```

따라서 Step 1에서는 Dashboard, Nodes, Metrics, Domains, Services Basic, Events에 집중한다.

Step 2에서는 Logs, Containers, Ports, Topology, Hardware Assets, Impact View, Runbooks, Maintenance, Notification Center, Dashboard Sandbox를 추가한다.

이 구조가 가장 현실적인 이유는 다음과 같다.

```md
- Step 1만 완성해도 실제 홈 인프라 상태를 볼 수 있다.
- Step 2 기능은 Step 1의 node/service/domain/event 데이터 위에 자연스럽게 올라간다.
- action을 마지막으로 미루기 때문에 보안 리스크를 낮출 수 있다.
- Web은 haloc만 바라보므로 구조가 단순하고 배포가 쉽다.
- haloc embed 배포를 사용하면 별도 Web 서버 없이 단일 바이너리 운영이 가능하다.
```
