# halo-app native API 설계안

## 0. 문서 목적

`halo-app`은 Mac과 iPhone에서 `haloc` core에 연결하는 네이티브 운영
클라이언트이다. 이전 계획처럼 core의 Web UI를 `WKWebView`로 감싸는
방식이 아니라, SwiftUI 화면이 인증된 core API를 직접 호출한다.

```txt
Mac / iPhone App
  -> SwiftUI native screens
  -> Keychain app token
  -> REST / SSE / APNs registration
haloc core
  -> storage + event stream + notification dispatch
  -> REST pull
halon nodes
```

`halo-app`은 `halon`을 직접 호출하지 않는다. 모든 데이터, 이벤트, 설정 변경은
`haloc`의 `/api/v1` 경계를 통과한다.

## 1. 핵심 방향

- 앱은 core나 node가 아니라, core에 등록된 authenticated app device이다.
- 앱 인증 토큰은 node token과 분리한다.
- 앱 UI는 SwiftUI native 화면으로 구성한다.
- Web UI는 브라우저 경로로 계속 유지하지만 앱 런타임의 기본 화면이 아니다.
- 앱 세션의 신뢰 저장소는 Keychain이다.
- 앱 요청은 `Authorization: Bearer halo_app_...` header를 사용한다.
- core는 app token을 hash로만 저장하고, device/user/scope/revocation을 추적한다.
- foreground 실시간 갱신은 SSE, background 알림은 APNs를 사용한다.

## 2. 인증 모델

앱은 `halon` node와 비슷하게 "등록된 peer가 token으로 core에 접근한다"는
큰 구조를 공유한다. 하지만 권한 모델은 다르다.

```txt
halo_node_... token
  목적: haloc이 halon node에서 telemetry를 수집
  저장: core가 node 호출을 위해 sealed plaintext 보관
  권한: 해당 node agent API

halo_app_... token
  목적: native app이 haloc API를 호출
  저장: core가 hash만 보관
  권한: user + device + scopes
```

앱 token은 다음 속성을 가진다.

```txt
id
user_id
device_id
token_hash
name
scopes_json
created_at
last_used_at
expires_at
revoked_at
```

첫 구현은 단순하게 `core:api`, `push:register` scope를 발급하고, 이후 API별
scope enforcement를 넓힌다.

## 3. Pairing / Login

초기 구현은 native login을 사용한다.

```txt
1. 앱에서 core URL 등록
2. POST /api/v1/auth/login
3. 임시 user session token 수신
4. POST /api/v1/mobile/devices { issue_app_token: true }
5. app token을 Keychain에 저장
6. 이후 요청은 app token만 사용
```

후속 UX는 QR pairing이다.

```txt
1. 브라우저 Web UI에서 short-lived pairing code 생성
2. 앱이 QR code 스캔
3. POST /api/v1/mobile/pair/complete
4. app token 발급
```

QR pairing은 비밀번호를 앱에 직접 입력하지 않아도 되는 장점이 있다.

## 4. Core API 경계

`haloc`의 `/api/v1`는 앱과 Web이 공유하는 공식 API surface가 된다.

초기 native app이 직접 소비할 API:

```txt
GET    /api/v1/healthz
GET    /api/v1/auth/me
POST   /api/v1/auth/logout
GET    /api/v1/dashboard
GET    /api/v1/nodes
GET    /api/v1/nodes/{name}/summary
GET    /api/v1/events
GET    /api/v1/services
GET    /api/v1/domains
GET    /api/v1/stream
POST   /api/v1/mobile/devices
POST   /api/v1/mobile/devices/{id}/ping
DELETE /api/v1/mobile/devices/{id}
```

추가해야 할 API contract 작업:

- 응답 DTO를 Web 구현 세부에서 분리한다.
- Swift DTO와 TypeScript DTO가 같은 JSON contract를 따른다.
- breaking change가 필요한 경우 `/api/v2` 또는 capability flag를 사용한다.
- `/api/v1/healthz`에 core version과 capabilities를 포함한다.

## 5. Native App 구성

```txt
HaloAppCore/
  CoreProfileStore
  KeychainSessionStore
  AuthClient
  CoreAPIClient
  StreamClient
  NotificationPolicy
  DeepLinkRouter

HaloApp/
  RootView
  AddCoreView
  NativeLoginView
  DashboardView
  NodeListView
  EventListView
  SettingsView
  ConnectionStatus UI
  NotificationCoordinator
```

앱 첫 화면은 marketing/landing이 아니라 운영 화면이다. 로그인 후 바로 dashboard
summary와 최근 이벤트를 보여준다.

## 6. Notifications

Foreground:

- SSE stream으로 event를 수신한다.
- app-local notification policy로 후보를 필터링한다.
- core offline/recovered도 앱 자체 이벤트로 처리한다.

Background:

- APNs device token을 `/api/v1/mobile/devices`에 등록한다.
- core가 event candidate를 device preference와 maintenance window로 필터링한다.
- push payload에는 session/app token이나 민감한 로그 본문을 넣지 않는다.

## 7. 보안 원칙

- app token은 core DB에 hash만 저장한다.
- Keychain item은 core origin별로 분리한다.
- logout은 현재 app token을 revoke한다.
- password change는 user session과 app token revocation 정책을 명확히 한다.
- native API 요청은 Bearer header를 사용하고 cookie/localStorage에 의존하지 않는다.
- production 배포는 HTTPS, Tailscale, 또는 신뢰 가능한 reverse proxy를 전제로 한다.
- device 삭제는 push token과 app token을 함께 폐기한다.

## 8. 패키징

패키징 산출물은 기존 `dist/app` 아래로 모은다.

```txt
halo/dist/app/
├── macos/
│   ├── Halo.app
│   ├── Halo.dmg
│   └── notarization/
└── ios/
    ├── Halo.ipa
    └── export/
```

CLI 흐름은 기존 `ctl`의 app namespace를 유지한다.

```txt
app:build
app:build-mac
app:build-ios
app:test
app:ui-test
app:archive
app:package
app:clean
```

## 9. 테스트

Go tests:

- app token 생성 prefix/hash
- mobile device 등록 시 app token one-time 반환
- app token middleware 인증
- revoked/expired app token 거부
- app token logout revoke
- device 삭제 시 app token cascade

Swift tests:

- Keychain/Memory session round trip
- AuthClient login -> device registration DTO parsing
- CoreAPIClient Bearer header injection
- dashboard DTO decoding
- connection status mapping

Integration tests:

- native login 후 app token 저장
- 저장된 app token으로 `/api/v1/dashboard` 접근
- app logout 후 같은 token이 401을 반환
- app token으로 mobile device ping 성공
- revoked token으로 SSE 연결 실패

## 10. 구현 순서

1. 설계 문서와 README를 native API 기준으로 갱신한다.
2. `halo_app_` token generator/hash helper를 추가한다.
3. `app_tokens` storage와 schema를 추가한다.
4. auth middleware가 user session과 app token을 모두 검증하게 한다.
5. mobile device registration이 app token을 one-time 발급하게 한다.
6. Swift `AuthClient`가 login 후 app device token을 저장하게 한다.
7. Swift `CoreAPIClient`와 native dashboard 화면을 추가한다.
8. WKWebView 의존을 기본 경로에서 제거한다.
9. SSE foreground stream과 APNs registration을 붙인다.
10. packaging/XCUITest를 정리한다.
