.PHONY: help build go-build core-build node-build web-install web-build release release-verify release-build release-package package app-build app-build-mac app-build-ios app-test app-ui-test app-archive app-package app-clean core-install node-install test check clean dev-init dev-up dev-run dev-down dev-restart dev-status dev-logs test-init test-up test-run test-down test-restart test-status test-logs test-clean up run down restart status logs

help:
	./ctl help

build:
	./ctl build

go-build:
	./ctl go:build

core-build:
	./ctl core:build

node-build:
	./ctl node:build

web-install:
	./ctl web:install

web-build:
	./ctl web:build

release:
	./ctl release

release-verify:
	./ctl release:verify

release-build:
	./ctl release:build

release-package:
	./ctl release:package

package:
	./ctl package

app-build:
	./ctl app:build

app-build-mac:
	./ctl app:build-mac

app-build-ios:
	./ctl app:build-ios

app-test:
	./ctl app:test

app-ui-test:
	./ctl app:ui-test

app-archive:
	./ctl app:archive

app-package:
	./ctl app:package

app-clean:
	./ctl app:clean

core-install:
	./ctl core:install

node-install:
	./ctl node:install

test:
	./ctl test

check:
	./ctl check

clean:
	./ctl clean

dev-init:
	./ctl dev:init

dev-up:
	./ctl dev:up

dev-run:
	./ctl dev:run

dev-down:
	./ctl dev:down

dev-restart:
	./ctl dev:restart

dev-status:
	./ctl dev:status

dev-logs:
	SERVICE="$(SERVICE)" ./ctl dev:logs

test-init:
	./ctl test:init

test-up:
	./ctl test:up

test-run:
	./ctl test:run

test-down:
	./ctl test:down

test-restart:
	./ctl test:restart

test-status:
	./ctl test:status

test-logs:
	SERVICE="$(SERVICE)" ./ctl test:logs

test-clean:
	./ctl test:clean

up: dev-up

run: dev-run

down: dev-down

restart: dev-restart

status: dev-status

logs: dev-logs
